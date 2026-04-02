/**
 * NomadOS — ESP-32 Climate Controller
 * =====================================
 * IR remote learning + replay for Heater and AC control.
 * Direct relay control for diesel heater and wired AC units.
 * Optional cabin temperature via DS18B20 sensor.
 * Communicates with the Pi (Electron app) over USB serial at 115200 baud.
 *
 * WIRING DIAGRAM
 * ──────────────
 *   GPIO 14 ─── VS1838B IR Receiver (signal pin)
 *               VS1838B VCC → 3.3V,  GND → GND
 *
 *   GPIO 4  ─── IR LED anode (via 47Ω series resistor)
 *               IR LED cathode → GND
 *               (For longer range: use a 2N2222/BC547 transistor driver)
 *
 *   GPIO 13 ─── DS18B20 data pin
 *               4.7kΩ pull-up from data to 3.3V
 *               DS18B20 VCC → 3.3V,  GND → GND
 *               (Omit sensor if not needed — firmware handles missing sensor)
 *
 *   GPIO 12 ─── Diesel Heater relay (HIGH = ON)
 *               Compatible with: Vevor, Hcalory, Webasto T91/T92 clones,
 *               and most 12V Chinese diesel heaters with relay/switch input.
 *               Wire: normally-open relay terminal to heater's ON/OFF switch pins.
 *               Use a 5V relay module with an optocoupler for isolation.
 *
 *   GPIO 15 ─── Direct AC relay (HIGH = ON)
 *               For AC units with a relay-controlled power input or built-in
 *               thermostat bypass (e.g. window units, RV rooftop AC with relay
 *               mod, mini-splits with external on/off control).
 *
 *   GPIO 33 ─── Diesel heat level PWM output (optional)
 *               Maps heat level 1–5 → duty cycle 20–100%.
 *               For heaters that accept a 0–5V analog input for heat level.
 *               Wire via a simple RC low-pass filter (10kΩ + 100µF) for DAC-like
 *               behavior, or directly to heaters that accept PWM.
 *
 * DEPENDENCIES (Arduino Library Manager)
 * ────────────
 *   - IRremoteESP8266 by David Conran et al.
 *   - ArduinoJson by Benoit Blanchon (v6.x)
 *   - OneWire by Jim Studt
 *   - DallasTemperature by Miles Burton
 *
 * PROTOCOL — Commands received from Pi (JSON, newline-delimited):
 *   {"cmd":"learnIR"}                        → Start 10 s IR capture window
 *   {"cmd":"sendIR","data":[...]}            → Replay raw timing array (µs)
 *   {"cmd":"setDieselHeater","on":true,"level":3}  → Diesel relay on/off + heat level 1-5
 *   {"cmd":"setDirectAC","on":true}          → AC relay on/off
 *
 * PROTOCOL — Events/telemetry sent to Pi:
 *   {"status":"ESP32_CLIMATE_READY"}                (boot)
 *   {"tempF":68.2,"dieselOn":false,"dieselLevel":3,"acOn":false,"ts":12345} (every 2 s)
 *   {"event":"irLearned","data":[...]}              (after successful IR capture)
 *   {"event":"irLearnFailed","reason":"timeout"}    (10 s with no signal)
 *   {"status":"listening"}                          (IR learning mode started)
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <IRrecv.h>
#include <IRsend.h>
#include <IRutils.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── Pins ──────────────────────────────────────────────────────────────────────
#define IR_RECV_PIN       14   // VS1838B IR receiver
#define IR_SEND_PIN       4    // IR LED transmitter
#define TEMP_PIN          13   // DS18B20 temperature sensor
#define DIESEL_RELAY_PIN  12   // Diesel heater on/off relay
#define AC_RELAY_PIN      15   // Direct AC on/off relay
#define DIESEL_LEVEL_PIN  33   // PWM heat level output (optional)

// ── IR config ─────────────────────────────────────────────────────────────────
#define IR_BUF_SIZE       200   // raw timing entries to capture
#define LEARN_TIMEOUT_MS  10000 // 10 s capture window

IRrecv irRecv(IR_RECV_PIN, IR_BUF_SIZE, 15, true);
IRsend irSend(IR_SEND_PIN);
decode_results irResults;

// ── Temperature ───────────────────────────────────────────────────────────────
OneWire oneWire(TEMP_PIN);
DallasTemperature tempSensor(&oneWire);

// ── PWM for diesel level ───────────────────────────────────────────────────────
#define DIESEL_PWM_CH   3
#define DIESEL_PWM_FREQ 1000
#define DIESEL_PWM_BITS 8

// ── State ─────────────────────────────────────────────────────────────────────
bool          isLearning   = false;
unsigned long learnStart   = 0;
float         lastTempF    = -999.0f;

bool          dieselOn     = false;
int           dieselLevel  = 3;    // 1–5
bool          acOn         = false;

// ── Helpers ───────────────────────────────────────────────────────────────────
void applyDieselRelay() {
  digitalWrite(DIESEL_RELAY_PIN, dieselOn ? HIGH : LOW);
  // Map heat level 1–5 to PWM duty 51–255 (20%–100%)
  int duty = dieselOn ? map(dieselLevel, 1, 5, 51, 255) : 0;
  ledcWrite(DIESEL_PWM_CH, duty);
}

void applyACRelay() {
  digitalWrite(AC_RELAY_PIN, acOn ? HIGH : LOW);
}

void sendTelemetry() {
  tempSensor.requestTemperatures();
  float tempC = tempSensor.getTempCByIndex(0);

  if (tempC != DEVICE_DISCONNECTED_C && tempC > -100.0f) {
    lastTempF = tempC * 9.0f / 5.0f + 32.0f;
  }

  StaticJsonDocument<128> doc;
  if (lastTempF > -900.0f) {
    doc["tempF"] = (float)(round(lastTempF * 10.0f) / 10.0f);
  } else {
    doc["tempF"] = nullptr;
  }
  doc["dieselOn"]    = dieselOn;
  doc["dieselLevel"] = dieselLevel;
  doc["acOn"]        = acOn;
  doc["ts"]          = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void sendIRLearned(uint16_t* rawbuf, uint16_t rawlen) {
  DynamicJsonDocument doc(rawlen * 8 + 128);
  doc["event"] = "irLearned";
  JsonArray arr = doc.createNestedArray("data");
  for (uint16_t i = 1; i < rawlen; i++) {
    arr.add((uint32_t)rawbuf[i] * RAWTICK);
  }
  serializeJson(doc, Serial);
  Serial.println();
}

void sendIREvent(const char* event, const char* reason) {
  StaticJsonDocument<96> doc;
  doc["event"] = event;
  if (reason) doc["reason"] = reason;
  serializeJson(doc, Serial);
  Serial.println();
}

void startLearning() {
  irRecv.enableIRIn();
  isLearning = true;
  learnStart = millis();
  Serial.println("{\"status\":\"listening\"}");
}

void stopLearning() {
  irRecv.disableIRIn();
  isLearning = false;
}

void handleCommand(const String& line) {
  DynamicJsonDocument doc(4096);
  DeserializationError err = deserializeJson(doc, line);
  if (err) return;

  const char* cmd = doc["cmd"] | "";

  if (strcmp(cmd, "learnIR") == 0) {
    if (isLearning) stopLearning();
    startLearning();

  } else if (strcmp(cmd, "sendIR") == 0) {
    JsonArray arr = doc["data"].as<JsonArray>();
    if (arr.isNull() || arr.size() == 0) return;
    uint16_t len = (uint16_t)arr.size();
    uint16_t* buf = new uint16_t[len];
    for (uint16_t i = 0; i < len; i++) {
      buf[i] = (uint16_t)arr[i].as<uint32_t>();
    }
    irSend.sendRaw(buf, len, 38);
    delete[] buf;

  } else if (strcmp(cmd, "setDieselHeater") == 0) {
    dieselOn    = doc["on"]    | dieselOn;
    dieselLevel = doc["level"] | dieselLevel;
    dieselLevel = constrain(dieselLevel, 1, 5);
    applyDieselRelay();
    sendTelemetry();

  } else if (strcmp(cmd, "setDirectAC") == 0) {
    acOn = doc["on"] | acOn;
    applyACRelay();
    sendTelemetry();
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Relay outputs — start LOW (off)
  pinMode(DIESEL_RELAY_PIN, OUTPUT);
  digitalWrite(DIESEL_RELAY_PIN, LOW);
  pinMode(AC_RELAY_PIN, OUTPUT);
  digitalWrite(AC_RELAY_PIN, LOW);

  // PWM for diesel heat level
  ledcSetup(DIESEL_PWM_CH, DIESEL_PWM_FREQ, DIESEL_PWM_BITS);
  ledcAttachPin(DIESEL_LEVEL_PIN, DIESEL_PWM_CH);
  ledcWrite(DIESEL_PWM_CH, 0);

  irSend.begin();
  tempSensor.begin();

  Serial.println("{\"status\":\"ESP32_CLIMATE_READY\"}");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry >= 2000) {
    lastTelemetry = millis();
    sendTelemetry();
  }

  if (isLearning) {
    if (irRecv.decode(&irResults)) {
      sendIRLearned(irResults.rawbuf, irResults.rawlen);
      irRecv.resume();
      stopLearning();
    } else if (millis() - learnStart > LEARN_TIMEOUT_MS) {
      sendIREvent("irLearnFailed", "timeout");
      stopLearning();
    }
  }

  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      handleCommand(line);
    }
  }
}
