import { useEffect, useRef, useState } from "react";
import { useIdleMode } from "@/hooks/useIdleMode";
import { useSimulatedData } from "@/hooks/useSimulatedData";
import { useVanNameEditor } from "@/hooks/useVanName";
import { format } from "date-fns";
import { motion, AnimatePresence } from "framer-motion";
import { Pencil, Check } from "lucide-react";

export function IdleOverlay() {
  const { idleState, wake } = useIdleMode();
  const { state } = useSimulatedData();
  const { vanName, editing, draft, setDraft, openEdit, commitEdit, cancelEdit } = useVanNameEditor();
  const [time, setTime] = useState(new Date());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const t = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const stopProp = (e: React.MouseEvent | React.TouchEvent | React.KeyboardEvent) => {
    e.stopPropagation();
  };

  const displayName = vanName || "your van";

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
          className="gpu-layer absolute inset-0 z-[999] bg-[#04040A] flex flex-col items-center justify-center cursor-pointer select-none overflow-hidden"
          data-testid="idle-overlay"
        >
          {/* Ambient glow behind the van name */}
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[280px] rounded-full pointer-events-none"
            style={{
              background: "radial-gradient(ellipse at center, rgba(232,184,75,0.07) 0%, transparent 70%)",
              filter: "blur(32px)",
            }}
          />

          {/* NOMAD OS wordmark */}
          <motion.div
            initial={{ y: -10, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.9 }}
            className="gpu-layer flex flex-col items-center gap-1.5"
          >
            <span className="text-[11px] tracking-[0.55em] text-white/20 uppercase font-light">
              N &nbsp; O &nbsp; M &nbsp; A &nbsp; D &nbsp; O &nbsp; S
            </span>
            <div
              className="h-px w-16 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(232,184,75,0.5), transparent)" }}
            />
          </motion.div>

          {/* Welcome to + van name */}
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.9 }}
            className="gpu-layer flex flex-col items-center mt-6 mb-1"
            onClick={stopProp}
            onTouchStart={stopProp}
          >
            <span className="text-[10px] tracking-[0.4em] text-white/25 uppercase font-light mb-3">
              Welcome to
            </span>

            {editing ? (
              <div
                className="flex items-center gap-3"
                onClick={stopProp}
                onTouchStart={stopProp}
              >
                <input
                  ref={inputRef}
                  value={draft}
                  onChange={e => setDraft(e.target.value)}
                  onKeyDown={e => {
                    e.stopPropagation();
                    if (e.key === "Enter") commitEdit(draft);
                    if (e.key === "Escape") cancelEdit();
                  }}
                  onBlur={() => commitEdit(draft)}
                  placeholder="Name your van…"
                  maxLength={32}
                  className="bg-transparent border-b border-[#E8B84B]/60 text-[#E8B84B] text-3xl text-center outline-none placeholder:text-white/20 w-64 pb-1"
                  style={{ fontFamily: "var(--app-font-display)" }}
                  data-testid="van-name-input"
                />
                <button
                  onClick={e => { e.stopPropagation(); commitEdit(draft); }}
                  onTouchStart={e => e.stopPropagation()}
                  className="text-[#E8B84B]/70 hover:text-[#E8B84B] transition-colors"
                  data-testid="btn-save-van-name"
                >
                  <Check size={20} />
                </button>
              </div>
            ) : (
              <div className="flex items-center gap-3 group">
                <span
                  className="font-display text-[42px] leading-tight tracking-wider text-white/90"
                  style={{ fontFamily: "var(--app-font-display)" }}
                  data-testid="van-name-display"
                >
                  {displayName}
                </span>
                <button
                  onClick={openEdit}
                  onTouchStart={openEdit}
                  className="text-white/20 hover:text-white/50 transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 ml-1 mt-1"
                  aria-label="Edit van name"
                  data-testid="btn-edit-van-name"
                >
                  <Pencil size={16} />
                </button>
              </div>
            )}
          </motion.div>

          {/* Clock */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="gpu-layer font-mono text-[100px] font-thin text-white/75 leading-none tracking-tight mt-6"
          >
            {format(time, "HH:mm")}
          </motion.div>

          {/* Date */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.8 }}
            className="gpu-layer text-white/25 text-sm font-light tracking-[0.3em] uppercase mt-2"
          >
            {format(time, "EEEE, MMMM d")}
          </motion.div>

          {/* Key stats row */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="gpu-layer flex items-center gap-10 mt-10"
          >
            <div className="flex flex-col items-center gap-1">
              <span className="text-[#E8B84B] text-xl font-semibold tabular-nums">
                {state.battery.soc.toFixed(0)}%
              </span>
              <span className="text-white/20 text-[10px] tracking-widest uppercase">Battery</span>
            </div>
            <div className="w-px h-7 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-[#3ECFCF] text-xl font-semibold tabular-nums">
                {Math.round(state.solar.inputWatts)}W
              </span>
              <span className="text-white/20 text-[10px] tracking-widest uppercase">Solar</span>
            </div>
            <div className="w-px h-7 bg-white/10" />
            <div className="flex flex-col items-center gap-1">
              <span className="text-white/55 text-xl font-semibold tabular-nums">
                {state.climate.indoorTempF.toFixed(0)}°F
              </span>
              <span className="text-white/20 text-[10px] tracking-widest uppercase">Inside</span>
            </div>
          </motion.div>

          {/* Tap to wake hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.28, 0] }}
            transition={{ delay: 2.5, duration: 3, repeat: Infinity, repeatDelay: 5 }}
            className="gpu-layer absolute bottom-8 text-white/20 text-[10px] tracking-[0.35em] uppercase"
          >
            Tap to wake
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
