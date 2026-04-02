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
          {/* Wide ambient glow — centered behind the whole block */}
          <div
            aria-hidden
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
            style={{
              width: 700,
              height: 380,
              background: "radial-gradient(ellipse at center, rgba(232,184,75,0.09) 0%, rgba(232,184,75,0.03) 45%, transparent 70%)",
              filter: "blur(48px)",
            }}
          />

          {/* ── NOMAD OS wordmark ── */}
          <motion.div
            initial={{ y: -8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.9 }}
            className="gpu-layer flex flex-col items-center gap-2"
          >
            <span className="text-[10px] tracking-[0.6em] text-white/18 uppercase font-light">
              N &nbsp; O &nbsp; M &nbsp; A &nbsp; D &nbsp; O &nbsp; S
            </span>
            <div
              className="h-px w-20 rounded-full"
              style={{ background: "linear-gradient(90deg, transparent, rgba(232,184,75,0.45), transparent)" }}
            />
          </motion.div>

          {/* ── Welcome to / van name ── */}
          <motion.div
            initial={{ y: 6, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.35, duration: 0.9 }}
            className="gpu-layer flex flex-col items-center mt-7"
            onClick={stopProp}
            onTouchStart={stopProp}
          >
            {/* Flanked "Welcome to" label */}
            <div className="flex items-center gap-3 mb-3">
              <div className="h-px w-10 rounded-full bg-white/10" />
              <span className="text-[10px] tracking-[0.45em] text-white/28 uppercase font-light">
                Welcome to
              </span>
              <div className="h-px w-10 rounded-full bg-white/10" />
            </div>

            {editing ? (
              /* Edit mode — centered input + save button */
              <div
                className="flex flex-col items-center gap-3"
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
                  className="bg-transparent border-b border-[#E8B84B]/50 text-[#E8B84B] text-[32px] text-center outline-none placeholder:text-white/20 w-72 pb-1"
                  style={{ fontFamily: "var(--app-font-display)" }}
                  data-testid="van-name-input"
                />
                <button
                  onClick={e => { e.stopPropagation(); commitEdit(draft); }}
                  onTouchStart={e => e.stopPropagation()}
                  className="flex items-center gap-2 text-[#E8B84B]/60 hover:text-[#E8B84B] transition-colors text-xs tracking-widest uppercase"
                  data-testid="btn-save-van-name"
                >
                  <Check size={14} />
                  Save
                </button>
              </div>
            ) : (
              /* Display mode — van name perfectly centered, pencil absolutely positioned */
              <div
                className="group relative flex items-center justify-center"
                onClick={stopProp}
                onTouchStart={stopProp}
              >
                <span
                  className="text-[44px] leading-tight tracking-wide text-white/88 text-center"
                  style={{ fontFamily: "var(--app-font-display)" }}
                  data-testid="van-name-display"
                >
                  {displayName}
                </span>
                {/* Pencil — absolutely positioned so it never shifts the text center */}
                <button
                  onClick={openEdit}
                  onTouchStart={openEdit}
                  className="absolute -right-8 top-1/2 -translate-y-1/2 text-white/20 hover:text-[#E8B84B]/60 transition-all duration-200 opacity-0 group-hover:opacity-100 focus:opacity-100"
                  aria-label="Edit van name"
                  data-testid="btn-edit-van-name"
                >
                  <Pencil size={15} />
                </button>
              </div>
            )}
          </motion.div>

          {/* Thin divider */}
          <motion.div
            initial={{ opacity: 0, scaleX: 0 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: 0.45, duration: 0.7 }}
            className="gpu-layer mt-8 mb-6"
            style={{
              width: 1,
              height: 28,
              background: "linear-gradient(to bottom, transparent, rgba(255,255,255,0.10), transparent)",
            }}
          />

          {/* ── Clock ── */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="gpu-layer font-mono text-[96px] font-thin text-white/80 leading-none tracking-[0.04em]"
          >
            {format(time, "HH:mm")}
          </motion.div>

          {/* ── Date ── */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.65, duration: 0.8 }}
            className="gpu-layer text-white/22 text-[11px] font-light tracking-[0.35em] uppercase mt-3"
          >
            {format(time, "EEEE, MMMM d")}
          </motion.div>

          {/* ── Stats row ── */}
          <motion.div
            initial={{ y: 8, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.8, duration: 0.8 }}
            className="gpu-layer flex items-center gap-9 mt-9 px-8 py-3 rounded-2xl"
            style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)" }}
          >
            <div className="flex flex-col items-center gap-1 min-w-[52px]">
              <span className="text-[#E8B84B] text-lg font-semibold tabular-nums leading-none">
                {state.battery.soc.toFixed(0)}%
              </span>
              <span className="text-white/20 text-[9px] tracking-[0.25em] uppercase mt-0.5">Battery</span>
            </div>
            <div className="w-px h-6 bg-white/8" />
            <div className="flex flex-col items-center gap-1 min-w-[52px]">
              <span className="text-[#3ECFCF] text-lg font-semibold tabular-nums leading-none">
                {Math.round(state.solar.inputWatts)}W
              </span>
              <span className="text-white/20 text-[9px] tracking-[0.25em] uppercase mt-0.5">Solar</span>
            </div>
            <div className="w-px h-6 bg-white/8" />
            <div className="flex flex-col items-center gap-1 min-w-[52px]">
              <span className="text-white/60 text-lg font-semibold tabular-nums leading-none">
                {state.climate.indoorTempF.toFixed(0)}°F
              </span>
              <span className="text-white/20 text-[9px] tracking-[0.25em] uppercase mt-0.5">Inside</span>
            </div>
          </motion.div>

          {/* Tap to wake hint */}
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: [0, 0.25, 0] }}
            transition={{ delay: 2.5, duration: 3, repeat: Infinity, repeatDelay: 6 }}
            className="gpu-layer absolute bottom-8 text-white/20 text-[10px] tracking-[0.4em] uppercase"
          >
            Tap to wake
          </motion.p>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
