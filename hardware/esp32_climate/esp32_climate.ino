/**
 * NomadOS — ESP-32 Climate Controller
 * =====================================
 * IR remote learning + replay for Heater and AC control.
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
 * DEPENDENCIES (Arduino Library Manager)
 * ────────────
 *   - IRremoteESP8266 by David Conran et al.
 *   - ArduinoJson by Benoit Blanchon (v6.x)
 *   - OneWire by Jim Studt
 *   - DallasTemperature by Miles Burton
 *
 * PROTOCOL — Commands received from Pi (JSON, newline-delimited):
 *   {"cmd":"learnIR"}               → Start 10 s capture window
 *   {"cmd":"sendIR","data":[...]}   → Replay raw timing array (µs)
 *
 * PROTOCOL — Events sent to Pi:
 *   {"status":"ESP32_CLIMATE_READY"}            (boot)
 *   {"tempF":68.2,"ts":12345}                   (every 2 s)
 *   {"event":"irLearned","data":[...]}           (after successful capture)
 *   {"event":"irLearnFailed","reason":"timeout"} (10 s with no signal)
 *   {"status":"listening"}                       (learning mode started)
 */

#include <Arduino.h>
#include <ArduinoJson.h>
#include <IRrecv.h>
#include <IRsend.h>
#include <IRutils.h>
#include <OneWire.h>
#include <DallasTemperature.h>

// ── Pins ──────────────────────────────────────────────────────────────────────
#define IR_RECV_PIN      14
#define IR_SEND_PIN      4
#define TEMP_PIN         13

// ── IR config ─────────────────────────────────────────────────────────────────
#define IR_BUF_SIZE      200   // number of raw timing entries to capture
#define LEARN_TIMEOUT_MS 10000 // 10 s capture window

IRrecv irRecv(IR_RECV_PIN, IR_BUF_SIZE, 15, true);
IRsend irSend(IR_SEND_PIN);
decode_results irResults;

// ── Temperature ───────────────────────────────────────────────────────────────
OneWire oneWire(TEMP_PIN);
DallasTemperature tempSensor(&oneWire);

// ── State ─────────────────────────────────────────────────────────────────────
bool          isLearning  = false;
unsigned long learnStart  = 0;
float         lastTempF   = -999.0f;

// ── Helpers ───────────────────────────────────────────────────────────────────
void sendTelemetry() {
  tempSensor.requestTemperatures();
  float tempC = tempSensor.getTempCByIndex(0);

  // Accept reading only if a sensor is actually connected
  if (tempC != DEVICE_DISCONNECTED_C && tempC > -100.0f) {
    lastTempF = tempC * 9.0f / 5.0f + 32.0f;
  }

  StaticJsonDocument<96> doc;
  if (lastTempF > -900.0f) {
    doc["tempF"] = (float)(round(lastTempF * 10.0f) / 10.0f);
  } else {
    doc["tempF"] = nullptr;  // no sensor connected
  }
  doc["ts"] = millis();
  serializeJson(doc, Serial);
  Serial.println();
}

void sendIRLearned(uint16_t* rawbuf, uint16_t rawlen) {
  // rawbuf[0] is unused; entries from index 1 are alternating mark/space in ticks.
  // Convert to microseconds: multiply by RAWTICK (default 50µs per tick).
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
  // Use a larger doc for sendIR (the data array can be many entries)
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
    // Transmit raw mark/space timings at 38 kHz carrier
    irSend.sendRaw(buf, len, 38);
    delete[] buf;
  }
}

// ── Setup ─────────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  irSend.begin();
  tempSensor.begin();

  Serial.println("{\"status\":\"ESP32_CLIMATE_READY\"}");
}

// ── Loop ──────────────────────────────────────────────────────────────────────
void loop() {
  // Telemetry every 2 seconds
  static unsigned long lastTelemetry = 0;
  if (millis() - lastTelemetry >= 2000) {
    lastTelemetry = millis();
    sendTelemetry();
  }

  // IR learning
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

  // Incoming commands
  while (Serial.available()) {
    String line = Serial.readStringUntil('\n');
    line.trim();
    if (line.length() > 0) {
      handleCommand(line);
    }
  }
}
