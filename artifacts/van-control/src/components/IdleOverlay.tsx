import { useEffect, useState } from "react";
import { useIdleMode } from "@/hooks/useIdleMode";
import { useSimulatedData } from "@/hooks/useSimulatedData";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";

export function IdleOverlay() {
  const { idleState, wake } = useIdleMode();
  const { state } = useSimulatedData();
  const [time, setTime] = useState(new Date());

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  return (
    <AnimatePresence>
      {idleState === "idle" && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 1.2 }}
          onClick={wake}
          onTouchStart={wake}
          className="absolute inset-0 z-[999] bg-[#04040A] flex flex-col items-center justify-center cursor-pointer select-none"
          data-testid="idle-overlay"
        >
          {/* Time */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3, duration: 0.8 }}
            className="font-mono text-[120px] font-thin text-white/80 leading-none tracking-tight"
          >
            {format(time, "HH:mm")}
          </motion.div>

          {/* Date */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="text-white/30 text-lg font-light tracking-widest uppercase mt-3"
          >
            {format(time, "EEEE, MMMM d")}
          </motion.div>

          {/* Key stats row */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.8 }}
            className="flex items-center gap-10 mt-12"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-[#E8B84B] text-2xl font-semibold">{state.battery.soc.toFixed(0)}%</span>
              <span className="text-white/25 text-xs tracking-widest uppercase">Battery</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[#3ECFCF] text-2xl font-semibold">{Math.round(state.solar.inputWatts)}W</span>
              <span className="text-white/25 text-xs tracking-widest uppercase">Solar</span>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-white/60 text-2xl font-semibold">{state.climate.indoorTempF.toFixed(0)}°F</span>
              <span className="text-white/25 text-xs tracking-widest uppercase">Inside</span>
            </div>
          </motion.div>

          {/* Tap to wake hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.3, 0] }}
            transition={{ delay: 2, duration: 3, repeat: Infinity, repeatDelay: 4 }}
            className="absolute bottom-10 text-white/20 text-xs tracking-widest uppercase"
          >
            Tap to wake
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
