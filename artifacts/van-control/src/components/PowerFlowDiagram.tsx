import { motion } from "framer-motion";
import { Sun, Battery, Zap } from "lucide-react";
import { useSimulatedData } from "@/hooks/useSimulatedData";

export function PowerFlowDiagram() {
  const { state } = useSimulatedData();
  const { solar, battery, inverter } = state;

  const isCharging = battery.currentAmps > 0;
  const isSolarActive = solar.inputWatts > 5;
  const isDischarging = battery.currentAmps < 0;

  return (
    <div className="flex items-center justify-between w-full max-w-lg mx-auto py-6 px-4">
      {/* Solar Node */}
      <div className="flex flex-col items-center gap-2">
        <div className={`p-4 rounded-full border-2 flex items-center justify-center ${isSolarActive ? 'border-primary text-primary bg-primary/10 shadow-[0_0_20px_hsla(var(--primary),0.3)]' : 'border-muted text-muted-foreground'}`}>
          <Sun size={32} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">SOLAR</span>
        <span className="text-sm font-bold">{solar.inputWatts.toFixed(0)}W</span>
      </div>

      {/* Path: Solar to Battery */}
      <div className="flex-1 relative h-2 mx-4 bg-muted/30 rounded-full overflow-hidden flex items-center">
        {isSolarActive && (
          <motion.div 
            className="h-full bg-primary"
            initial={{ width: "0%", left: "0%" }}
            animate={{ 
              width: ["0%", "30%", "0%"],
              left: ["0%", "70%", "100%"]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.5,
              ease: "linear"
            }}
            style={{ position: 'absolute' }}
          />
        )}
      </div>

      {/* Battery Node */}
      <div className="flex flex-col items-center gap-2">
        <div className={`p-4 rounded-full border-2 flex items-center justify-center ${isCharging ? 'border-primary text-primary bg-primary/10' : isDischarging ? 'border-accent text-accent bg-accent/10' : 'border-muted text-foreground'}`}>
          <Battery size={32} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">BATTERY</span>
        <span className="text-sm font-bold">{battery.soc.toFixed(0)}%</span>
      </div>

      {/* Path: Battery to Load */}
      <div className="flex-1 relative h-2 mx-4 bg-muted/30 rounded-full overflow-hidden flex items-center">
        {isDischarging && (
          <motion.div 
            className="h-full bg-accent"
            initial={{ width: "0%", left: "0%" }}
            animate={{ 
              width: ["0%", "30%", "0%"],
              left: ["0%", "70%", "100%"]
            }}
            transition={{ 
              repeat: Infinity, 
              duration: 1.5,
              ease: "linear"
            }}
            style={{ position: 'absolute' }}
          />
        )}
      </div>

      {/* Loads Node */}
      <div className="flex flex-col items-center gap-2">
        <div className={`p-4 rounded-full border-2 flex items-center justify-center ${isDischarging ? 'border-accent text-accent bg-accent/10 shadow-[0_0_20px_hsla(var(--accent),0.3)]' : 'border-muted text-muted-foreground'}`}>
          <Zap size={32} />
        </div>
        <span className="text-xs font-semibold text-muted-foreground">LOADS</span>
        <span className="text-sm font-bold">{Math.abs(battery.currentAmps * 13.2).toFixed(0)}W</span>
      </div>
    </div>
  );
}
