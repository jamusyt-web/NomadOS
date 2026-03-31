import { useEffect, useState } from "react";
import { useSimulatedData } from "@/hooks/useSimulatedData";
import { format } from "date-fns";
import { Wifi, SignalHigh } from "lucide-react";

export function TopBar() {
  const { state } = useSimulatedData();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-12 w-full flex items-center justify-between px-6 bg-background border-b border-border/50 text-muted-foreground z-50 relative">
      <div className="flex items-center gap-4">
        <span className="text-lg font-bold text-foreground tracking-wider uppercase">NOMAD</span>
        <div className="h-4 w-px bg-border"></div>
        <div className="flex flex-col">
          <span className="text-xs font-semibold leading-none">{state.climate.outdoorTempF}°F OUT</span>
        </div>
      </div>

      <div className="flex items-center justify-center font-mono text-xl font-bold text-foreground">
        {format(time, "HH:mm")}
      </div>

      <div className="flex items-center gap-4">
        {state.alerts.length > 0 && (
          <span className="px-2 py-0.5 rounded-full bg-destructive/20 text-destructive text-xs font-bold animate-pulse">
            {state.alerts.length} ALERTS
          </span>
        )}
        <Wifi size={18} />
        <SignalHigh size={18} />
      </div>
    </div>
  );
}
