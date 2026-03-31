# Van Control Hub

## Overview

A touchscreen control panel for a converted camper van, designed for a 7" Raspberry Pi display (1024×600). Built as a Tesla-style dark UI that controls every electrical system in the van.

## Stack

- **Frontend**: React + Vite + TypeScript (artifacts/van-control)
- **Styling**: Tailwind CSS v4, Framer Motion, Recharts
- **Hardware bridge**: Python 3 (hardware/pi_bridge.py)
- **Microcontroller**: ELEGOO UNO R3 Arduino (hardware/van_controller/van_controller.ino)
- **Monorepo tool**: pnpm workspaces
- **API framework**: Express 5 (artifacts/api-server) — for future backend features

## System Architecture

```
[Solar Panels] ──► [MPPT Charge Controller] ──► [Leisure Battery]
                                                        │
                                               [12V Fuse Panel]
                                                        │
                    [MOSFET × 5 + relay]       [INA219 Monitor]
                    (lights + inverter)         (I2C current sensor)
                              │
                        [ELEGOO UNO R3]
                              │ USB Serial (115200 baud)
                        [Raspberry Pi]
                              │ WebSocket (ws://localhost:8765)
                     [React Touchscreen UI]
```

## Features

- **Dashboard** — Battery SOC gauge, animated power flow diagram, solar/load readouts, quick light toggles
- **Lighting** — 5 zones (Cab, Living, Bed, Desk, Exterior) with PWM dimming + warm/cool color
- **Power** — Battery details, solar chart, inverter toggle, shore/alternator indicators
- **Climate** — Fridge temp control, compressor status, fan speed, indoor temperature
- **Idle mode** — After 60s of inactivity, fades to a minimal clock display and dims the Pi backlight to ~10% (solar-friendly)
- **Hardware integration** — WebSocket connection to Pi bridge; falls back to realistic simulated data when disconnected

## Hardware Files (hardware/)

| File | Purpose |
|------|---------|
| `van_controller/van_controller.ino` | Arduino sketch — reads INA219, controls MOSFETs, sends JSON over serial |
| `pi_bridge.py` | Raspberry Pi bridge — reads Arduino serial, exposes WebSocket server |
| `README.md` | Full wiring diagram, pin mapping, Pi setup instructions |

## Running in Development

```bash
pnpm --filter @workspace/van-control run dev
```

The app runs in "SIM" mode (simulated data) when the Pi bridge isn't connected. This is expected during development.

## Running on the Raspberry Pi

1. Upload `van_controller.ino` to the ELEGOO UNO via Arduino IDE
2. On the Pi: `pip3 install pyserial websockets`
3. `python3 hardware/pi_bridge.py` (auto-detects serial port)
4. Open `http://localhost/` in Chromium kiosk mode

## Key Components

- `artifacts/van-control/src/hooks/useSimulatedData.tsx` — React context with all van state + realistic fluctuations
- `artifacts/van-control/src/hooks/useHardware.tsx` — WebSocket client, merges real Arduino data over simulated state
- `artifacts/van-control/src/hooks/useIdleMode.ts` — Inactivity timer, triggers idle overlay + backlight dim
- `artifacts/van-control/src/components/IdleOverlay.tsx` — Full-screen minimal clock shown when idle
- `artifacts/van-control/src/components/CircularGauge.tsx` — Reusable SVG arc gauge
- `artifacts/van-control/src/components/PowerFlowDiagram.tsx` — Animated Solar → Battery → Loads visual

## Design System

- Theme: Dark-only, Tesla-inspired
- Background: `#08080F` (deep space black)
- Primary: `#E8B84B` (warm amber — battery/power)
- Accent: `#3ECFCF` (cool teal — solar/climate)
- Font: Inter (Google Fonts)
- Touch targets: minimum 48px for Pi touchscreen usability

## Arduino → Pi Protocol

Arduino sends JSON every 1 second:
```json
{"bat_v":13.24,"bat_a":4.12,"bat_soc":78,"solar_v":18.4,"solar_w":187,"yield_wh":940,"temp_f":68.5,"lights":[1,0,0,0,0],"brightness":[80,100,50,100,100],"inverter":false}
```

Pi UI sends commands:
```json
{"cmd":"setLight","idx":0,"on":true,"brightness":80}
{"cmd":"setInverter","on":true}
{"cmd":"allLightsOff"}
{"cmd":"setBacklight","level":200}
```
