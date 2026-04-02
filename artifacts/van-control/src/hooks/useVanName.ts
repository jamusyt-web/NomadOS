import { createContext, useContext, useState, useCallback, useRef } from "react";

const STORAGE_KEY = "nomados:van-name";

function readStored(): string {
  try {
    return localStorage.getItem(STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export interface VanNameContextValue {
  vanName: string;
  setVanName: (name: string) => void;
}

export const VanNameContext = createContext<VanNameContextValue>({
  vanName: "",
  setVanName: () => {},
});

export function useVanNameState(): VanNameContextValue {
  const [vanName, setVanNameState] = useState<string>(readStored);

  const setVanName = useCallback((name: string) => {
    const trimmed = name.trim();
    setVanNameState(trimmed);
    try {
      if (trimmed) {
        localStorage.setItem(STORAGE_KEY, trimmed);
      } else {
        localStorage.removeItem(STORAGE_KEY);
      }
    } catch {}
  }, []);

  return { vanName, setVanName };
}

export function useVanName(): VanNameContextValue {
  return useContext(VanNameContext);
}

export function useVanNameEditor() {
  const { vanName, setVanName } = useVanName();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const committedRef = useRef(false);

  const openEdit = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.stopPropagation();
    committedRef.current = false;
    setDraft(vanName);
    setEditing(true);
  }, [vanName]);

  const commitEdit = useCallback((currentDraft: string) => {
    if (committedRef.current) return;
    committedRef.current = true;
    setVanName(currentDraft);
    setEditing(false);
  }, [setVanName]);

  const cancelEdit = useCallback(() => {
    committedRef.current = true;
    setEditing(false);
  }, []);

  return { vanName, editing, draft, setDraft, openEdit, commitEdit, cancelEdit };
}
