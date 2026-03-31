/*
  ============================================================
  VAN CONTROL HUB — ELEGOO UNO R3 Firmware
  ============================================================
  Communicates with Raspberry Pi over USB Serial (115200 baud).
  
  PROTOCOL (JSON over serial):
    Pi → Arduino:  {"cmd":"setLight","id":"cab","on":true,"brightness":80}
                   {"cmd":"setInverter","on":true}
                   {"cmd":"ping"}
    Arduino → Pi:  {"bat_v":13.24,"bat_a":4.12,"bat_soc":78,
                    "solar_v":18.4,"solar_w":187,"yield_wh":940,
                    "temp_f":68.5,"lights":[1,0,0,0,0],
                    "inverter":false}

  WIRING:
  -------
  INA219 (Battery current/voltage):
    SDA → A4 (I2C)
    SCL → A5 (I2C)
    GND → GND, VCC → 5V

  MOSFET Channels (IRF520N or IRLZ44N — logic-level preferred):
    D3  (PWM) → MOSFET gate → Cab Lights      (12V)
    D5  (PWM) → MOSFET gate → Living Area LEDs (12V)
    D6  (PWM) → MOSFET gate → Bed Area LEDs    (12V)
    D9  (PWM) → MOSFET gate → Work Desk LED    (12V)
    D10 (PWM) → MOSFET gate → Exterior/Awning  (12V)
    D11       → MOSFET gate → Inverter relay    (12V)

  Solar voltage (via voltage divider — 100k/10k → 0-5V):
    A0  → Voltage divider output
    (Solar panels typically output 12-21V; divider scales to safe ADC range)

  NTC Thermistor (10k @ 25°C) for indoor temp:
    A1  → Thermistor + 10k pullup to 5V (voltage divider to GND)

  NOTE: Connect MOSFET sources to the load ground. MOSFET drain 
  connects to 12V load negative. Gate resistor (100-220 ohm) between
  Arduino pin and gate is recommended to prevent oscillation.
  ============================================================
*/

#include <Wire.h>
#include <Adafruit_INA219.h>

// --- Pin Definitions ---
const int PIN_LIGHT_CAB      = 3;
const int PIN_LIGHT_LIVING   = 5;
const int PIN_LIGHT_BED      = 6;
const int PIN_LIGHT_DESK     = 9;
const int PIN_LIGHT_AWNING   = 10;
const int PIN_INVERTER       = 11;
const int PIN_SOLAR_V        = A0;
const int PIN_TEMP           = A1;

// --- INA219 for battery monitoring ---
Adafruit_INA219 ina219;

// --- State ---
struct LightState {
  bool on;
  uint8_t brightness; // 0-100
};

LightState lights[5] = {
  {false, 100}, // cab
  {false,  80}, // living
  {false,  50}, // bed
  {false, 100}, // desk
  {false, 100}, // awning
};

bool inverterOn = false;

// Estimated battery SOC (very simple coulomb counting — real builds use a BMS)
float batterySoc = 78.0;
float batteryCapacityWh = 100000.0; // 100Ah * 12V = 1200Wh — adjust to your battery
float yieldWhToday = 0.0;

unsigned long lastSendMs = 0;
const unsigned long SEND_INTERVAL = 1000; // Send data every 1 second

unsigned long lastUpdateMs = 0;

// Serial input buffer
String inputBuffer = "";

// --- Helpers ---
int brightnessToAnalog(uint8_t pct) {
  // Convert 0-100% to 0-255 PWM
  return (int)((pct / 100.0f) * 255.0f);
}

int lightPin(int idx) {
  const int pins[] = {PIN_LIGHT_CAB, PIN_LIGHT_LIVING, PIN_LIGHT_BED, PIN_LIGHT_DESK, PIN_LIGHT_AWNING};
  return pins[idx];
}

void applyLight(int idx) {
  if (lights[idx].on) {
    analogWrite(lightPin(idx), brightnessToAnalog(lights[idx].brightness));
  } else {
    analogWrite(lightPin(idx), 0);
  }
}

void applyAllLights() {
  for (int i = 0; i < 5; i++) applyLight(i);
}

void applyInverter() {
  digitalWrite(PIN_INVERTER, inverterOn ? HIGH : LOW);
}

float readSolarVoltage() {
  // Voltage divider: R1=100k, R2=10k → scale factor = (R1+R2)/R2 = 11.0
  // ADC: 0-1023 maps to 0-5V
  int raw = analogRead(PIN_SOLAR_V);
  float adcV = (raw / 1023.0f) * 5.0f;
  return adcV * 11.0f;
}

float readTempF() {
  // NTC 10k @ 25°C, β=3950, pullup 10k to 5V
  int raw = analogRead(PIN_TEMP);
  float r = 10000.0f * raw / (1023.0f - raw);
  float kelvin = 1.0f / (log(r / 10000.0f) / 3950.0f + 1.0f / 298.15f);
  float celsius = kelvin - 273.15f;
  return celsius * 9.0f / 5.0f + 32.0f;
}

// --- Simple JSON parser for commands from Pi ---
// Format: {"cmd":"setLight","idx":0,"on":true,"brightness":80}
void processCommand(const String& json) {
  // Extract cmd value
  int cmdStart = json.indexOf("\"cmd\"");
  if (cmdStart < 0) return;
  int colonPos = json.indexOf(':', cmdStart);
  int quoteOpen = json.indexOf('"', colonPos);
  int quoteClose = json.indexOf('"', quoteOpen + 1);
  String cmd = json.substring(quoteOpen + 1, quoteClose);

  if (cmd == "ping") {
    Serial.println("{\"pong\":true}");
    return;
  }

  if (cmd == "setLight") {
    // Parse idx
    int idxPos = json.indexOf("\"idx\"");
    if (idxPos < 0) return;
    int idxColon = json.indexOf(':', idxPos);
    int idxComma = json.indexOf(',', idxColon);
    int idx = json.substring(idxColon + 1, idxComma).toInt();
    if (idx < 0 || idx >= 5) return;

    // Parse on
    bool on = json.indexOf("\"on\":true") >= 0;
    lights[idx].on = on;

    // Parse brightness (optional)
    int brightPos = json.indexOf("\"brightness\"");
    if (brightPos >= 0) {
      int brightColon = json.indexOf(':', brightPos);
      int brightEnd = json.indexOf(',', brightColon);
      if (brightEnd < 0) brightEnd = json.indexOf('}', brightColon);
      int brightness = json.substring(brightColon + 1, brightEnd).toInt();
      lights[idx].brightness = constrain(brightness, 0, 100);
    }

    applyLight(idx);
  }

  if (cmd == "setInverter") {
    inverterOn = (json.indexOf("\"on\":true") >= 0);
    applyInverter();
  }

  if (cmd == "allLightsOff") {
    for (int i = 0; i < 5; i++) { lights[i].on = false; applyLight(i); }
  }
}

// --- Setup ---
void setup() {
  Serial.begin(115200);
  while (!Serial) delay(10);

  // Configure output pins
  for (int i = 0; i < 5; i++) { pinMode(lightPin(i), OUTPUT); analogWrite(lightPin(i), 0); }
  pinMode(PIN_INVERTER, OUTPUT);
  digitalWrite(PIN_INVERTER, LOW);

  // INA219
  if (!ina219.begin()) {
    // INA219 not found — will send zero values; not fatal
  }
  // Set gain for up to 32V / 3.2A — adjust if you have a bigger battery bank
  ina219.setCalibration_32V_2A();

  lastSendMs = millis();
  lastUpdateMs = millis();

  Serial.println("{\"status\":\"ready\",\"firmware\":\"van-control-v1.0\"}");
}

// --- Loop ---
void loop() {
  // --- Read incoming serial commands ---
  while (Serial.available()) {
    char c = Serial.read();
    if (c == '\n') {
      if (inputBuffer.length() > 0) {
        processCommand(inputBuffer);
        inputBuffer = "";
      }
    } else {
      inputBuffer += c;
      if (inputBuffer.length() > 256) inputBuffer = ""; // overflow guard
    }
  }

  unsigned long now = millis();

  // --- Send telemetry every SEND_INTERVAL ---
  if (now - lastSendMs >= SEND_INTERVAL) {
    lastSendMs = now;

    float deltaSeconds = (now - lastUpdateMs) / 1000.0f;
    lastUpdateMs = now;

    // INA219 readings
    float busV   = ina219.getBusVoltage_V();
    float currentA = ina219.getCurrent_mA() / 1000.0f; // convert mA → A

    // Solar
    float solarV = readSolarVoltage();
    // Approximate solar watts: P = V * I (assume MPPT at ~14.5A max)
    // A real system reads MPPT controller output; this is an approximation
    float solarW = (solarV > 12.0f) ? (solarV - 12.0f) * 18.0f : 0.0f;
    solarW = constrain(solarW, 0.0f, 400.0f);

    // Accumulate yield
    yieldWhToday += (solarW * deltaSeconds) / 3600.0f;

    // Temperature
    float tempF = readTempF();

    // Very rough SOC update via net amp-hours
    // Real: use a proper battery monitor IC (e.g. BQ27441 or Victron BMV)
    float powerNetW = (solarW) - (busV * currentA > 0 ? busV * currentA : 0);
    batterySoc += (powerNetW * deltaSeconds / 3600.0f) / (batteryCapacityWh / 100.0f);
    batterySoc = constrain(batterySoc, 0.0f, 100.0f);

    // Build lights array [0,0,0,0,0]
    char lightsArr[20];
    snprintf(lightsArr, sizeof(lightsArr), "[%d,%d,%d,%d,%d]",
      lights[0].on ? 1 : 0,
      lights[1].on ? 1 : 0,
      lights[2].on ? 1 : 0,
      lights[3].on ? 1 : 0,
      lights[4].on ? 1 : 0);

    // Build brightness array
    char brightArr[30];
    snprintf(brightArr, sizeof(brightArr), "[%d,%d,%d,%d,%d]",
      lights[0].brightness,
      lights[1].brightness,
      lights[2].brightness,
      lights[3].brightness,
      lights[4].brightness);

    // Send JSON
    Serial.print("{");
    Serial.print("\"bat_v\":"); Serial.print(busV, 2); Serial.print(",");
    Serial.print("\"bat_a\":"); Serial.print(currentA, 2); Serial.print(",");
    Serial.print("\"bat_soc\":"); Serial.print(batterySoc, 1); Serial.print(",");
    Serial.print("\"solar_v\":"); Serial.print(solarV, 1); Serial.print(",");
    Serial.print("\"solar_w\":"); Serial.print(solarW, 0); Serial.print(",");
    Serial.print("\"yield_wh\":"); Serial.print(yieldWhToday, 0); Serial.print(",");
    Serial.print("\"temp_f\":"); Serial.print(tempF, 1); Serial.print(",");
    Serial.print("\"lights\":"); Serial.print(lightsArr); Serial.print(",");
    Serial.print("\"brightness\":"); Serial.print(brightArr); Serial.print(",");
    Serial.print("\"inverter\":"); Serial.print(inverterOn ? "true" : "false");
    Serial.println("}");
  }
}
