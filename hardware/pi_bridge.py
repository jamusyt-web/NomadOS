#!/usr/bin/env python3
"""
VAN CONTROL HUB — Raspberry Pi Serial Bridge
=============================================
Reads telemetry JSON from ELEGOO Arduino over USB serial,
broadcasts it to connected WebSocket clients, and forwards
control commands from the UI back to the Arduino.

Requires:
  pip install pyserial websockets

Run at startup (add to /etc/rc.local or systemd):
  python3 /home/pi/van-control/pi_bridge.py &

Screen brightness control (Pi 7" official display):
  echo 50 | sudo tee /sys/class/backlight/rpi_backlight/brightness

Usage:
  python3 pi_bridge.py [--port /dev/ttyACM0] [--baud 115200] [--ws-port 8765]
"""

import asyncio
import json
import logging
import os
import argparse
import time
from datetime import datetime
from typing import Optional

import serial
import serial.tools.list_ports
import websockets
from websockets.server import serve

# ── Logging ──────────────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("van-bridge")

# ── Config ───────────────────────────────────────────────────────────────────
SERIAL_BAUD     = 115200
WS_HOST         = "0.0.0.0"  # Accept connections from the React UI on same Pi
WS_PORT         = 8765
BACKLIGHT_PATH  = "/sys/class/backlight/rpi_backlight/brightness"
BACKLIGHT_MAX   = 255
BACKLIGHT_DIM   = 25   # ~10% — low power idle
BACKLIGHT_FULL  = 200  # ~78% — active (not full to save a bit of power)

# ── Globals ──────────────────────────────────────────────────────────────────
connected_clients: set = set()
latest_telemetry: dict = {}
arduino: Optional[serial.Serial] = None

# ── Backlight control ─────────────────────────────────────────────────────────
def set_backlight(level: int):
    """Set Pi 7" display brightness (0-255). Silently skips if not available."""
    try:
        with open(BACKLIGHT_PATH, "w") as f:
            f.write(str(max(0, min(255, level))))
    except (PermissionError, FileNotFoundError):
        pass  # Not on a Pi or backlight not available

# ── Serial auto-detection ─────────────────────────────────────────────────────
def find_arduino_port() -> Optional[str]:
    """Auto-detect the ELEGOO/Arduino serial port."""
    candidates = ["/dev/ttyACM0", "/dev/ttyACM1", "/dev/ttyUSB0", "/dev/ttyUSB1"]
    for port in candidates:
        if os.path.exists(port):
            log.info(f"Found serial port: {port}")
            return port

    # Fallback: scan all ports
    for port_info in serial.tools.list_ports.comports():
        desc = (port_info.description or "").lower()
        if "arduino" in desc or "elegoo" in desc or "ch340" in desc or "cp210" in desc:
            log.info(f"Auto-detected Arduino at {port_info.device} ({port_info.description})")
            return port_info.device

    return None

# ── Serial reader ─────────────────────────────────────────────────────────────
async def serial_reader(serial_port: str, baud: int):
    """Continuously read JSON lines from Arduino and broadcast to WS clients."""
    global arduino, latest_telemetry
    retry_delay = 2.0

    while True:
        try:
            arduino = serial.Serial(serial_port, baud, timeout=2)
            log.info(f"Connected to Arduino on {serial_port} @ {baud} baud")
            set_backlight(BACKLIGHT_FULL)

            while True:
                if arduino.in_waiting:
                    raw = arduino.readline().decode("utf-8", errors="ignore").strip()
                    if not raw.startswith("{"):
                        continue
                    try:
                        data = json.loads(raw)
                    except json.JSONDecodeError:
                        continue

                    # Enrich with server timestamp
                    data["ts"] = time.time()
                    data["connected"] = True
                    latest_telemetry = data

                    if connected_clients:
                        msg = json.dumps(data)
                        websockets.broadcast(connected_clients, msg)

                await asyncio.sleep(0.01)  # Yield to event loop

        except serial.SerialException as e:
            log.warning(f"Serial error: {e}. Retrying in {retry_delay}s…")
            arduino = None
            # Tell clients we lost connection
            latest_telemetry = {**latest_telemetry, "connected": False}
            if connected_clients:
                websockets.broadcast(connected_clients, json.dumps(latest_telemetry))
            await asyncio.sleep(retry_delay)
            retry_delay = min(retry_delay * 1.5, 30.0)

# ── WebSocket handler ─────────────────────────────────────────────────────────
async def ws_handler(websocket):
    """Handle a single WebSocket client connection."""
    connected_clients.add(websocket)
    client_addr = websocket.remote_address
    log.info(f"Client connected: {client_addr}  (total: {len(connected_clients)})")

    # Send latest known state immediately on connect
    if latest_telemetry:
        await websocket.send(json.dumps(latest_telemetry))
    else:
        await websocket.send(json.dumps({"connected": False, "ts": time.time()}))

    try:
        async for message in websocket:
            await handle_command(message)
    except websockets.exceptions.ConnectionClosedOK:
        pass
    except websockets.exceptions.ConnectionClosedError as e:
        log.debug(f"Client disconnected with error: {e}")
    finally:
        connected_clients.discard(websocket)
        log.info(f"Client disconnected: {client_addr}  (total: {len(connected_clients)})")

# ── Command dispatcher ────────────────────────────────────────────────────────
async def handle_command(message: str):
    """Parse a JSON command from the UI and forward to Arduino."""
    global arduino
    try:
        cmd = json.loads(message)
    except json.JSONDecodeError:
        log.warning(f"Bad command JSON: {message!r}")
        return

    action = cmd.get("cmd", "")

    # Brightness control handled on Pi side (no need to send to Arduino)
    if action == "setBacklight":
        level = cmd.get("level", BACKLIGHT_FULL)
        set_backlight(int(level))
        log.info(f"Backlight → {level}")
        return

    # Everything else goes to Arduino
    if arduino and arduino.is_open:
        payload = json.dumps(cmd) + "\n"
        try:
            arduino.write(payload.encode("utf-8"))
            log.debug(f"→ Arduino: {payload.strip()}")
        except serial.SerialException as e:
            log.error(f"Failed to write to Arduino: {e}")
    else:
        log.warning(f"Command dropped (Arduino not connected): {cmd}")

# ── Heartbeat ─────────────────────────────────────────────────────────────────
async def heartbeat():
    """Send a keepalive ping to all clients every 5 seconds."""
    while True:
        await asyncio.sleep(5)
        if connected_clients and latest_telemetry:
            websockets.broadcast(connected_clients, json.dumps({
                **latest_telemetry,
                "ts": time.time(),
            }))

# ── Main ──────────────────────────────────────────────────────────────────────
async def main(serial_port: str, baud: int, ws_port: int):
    log.info("=== Van Control Bridge starting ===")
    set_backlight(BACKLIGHT_FULL)

    # Start serial reader in background
    asyncio.create_task(serial_reader(serial_port, baud))
    asyncio.create_task(heartbeat())

    # Start WebSocket server
    log.info(f"WebSocket server on ws://0.0.0.0:{ws_port}")
    async with serve(ws_handler, WS_HOST, ws_port):
        log.info("Ready. Waiting for connections…")
        await asyncio.Future()  # run forever

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Van Control Serial Bridge")
    parser.add_argument("--port", default=None, help="Serial port (auto-detected if not set)")
    parser.add_argument("--baud", type=int, default=SERIAL_BAUD, help="Baud rate")
    parser.add_argument("--ws-port", type=int, default=WS_PORT, help="WebSocket port")
    args = parser.parse_args()

    port = args.port or find_arduino_port()
    if not port:
        log.warning("No Arduino port found — running in UI-only mode (no serial data)")
        port = "/dev/ttyACM0"  # Will retry once available

    try:
        asyncio.run(main(port, args.baud, args.ws_port))
    except KeyboardInterrupt:
        log.info("Bridge stopped.")
