/**
 * NomadOS — ESP-32 RGB LED Controller
 * =====================================
 * Controls one zone of RGB LED strip via three N-channel MOSFETs.
 * Communicates with the Pi (Electron app) over USB serial at 115200 baud.
 * Protocol is newline-delimited JSON in both directions.
 *
 * WIRING DIAGRAM
 * ──────────────
 *   ESP-32 GPIO 25  ─── MOSFET Gate (Red channel)
 *   ESP-32 GPIO 26  ─── MOSFET Gate (Green channel)
 *   ESP-32 GPIO 27  ─── MOSFET Gate (Blue channel)
 *
 *   MOSFET (per channel, e.g. IRLZ44N or 2N7000):
 *     Gate   ← ESP-32 GPIO (add 330Ω resistor in series)
 *     Drain  → LED strip negative for that colour channel
 *     Source → System ground (common with ESP-32 GND and battery -)
 *
 *   LED Strip:
 *     V+  → 12V fused supply (fuse near battery, size for strip amperage)
 *     R-  → MOSFET Drain (Red)
 *     G-  → MOSFET Drain (Green)
 *     B-  → MOSFET Drain (Blue)
 *
 *   NOTE: Add a 10kΩ pull-down resistor from each Gate to GND so the
 *         MOSFET stays OFF while the ESP-32 is booting.
 *
 * DEPENDENCIES
 * ────────────
 *   Arduino IDE: install "ArduinoJson" by Benoit Blanchon (v6.x)
 *   Board: "ESP32 Dev Module" in Boards Manager → esp32 by Espressif
 *
 * COMMANDS received from Pi (JSON, one per line):
 *   {"cmd":"setState","on":true,"brightness":80,"r":255,"g":200,"b":100}
 *   {"cmd":"allLightsOff"}
 *
 * TELEMETRY sent to Pi every 1 second:
 *   {"on":true,"brightness":80,"r":255,"g":200,"b":100,"ts":12345}
 */

#include <Arduino.h>
#include <ArduinoJson.h>

// ── Pin definitions ────────────────────────────────────────────────────────────
#define PIN_R 25
#define PIN_G 26
#define PIN_B 27

// ── PWM config ────────────────────────────────────────────────────────────────
#define PWM_CH_R   0
#define PWM_CH_G   1
#define PWM_CH_B   2
#define PWM_FREQ   5000   // Hz — above audible range, below switching loss
#define PWM_BITS   8      // 8-bit = 0–255

// ── State ─────────────────────────────────────────────────────────────────────
bool  ledOn     = false;
int   ledR      = 255;
int   ledG      = 200;
int   ledB      = 80;
int   ledBright = 100;  // 0–100 %

// ── Helpers ───────────────────────────────────────────────────────────────────
void applyLEDs() {
  if (!ledOn) {
    ledcWrite(PWM_CH_R, 0);
    ledcWrite(PWM_CH_G, 0);
    ledcWrite(PWM_CH_B, 0);
    return;
  }
  float factor = ledBright / 100.0f;
  ledcWrite(PWM_CH_R, (int)(ledR * factor));
  ledcWrite(PWM_CH_G, (int)(ledG * factor));
  ledcWrite(PWM_CH_B, (int)(ledB * factor));
}

void sendTelemetry() {
  StaticJsonDocument<128> doc;
  doc["on"]         = ledOn;
  doc["brightness"] = ledBright;
  doc["r"]          = ledR;
  doc["g"]          = ledG;
  doc["b"]          = ledB;
  doc["ts"]         = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void handleCommand(const String& line) {
  StaticJsonDocument<128> doc;
  DeserializationError err = deserializeJson(doc, line);
  if (err) return;

  const char* cmd = doc["cmd"] | "";

  if (strcmp(cmd, "setState") == 0) {
    ledOn     = doc["on"]         | ledOn;
    ledBright = doc["brightness"] | ledBright;
    ledR      = doc["r"]          | ledR;
    ledG      = doc["g"]          | ledG;
    ledB      = doc["b"]          | ledB;
    // Clamp
    ledBright = constrain(ledBright, 0, 100);
    ledR      = constrain(ledR,      0, 255);
    ledG      = constrain(ledG,      0, 255);
    ledB      = constrain(ledB,      0, 255);
    applyLEDs();
    sendTelemetry();

  } else if (strcmp(cmd, "allLightsOff") == 0) {
    ledOn = false;
    applyLEDs();
    sendTelemetry();
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);

  // Configure PWM channels
  ledcSetup(PWM_CH_R, PWM_FREQ, PWM_BITS);
  ledcSetup(PWM_CH_G, PWM_FREQ, PWM_BITS);
  ledcSetup(PWM_CH_B, PWM_FREQ, PWM_BITS);

  // Attach pins
  ledcAttachPin(PIN_R, PWM_CH_R);
  ledcAttachPin(PIN_G, PWM_CH_G);
  ledcAttachPin(PIN_B, PWM_CH_B);

  // Start with LEDs off
  applyLEDs();

  // Ready signal
  Serial.println("{\"status\":\"ESP32_LED_READY\"}");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  // Send telemetry every 1 second
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry >= 1000) {
    lastTelemetry = millis();
    sendTelemetry();
  }

  // Read incoming commands (newline-delimited JSON)
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      handleCommand(line);
    }
  }
}
