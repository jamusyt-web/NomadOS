import React, { createContext, useContext, useEffect, useState } from 'react';

export type LightingZone = {
  id: string;
  name: string;
  isOn: boolean;
  brightness: number; // 0-100
  isWarm: boolean;
  hasColor: boolean;  // true = RGB zone (ESP-32 controlled)
  hue: number;        // 0-360, only used when hasColor = true
};

export type SimulationState = {
  battery: {
    soc: number;
    voltage: number;
    tempF: number;
    currentAmps: number;
    timeRemainingHrs: number;
  };
  solar: {
    inputWatts: number;
    voltage: number;
    yieldWhToday: number;
  };
  inverter: {
    isOn: boolean;
    outputVoltage: number;
    loadWatts: number;
  };
  climate: {
    fridgeTemp: number;
    fridgeTarget: number;
    fridgeCompressorOn: boolean;
    indoorTempF: number;
    outdoorTempF: number;
    fanSpeed: 'off' | 'low' | 'medium' | 'high';
  };
  lights: LightingZone[];
  alerts: string[];
};

type SimulationContextType = {
  state: SimulationState;
  toggleLight: (id: string) => void;
  setLightBrightness: (id: string, brightness: number) => void;
  setLightColor: (id: string, hue: number) => void;
  toggleLightWarmth: (id: string) => void;
  turnAllLightsOff: () => void;
  toggleInverter: () => void;
  setFridgeTarget: (temp: number) => void;
  setFanSpeed: (speed: 'off' | 'low' | 'medium' | 'high') => void;
};

const INITIAL_STATE: SimulationState = {
  battery: {
    soc: 78,
    voltage: 13.2,
    tempF: 42,
    currentAmps: 12.4,
    timeRemainingHrs: 18.5,
  },
  solar: {
    inputWatts: 187,
    voltage: 18.4,
    yieldWhToday: 940,
  },
  inverter: {
    isOn: false,
    outputVoltage: 120,
    loadWatts: 0,
  },
  climate: {
    fridgeTemp: 39,
    fridgeTarget: 38,
    fridgeCompressorOn: true,
    indoorTempF: 68,
    outdoorTempF: 45,
    fanSpeed: 'off',
  },
  lights: [
    { id: 'cab',    name: 'Cab Lights',      isOn: false, brightness: 100, isWarm: true,  hasColor: true,  hue: 38  },
    { id: 'living', name: 'Living Area',     isOn: false, brightness: 80,  isWarm: true,  hasColor: false, hue: 38  },
    { id: 'bed',    name: 'Bed Area',        isOn: false, brightness: 50,  isWarm: true,  hasColor: false, hue: 38  },
    { id: 'desk',   name: 'Work Desk',       isOn: false, brightness: 100, isWarm: false, hasColor: false, hue: 200 },
    { id: 'awning', name: 'Exterior/Awning', isOn: false, brightness: 100, isWarm: true,  hasColor: false, hue: 38  },
  ],
  alerts: [],
};

const SimulationContext = createContext<SimulationContextType | null>(null);

export function SimulationProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<SimulationState>(INITIAL_STATE);

  // Fluctuation effect
  useEffect(() => {
    const interval = setInterval(() => {
      setState((prev) => {
        const next = { ...prev };

        const solarJitter = (Math.random() - 0.5) * 15;
        next.solar.inputWatts = Math.max(0, Math.min(400, prev.solar.inputWatts + solarJitter));
        next.solar.voltage = 18.0 + (Math.random() * 1.5);

        if (next.solar.inputWatts > 0) {
          next.solar.yieldWhToday += (next.solar.inputWatts / 3600) * 3;
        }

        let baseLoad = 15;
        if (next.inverter.isOn) baseLoad += 25;
        const lightsLoad = prev.lights.filter(l => l.isOn).reduce((acc, l) => acc + (l.brightness * 0.2), 0);
        baseLoad += lightsLoad;
        if (next.climate.fridgeCompressorOn) baseLoad += 45;
        if (next.climate.fanSpeed === 'low') baseLoad += 15;
        if (next.climate.fanSpeed === 'medium') baseLoad += 30;
        if (next.climate.fanSpeed === 'high') baseLoad += 60;

        next.inverter.loadWatts = next.inverter.isOn ? 45 : 0;

        const solarAmps = next.solar.inputWatts / 13.2;
        const loadAmps = baseLoad / 13.2;
        next.battery.currentAmps = Number((solarAmps - loadAmps).toFixed(1));
        next.battery.voltage = 13.2 + (next.battery.currentAmps * 0.01) + (Math.random() - 0.5) * 0.05;

        if (next.climate.fridgeCompressorOn) {
          next.climate.fridgeTemp -= 0.1;
          if (next.climate.fridgeTemp <= next.climate.fridgeTarget - 1) {
            next.climate.fridgeCompressorOn = false;
          }
        } else {
          next.climate.fridgeTemp += 0.05;
          if (next.climate.fridgeTemp >= next.climate.fridgeTarget + 2) {
            next.climate.fridgeCompressorOn = true;
          }
        }

        return next;
      });
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  const toggleLight = (id: string) =>
    setState(prev => ({ ...prev, lights: prev.lights.map(l => l.id === id ? { ...l, isOn: !l.isOn } : l) }));

  const setLightBrightness = (id: string, brightness: number) =>
    setState(prev => ({ ...prev, lights: prev.lights.map(l => l.id === id ? { ...l, brightness } : l) }));

  const setLightColor = (id: string, hue: number) =>
    setState(prev => ({ ...prev, lights: prev.lights.map(l => l.id === id ? { ...l, hue } : l) }));

  const toggleLightWarmth = (id: string) =>
    setState(prev => ({ ...prev, lights: prev.lights.map(l => l.id === id ? { ...l, isWarm: !l.isWarm } : l) }));

  const turnAllLightsOff = () =>
    setState(prev => ({ ...prev, lights: prev.lights.map(l => ({ ...l, isOn: false })) }));

  const toggleInverter = () =>
    setState(prev => ({ ...prev, inverter: { ...prev.inverter, isOn: !prev.inverter.isOn } }));

  const setFridgeTarget = (temp: number) =>
    setState(prev => ({ ...prev, climate: { ...prev.climate, fridgeTarget: Math.max(34, Math.min(50, temp)) } }));

  const setFanSpeed = (speed: 'off' | 'low' | 'medium' | 'high') =>
    setState(prev => ({ ...prev, climate: { ...prev.climate, fanSpeed: speed } }));

  return (
    <SimulationContext.Provider value={{
      state, toggleLight, setLightBrightness, setLightColor,
      toggleLightWarmth, turnAllLightsOff, toggleInverter, setFridgeTarget, setFanSpeed,
    }}>
      {children}
    </SimulationContext.Provider>
  );
}

export function useSimulatedData() {
  const context = useContext(SimulationContext);
  if (!context) throw new Error('useSimulatedData must be used within a SimulationProvider');
  return context;
}

/** Convert a hue (0-360) to RGB (0-255 each) at full saturation */
export function hueToRgb(hue: number): [number, number, number] {
  const h = hue / 360;
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  const q = 0.5 * (1 + 1); // l=0.5, s=1 → q = 1
  const p = 2 * 0.5 - q;   // p = 0
  return [
    Math.round(hue2rgb(p, q, h + 1 / 3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1 / 3) * 255),
  ];
}
