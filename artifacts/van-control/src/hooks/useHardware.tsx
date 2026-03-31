/**
 * useHardware — WebSocket connection to the Raspberry Pi serial bridge.
 * 
 * When the bridge (pi_bridge.py) is running on the Pi at ws://localhost:8765,
 * this hook feeds real Arduino sensor data into the app state.
 * 
 * When NOT connected (e.g. during development on a laptop), it
 * transparently falls back to the simulated data from useSimulatedData.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { SimulationState } from "./useSimulatedData";

const WS_URL = "ws://localhost:8765";
const RECONNECT_DELAY_MS = 3000;

export type ConnectionStatus = "connected" | "disconnected" | "connecting";

export type HardwareContextType = {
  status: ConnectionStatus;
  hardwareState: Partial<HardwarePayload> | null;
  sendCommand: (cmd: object) => void;
  setBacklight: (level: number) => void;
};

/** Raw payload shape from the Arduino/bridge */
export type HardwarePayload = {
  bat_v: number;
  bat_a: number;
  bat_soc: number;
  solar_v: number;
  solar_w: number;
  yield_wh: number;
  temp_f: number;
  lights: number[];      // [0|1, 0|1, 0|1, 0|1, 0|1]
  brightness: number[];  // [0-100, ...]
  inverter: boolean;
  connected: boolean;
  ts: number;
};

const HardwareContext = createContext<HardwareContextType | null>(null);

export function HardwareProvider({ children }: { children: React.ReactNode }) {
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [hardwareState, setHardwareState] = useState<Partial<HardwarePayload> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    setStatus("connecting");
    const ws = new WebSocket(WS_URL);
    wsRef.current = ws;

    ws.onopen = () => {
      setStatus("connected");
      if (retryRef.current) clearTimeout(retryRef.current);
    };

    ws.onmessage = (event) => {
      try {
        const data: HardwarePayload = JSON.parse(event.data);
        setHardwareState(data);
        if (data.connected === false) setStatus("disconnected");
      } catch {
        // ignore malformed
      }
    };

    ws.onerror = () => {
      setStatus("disconnected");
    };

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      retryRef.current = setTimeout(connect, RECONNECT_DELAY_MS);
    };
  }, []);

  useEffect(() => {
    connect();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connect]);

  const sendCommand = useCallback((cmd: object) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, []);

  const setBacklight = useCallback((level: number) => {
    sendCommand({ cmd: "setBacklight", level: Math.round(level) });
  }, [sendCommand]);

  return (
    <HardwareContext.Provider value={{ status, hardwareState, sendCommand, setBacklight }}>
      {children}
    </HardwareContext.Provider>
  );
}

export function useHardware() {
  const ctx = useContext(HardwareContext);
  if (!ctx) throw new Error("useHardware must be used within HardwareProvider");
  return ctx;
}

/**
 * Merge hardware readings into simulated state.
 * When hardware data is available, real values override simulated ones.
 * This lets you always call useSimulatedData() regardless of connection.
 */
export function mergeHardwareIntoState(
  sim: SimulationState,
  hw: Partial<HardwarePayload> | null
): SimulationState {
  if (!hw || !hw.connected) return sim;

  const lights = sim.lights.map((zone, i) => ({
    ...zone,
    isOn: hw.lights ? hw.lights[i] === 1 : zone.isOn,
    brightness: hw.brightness ? hw.brightness[i] : zone.brightness,
  }));

  return {
    ...sim,
    battery: {
      ...sim.battery,
      voltage: hw.bat_v ?? sim.battery.voltage,
      currentAmps: hw.bat_a ?? sim.battery.currentAmps,
      soc: hw.bat_soc ?? sim.battery.soc,
    },
    solar: {
      ...sim.solar,
      inputWatts: hw.solar_w ?? sim.solar.inputWatts,
      voltage: hw.solar_v ?? sim.solar.voltage,
      yieldWhToday: hw.yield_wh ?? sim.solar.yieldWhToday,
    },
    inverter: {
      ...sim.inverter,
      isOn: hw.inverter ?? sim.inverter.isOn,
    },
    climate: {
      ...sim.climate,
      indoorTempF: hw.temp_f ?? sim.climate.indoorTempF,
    },
    lights,
  };
}
