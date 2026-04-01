/**
 * useHardware — Hardware connection layer.
 *
 * Supports two connection modes automatically:
 *
 *  1. Electron (Raspberry Pi)
 *     When running inside Electron, uses window.vanAPI (IPC) to receive
 *     live Arduino telemetry directly — no Python bridge needed.
 *
 *  2. Browser (development / web)
 *     Falls back to WebSocket (ws://localhost:8765) to connect to the
 *     Python pi_bridge.py script if running in a plain browser.
 *
 *  3. Simulated (offline)
 *     When neither is available, the app runs on simulated data from
 *     useSimulatedData — transparent to the rest of the app.
 */

import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import type { SimulationState } from "./useSimulatedData";

// ── Electron API type (injected by preload.mjs) ───────────────────────────────
declare global {
  interface Window {
    vanAPI?: {
      onTelemetry: (cb: (data: HardwarePayload) => void) => () => void;
      onStatus: (cb: (status: { connected: boolean; port?: string; error?: string }) => void) => () => void;
      sendCommand: (cmd: object) => void;
      setBacklight: (level: number) => void;
    };
  }
}

const WS_URL = "ws://localhost:8765";
const RECONNECT_DELAY_MS = 3000;

export type ConnectionStatus = "connected" | "disconnected" | "connecting";
export type ConnectionMode = "electron" | "websocket" | "simulated";

export type HardwareContextType = {
  status: ConnectionStatus;
  mode: ConnectionMode;
  hardwareState: Partial<HardwarePayload> | null;
  sendCommand: (cmd: object) => void;
  setBacklight: (level: number) => void;
};

export type HardwarePayload = {
  bat_v: number;
  bat_a: number;
  bat_soc: number;
  solar_v: number;
  solar_w: number;
  yield_wh: number;
  temp_f: number;
  lights: number[];
  brightness: number[];
  inverter: boolean;
  connected: boolean;
  ts: number;
};

const HardwareContext = createContext<HardwareContextType | null>(null);

export function HardwareProvider({ children }: { children: React.ReactNode }) {
  const isElectron = typeof window !== "undefined" && !!window.vanAPI;
  const mode: ConnectionMode = isElectron ? "electron" : "websocket";

  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [hardwareState, setHardwareState] = useState<Partial<HardwarePayload> | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const retryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Electron IPC mode ───────────────────────────────────────────────────────
  useEffect(() => {
    if (!isElectron || !window.vanAPI) return;

    setStatus("connecting");

    const unsubTelemetry = window.vanAPI.onTelemetry((data) => {
      setHardwareState(data);
      setStatus(data.connected ? "connected" : "disconnected");
    });

    const unsubStatus = window.vanAPI.onStatus((s) => {
      setStatus(s.connected ? "connected" : "disconnected");
    });

    return () => {
      unsubTelemetry();
      unsubStatus();
    };
  }, [isElectron]);

  // ── WebSocket mode (browser fallback) ────────────────────────────────────────
  const connectWs = useCallback(() => {
    if (isElectron) return;
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
      } catch { /* ignore */ }
    };

    ws.onerror = () => setStatus("disconnected");

    ws.onclose = () => {
      setStatus("disconnected");
      wsRef.current = null;
      retryRef.current = setTimeout(connectWs, RECONNECT_DELAY_MS);
    };
  }, [isElectron]);

  useEffect(() => {
    if (isElectron) return;
    connectWs();
    return () => {
      if (retryRef.current) clearTimeout(retryRef.current);
      wsRef.current?.close();
    };
  }, [connectWs, isElectron]);

  // ── Commands ─────────────────────────────────────────────────────────────────
  const sendCommand = useCallback((cmd: object) => {
    if (isElectron && window.vanAPI) {
      window.vanAPI.sendCommand(cmd);
    } else if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(cmd));
    }
  }, [isElectron]);

  const setBacklight = useCallback((level: number) => {
    if (isElectron && window.vanAPI) {
      window.vanAPI.setBacklight(Math.round(level));
    } else {
      sendCommand({ cmd: "setBacklight", level: Math.round(level) });
    }
  }, [isElectron, sendCommand]);

  return (
    <HardwareContext.Provider value={{ status, mode, hardwareState, sendCommand, setBacklight }}>
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
 * Merge real hardware readings over simulated state.
 * When hardware is connected, real values override simulated ones.
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
