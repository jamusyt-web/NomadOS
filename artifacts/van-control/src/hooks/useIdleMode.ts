/**
 * useIdleMode — Detects user inactivity and triggers low-power idle state.
 * 
 * After IDLE_TIMEOUT_MS of no touch/mouse/key activity:
 *   - App fades to a minimal clock display
 *   - Sends backlight dim command to the Pi bridge
 * 
 * On any activity:
 *   - Restores full UI
 *   - Sends backlight restore command
 */

import { useEffect, useRef, useState, useCallback } from "react";
import { useHardware } from "./useHardware";

// In dev mode, pass ?idle=1 in the URL to instantly enter idle mode (for testing / demo)
const IDLE_TIMEOUT_MS =
  typeof window !== "undefined" &&
  import.meta.env.DEV &&
  new URLSearchParams(window.location.search).has("idle")
    ? 200
    : 60_000; // 60 seconds

const BACKLIGHT_DIM  = 15;      // ~6%  — barely visible
const BACKLIGHT_FULL = 200;     // ~78% — normal use

export type IdleState = "active" | "idle";

export function useIdleMode() {
  const [idleState, setIdleState] = useState<IdleState>("active");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { setBacklight } = useHardware();

  const goIdle = useCallback(() => {
    setIdleState("idle");
    setBacklight(BACKLIGHT_DIM);
  }, [setBacklight]);

  const wake = useCallback(() => {
    if (idleState === "idle") {
      setBacklight(BACKLIGHT_FULL);
    }
    setIdleState("active");

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);
  }, [idleState, goIdle, setBacklight]);

  useEffect(() => {
    const events = ["touchstart", "touchmove", "mousedown", "mousemove", "keydown", "click"];
    events.forEach(e => window.addEventListener(e, wake, { passive: true }));

    // Start the initial timer
    timerRef.current = setTimeout(goIdle, IDLE_TIMEOUT_MS);

    return () => {
      events.forEach(e => window.removeEventListener(e, wake));
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [wake, goIdle]);

  return { idleState, wake };
}
