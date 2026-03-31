# Van Control Hub — Hardware Setup

## Overview

```
[Solar Panels] ──► [MPPT Charge Controller] ──► [Leisure Battery]
                                                        │
                                               [12V Fuse Panel]
                                                        │
                              ┌─────────────────────────┼──────────────────┐
                              │                         │                  │
                    [MOSFET × 5]              [INA219 Monitor]     [Inverter relay]
                    (lights via PWM)          (I2C to Arduino)      (12V→120V AC)
                              │
                        [ELEGOO UNO R3]
                              │ (USB cable)
                        [Raspberry Pi]
                              │ (WebSocket ws://localhost:8765)
                        [React Touchscreen UI]
```

## Components Needed

| Component | Purpose | Notes |
|-----------|---------|-------|
| ELEGOO UNO R3 | Microcontroller | Your ordered board |
| INA219 breakout | Battery voltage + current | I2C, ~$3 |
| IRF520N MOSFETs (×6) | Switch 12V loads (lights + inverter) | Logic-level preferred: IRLZ44N |
| 100Ω resistors (×6) | Gate resistors for MOSFETs | |
| 100kΩ + 10kΩ resistors | Solar voltage divider | |
| 10kΩ NTC thermistor | Indoor temperature | |
| 10kΩ resistor | NTC pullup | |
| Terminal blocks | Clean 12V wiring | |
| Raspberry Pi (any model with USB) | Runs the UI + bridge | Pi 4 recommended |
| 7" Raspberry Pi touchscreen | Display | Official Pi Touch Display 2 |
| 12V → 5V USB-C buck converter | Power Pi from van battery | Minimum 3A |

## Pin Mapping (ELEGOO UNO R3)

| Arduino Pin | Function | Notes |
|-------------|----------|-------|
| A4 (SDA) | INA219 I2C data | |
| A5 (SCL) | INA219 I2C clock | |
| A0 | Solar voltage (analog) | Via 100k/10k divider |
| A1 | Indoor temperature (NTC) | Via 10k pullup |
| D3 (PWM) | Cab lights MOSFET | |
| D5 (PWM) | Living area MOSFET | |
| D6 (PWM) | Bed area MOSFET | |
| D9 (PWM) | Work desk MOSFET | |
| D10 (PWM) | Exterior/Awning MOSFET | |
| D11 | Inverter relay/MOSFET | |

## MOSFET Wiring (each channel)

```
Arduino PWM Pin ──[100Ω]──► Gate
                             │
12V Load (+) ──────────────► Drain
                             │
                           Source ──► GND (shared with Arduino GND)
```

**Important:** Arduino GND must share a common ground with the 12V system.

## Raspberry Pi Setup

### 1. Install dependencies
```bash
pip3 install pyserial websockets
```

### 2. Copy files to Pi
```bash
scp hardware/pi_bridge.py pi@raspberrypi.local:/home/pi/van-control/
```

### 3. Auto-start on boot
```bash
sudo nano /etc/rc.local
# Add before exit 0:
python3 /home/pi/van-control/pi_bridge.py &
```

Or use systemd (recommended):
```bash
sudo nano /etc/systemd/system/van-bridge.service
```
```ini
[Unit]
Description=Van Control Serial Bridge
After=network.target

[Service]
ExecStart=/usr/bin/python3 /home/pi/van-control/pi_bridge.py
Restart=always
User=pi

[Install]
WantedBy=multi-user.target
```
```bash
sudo systemctl enable van-bridge
sudo systemctl start van-bridge
```

### 4. Set up the UI to auto-launch in kiosk mode
```bash
# Install Chromium kiosk launcher
sudo nano /etc/xdg/lxsession/LXDE-pi/autostart
# Add:
@chromium-browser --kiosk --app=http://localhost/ --noerrdialogs --disable-infobars
```

### 5. Screen backlight (Pi official 7" display)
The bridge controls brightness automatically:
- Full brightness (78%) when active
- Dims to 10% after 60 seconds idle (configurable in the UI)
- Backlight path: `/sys/class/backlight/rpi_backlight/brightness`

Allow Pi user to write backlight without sudo:
```bash
sudo chmod a+w /sys/class/backlight/rpi_backlight/brightness
```

## Arduino Libraries Required

Install via Arduino IDE Library Manager:
- **Adafruit INA219** by Adafruit
- **Wire** (built-in)

## Uploading the Sketch

1. Open `van_controller/van_controller.ino` in Arduino IDE
2. Select board: **Arduino Uno**
3. Select port: your ELEGOO's COM port
4. Click Upload
5. Open Serial Monitor at 115200 baud to verify telemetry JSON is printing

## Calibration

### Battery capacity
In `van_controller.ino`, update:
```cpp
float batteryCapacityWh = 100000.0; // Change to your battery Wh (e.g. 200Ah × 12V = 2400Wh → 2400000.0 mWh... actually just use Wh directly)
```
Common sizes: 100Ah LiFePO4 = 1280Wh, 200Ah = 2560Wh

### Solar voltage divider
The default divider (100kΩ/10kΩ) handles up to ~55V. 
For a 12V panel system with MPPT, a 20kΩ/10kΩ divider gives better resolution (handles up to ~15V).

### INA219 calibration
Default is `setCalibration_32V_2A()`. For a high-current system (>2A charging):
```cpp
ina219.setCalibration_32V_8A(); // Handles up to 8A measurement
```
