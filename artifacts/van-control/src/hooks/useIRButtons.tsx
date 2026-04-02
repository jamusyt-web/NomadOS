/**
 * useIRButtons — persists learned IR remote buttons.
 *
 * In Electron (Pi): reads/writes ~/van-control-ir.json via IPC.
 * In browser (dev): falls back to localStorage.
 */

import { useEffect, useState, useCallback } from 'react';

export type IRDevice = 'heat' | 'ac';

export type IRButton = {
  id: string;
  label: string;
  device: IRDevice;
  data: number[];
};

const STORAGE_KEY = 'nomadOS_irButtons';

function loadLocal(): IRButton[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function saveLocal(buttons: IRButton[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(buttons));
  } catch {}
}

export function useIRButtons() {
  const [buttons, setButtons] = useState<IRButton[]>([]);
  const [loaded, setLoaded] = useState(false);
  const isElectron = typeof window !== 'undefined' && !!window.vanAPI;

  useEffect(() => {
    (async () => {
      if (isElectron && window.vanAPI?.readIRButtons) {
        const data = await window.vanAPI.readIRButtons();
        setButtons(Array.isArray(data) ? data : []);
      } else {
        setButtons(loadLocal());
      }
      setLoaded(true);
    })();
  }, [isElectron]);

  useEffect(() => {
    if (!loaded) return;
    if (isElectron && window.vanAPI?.writeIRButtons) {
      window.vanAPI.writeIRButtons(buttons);
    } else {
      saveLocal(buttons);
    }
  }, [buttons, loaded, isElectron]);

  const addButton = useCallback((btn: Omit<IRButton, 'id'>) => {
    const newBtn: IRButton = {
      ...btn,
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    };
    setButtons(prev => [...prev, newBtn]);
  }, []);

  const removeButton = useCallback((id: string) => {
    setButtons(prev => prev.filter(b => b.id !== id));
  }, []);

  const getButtons = useCallback(
    (device: IRDevice) => buttons.filter(b => b.device === device),
    [buttons]
  );

  return { addButton, removeButton, getButtons };
}
