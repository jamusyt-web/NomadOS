import { useEffect, useState } from "react";
import { useSimulatedData } from "@/hooks/useSimulatedData";
import { useHardware } from "@/hooks/useHardware";
import { useVanName } from "@/hooks/useVanName";
import { format } from "date-fns";
import { Wifi, WifiOff, Cpu } from "lucide-react";

export function TopBar() {
  const { state } = useSimulatedData();
  const { status, mode } = useHardware();
  const { vanName } = useVanName();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const isConnected = status === "connected";
  const isConnecting = status === "connecting";
  const isElectron = mode === "electron";

  const displayName = vanName || "NOMAD";

  return (
    <div
      className="h-10 w-full flex items-center justify-between px-6 bg-background/90 backdrop-blur-sm z-50 relative"
      style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}
    >
      {/* Left — van name + outdoor temp */}
      <div className="flex items-center gap-4 min-w-[200px]">
        <span className="text-sm font-semibold tracking-[0.18em] text-foreground/90 uppercase">
          {displayName}
        </span>
        <span className="text-white/20 text-xs">|</span>
        <span className="text-xs text-muted-foreground font-medium">
          {state.climate.outdoorTempF.toFixed(0)}°F
        </span>
      </div>

      {/* Center — clock */}
      <div className="font-mono text-base font-medium text-foreground/95 tracking-widest tabular-nums">
        {format(time, "HH:mm")}
      </div>

      {/* Right — status */}
      <div className="flex items-center gap-3 min-w-[200px] justify-end">
        {state.alerts.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-[10px] font-bold tracking-wider uppercase animate-pulse">
            {state.alerts.length} Alert{state.alerts.length > 1 ? "s" : ""}
          </span>
        )}

        {/* Connection indicator */}
        <div className="flex items-center gap-1.5" data-testid="connection-status">
          {isConnected && isElectron ? (
            <>
              <Cpu size={13} className="text-accent" />
              <span className="text-[10px] text-accent font-medium tracking-wider">LIVE</span>
            </>
          ) : isConnected ? (
            <>
              <Wifi size={13} className="text-accent" />
              <span className="text-[10px] text-accent font-medium tracking-wider">LIVE</span>
            </>
          ) : isConnecting ? (
            <>
              <Wifi size={13} className="text-muted-foreground animate-pulse" />
              <span className="text-[10px] text-muted-foreground tracking-wider">SYNC</span>
            </>
          ) : (
            <>
              <WifiOff size={13} className="text-muted-foreground/50" />
              <span className="text-[10px] text-muted-foreground/50 tracking-wider">SIM</span>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
