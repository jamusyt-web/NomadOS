import { useEffect, useRef, useState, useCallback } from "react";
import { useSimulatedData } from "@/hooks/useSimulatedData";
import { useHardware } from "@/hooks/useHardware";
import { useIRButtons, type IRDevice, type IRButton } from "@/hooks/useIRButtons";
import { Card } from "@/components/ui/card";
import { motion, AnimatePresence } from "framer-motion";
import {
  Thermometer, Snowflake, Wind, Plus, Minus, Flame,
  AirVent, Radio, Trash2, PencilLine, X, CheckCircle, AlertCircle, Loader,
} from "lucide-react";
import { Button } from "@/components/ui/button";

type LearnState = "idle" | "labeling" | "listening" | "success" | "failed";

export default function Climate() {
  const { state, setFridgeTarget, setFanSpeed } = useSimulatedData();
  const { sendCommand, onDeviceEvent } = useHardware();
  const { addButton, removeButton, getButtons } = useIRButtons();
  const { climate } = state;

  const [learnState, setLearnState] = useState<LearnState>("idle");
  const [pendingDevice, setPendingDevice] = useState<IRDevice>("heat");
  const [pendingLabel, setPendingLabel] = useState("");
  const [editMode, setEditMode] = useState(false);

  const pendingLabelRef = useRef(pendingLabel);
  const pendingDeviceRef = useRef(pendingDevice);
  pendingLabelRef.current = pendingLabel;
  pendingDeviceRef.current = pendingDevice;

  const learnTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Subscribe to device events (IR learned / failed)
  useEffect(() => {
    const unsub = onDeviceEvent((evt) => {
      if (evt.event === "irLearned" && Array.isArray(evt.data)) {
        if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
        addButton({
          label: pendingLabelRef.current.trim() || "Button",
          device: pendingDeviceRef.current,
          data: evt.data as number[],
        });
        setLearnState("success");
        setTimeout(() => setLearnState("idle"), 2000);
      } else if (evt.event === "irLearnFailed") {
        if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
        setLearnState("failed");
        setTimeout(() => setLearnState("idle"), 3000);
      }
    });
    return unsub;
  }, [onDeviceEvent, addButton]);

  const startAddButton = (device: IRDevice) => {
    setPendingDevice(device);
    setPendingLabel("");
    setLearnState("labeling");
    setEditMode(false);
  };

  const startLearning = () => {
    const label = pendingLabelRef.current.trim();
    if (!label) return;
    setLearnState("listening");
    sendCommand({ cmd: "learnIR" });
    // 15 s UI timeout (firmware sends failure after 10 s, but add buffer)
    learnTimeoutRef.current = setTimeout(() => {
      setLearnState("failed");
      setTimeout(() => setLearnState("idle"), 3000);
    }, 15000);
  };

  const cancelLearning = () => {
    if (learnTimeoutRef.current) clearTimeout(learnTimeoutRef.current);
    setLearnState("idle");
  };

  const fireButton = useCallback((btn: IRButton) => {
    sendCommand({ cmd: "sendIR", data: btn.data });
  }, [sendCommand]);

  const fanSpeeds: Array<"off" | "low" | "medium" | "high"> = ["off", "low", "medium", "high"];

  const heatButtons = getButtons("heat");
  const acButtons = getButtons("ac");

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex gap-5 pb-6 relative"
    >
      {/* ── Left Column: Temps + Hardware Notice ─────────────────── */}
      <div className="w-[30%] flex flex-col gap-4">
        <Card className="flex-1 bg-card/60 border-border p-5 flex flex-col relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-5 pointer-events-none">
            <Thermometer size={180} />
          </div>
          <h2 className="text-base font-bold uppercase tracking-widest text-muted-foreground mb-4">Cabin Temp</h2>
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-7xl font-bold tracking-tighter text-foreground">
              {climate.indoorTempF.toFixed(0)}<span className="text-3xl text-muted-foreground">°</span>
            </span>
            <span className="text-base text-primary font-semibold mt-1">
              {climate.indoorTempF < 60 ? "Cold" : climate.indoorTempF < 72 ? "Comfortable" : "Warm"}
            </span>
          </div>
          <div className="mt-auto bg-background/50 rounded-xl p-3 flex justify-between items-center">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Outside</span>
            <span className="text-lg font-bold">{climate.outdoorTempF.toFixed(0)}°F</span>
          </div>
        </Card>

        {/* Hardware notice */}
        <div className="rounded-xl border border-border/40 bg-card/30 p-3 text-[10px] text-muted-foreground leading-relaxed space-y-1">
          <p className="font-bold text-foreground/60 uppercase tracking-widest">Required Hardware</p>
          <p>• VS1838B IR Receiver (GPIO 14)</p>
          <p>• IR LED 940nm (GPIO 4)</p>
          <p>• DS18B20 Temp Sensor (GPIO 13, optional)</p>
          <p className="pt-1 text-primary/70">Flash <span className="font-mono">esp32_climate.ino</span></p>
        </div>
      </div>

      {/* ── Right Column: IR Remotes + Fridge + Fan ──────────────── */}
      <div className="flex-1 flex flex-col gap-4 overflow-y-auto no-scrollbar">

        {/* Edit mode toggle */}
        <div className="flex items-center justify-end">
          <button
            onClick={() => setEditMode(e => !e)}
            className={`flex items-center gap-1.5 text-xs font-bold uppercase tracking-widest px-3 py-1.5 rounded-full transition-all ${editMode ? "bg-destructive/20 text-destructive" : "bg-muted text-muted-foreground"}`}
          >
            <PencilLine size={12} />
            {editMode ? "Done" : "Edit Remotes"}
          </button>
        </div>

        {/* ── Heat section ─────────────────────────────────────── */}
        <IRSection
          label="Heater"
          icon={<Flame size={18} />}
          color="text-orange-400"
          borderColor="border-orange-500/30"
          glowColor="hsla(24,95%,53%,0.08)"
          buttons={heatButtons}
          editMode={editMode}
          onAdd={() => startAddButton("heat")}
          onFire={fireButton}
          onDelete={removeButton}
        />

        {/* ── AC section ───────────────────────────────────────── */}
        <IRSection
          label="Air Conditioner"
          icon={<AirVent size={18} />}
          color="text-accent"
          borderColor="border-accent/30"
          glowColor="hsla(173,80%,40%,0.08)"
          buttons={acButtons}
          editMode={editMode}
          onAdd={() => startAddButton("ac")}
          onFire={fireButton}
          onDelete={removeButton}
        />

        {/* ── Refrigerator ─────────────────────────────────────── */}
        <Card className={`border-border p-4 flex transition-all duration-500 ${climate.fridgeCompressorOn ? "bg-[#0F172A] border-accent/30 shadow-[0_0_30px_hsla(var(--accent),0.1)]" : "bg-card/60"}`}>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-lg transition-colors ${climate.fridgeCompressorOn ? "bg-accent text-accent-foreground" : "bg-muted text-muted-foreground"}`}>
                <Snowflake size={18} />
              </div>
              <div>
                <h2 className="text-base font-bold uppercase tracking-wide">Refrigerator</h2>
                <span className="text-[10px] font-semibold text-accent flex items-center gap-1">
                  {climate.fridgeCompressorOn && <span className="w-1.5 h-1.5 rounded-full bg-accent animate-pulse" />}
                  {climate.fridgeCompressorOn ? "Compressor Running (45W)" : "Idle (0W)"}
                </span>
              </div>
            </div>
            <div className="flex items-end gap-1">
              <span className="text-4xl font-bold tracking-tighter">{climate.fridgeTemp.toFixed(1)}°</span>
              <span className="text-sm text-muted-foreground mb-1 uppercase font-semibold">Current</span>
            </div>
          </div>
          <div className="w-36 bg-background/50 rounded-xl p-3 flex flex-col items-center justify-between border border-border">
            <span className="text-[10px] font-semibold text-muted-foreground uppercase">Target</span>
            <Button
              variant="outline" size="icon"
              className="w-10 h-10 rounded-full border-border bg-background hover:bg-accent/20 hover:text-accent hover:border-accent/50"
              onClick={() => setFridgeTarget(climate.fridgeTarget + 1)}
              data-testid="btn-fridge-temp-up"
            >
              <Plus size={20} />
            </Button>
            <span className="text-2xl font-bold">{climate.fridgeTarget}°</span>
            <Button
              variant="outline" size="icon"
              className="w-10 h-10 rounded-full border-border bg-background hover:bg-primary/20 hover:text-primary hover:border-primary/50"
              onClick={() => setFridgeTarget(climate.fridgeTarget - 1)}
              data-testid="btn-fridge-temp-down"
            >
              <Minus size={20} />
            </Button>
          </div>
        </Card>

        {/* ── Roof Fan ─────────────────────────────────────────── */}
        <Card className="bg-card/60 border-border p-4 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className={`p-1.5 rounded-lg transition-colors ${climate.fanSpeed !== "off" ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
                <Wind size={18} className={climate.fanSpeed !== "off" ? "animate-[spin_2s_linear_infinite]" : ""} />
              </div>
              <h2 className="text-base font-bold uppercase tracking-wide">Roof Vent Fan</h2>
            </div>
            {climate.fanSpeed !== "off" && (
              <span className="text-[10px] font-bold text-primary px-2 py-0.5 rounded-full bg-primary/10 uppercase">
                {climate.fanSpeed === "low" ? "15" : climate.fanSpeed === "medium" ? "30" : "60"}W
              </span>
            )}
          </div>
          <div className="flex bg-background/80 rounded-xl p-1 border border-border gap-1">
            {fanSpeeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setFanSpeed(speed)}
                className={`flex-1 py-2.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${climate.fanSpeed === speed ? "bg-primary text-primary-foreground shadow-md" : "text-muted-foreground hover:bg-muted"}`}
                data-testid={`btn-fan-${speed}`}
              >
                {speed}
              </button>
            ))}
          </div>
        </Card>
      </div>

      {/* ── IR Learning Overlay ──────────────────────────────────── */}
      <AnimatePresence>
        {learnState !== "idle" && (
          <motion.div
            key="learn-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-end justify-center pb-4"
            style={{ background: "rgba(8,8,15,0.85)", backdropFilter: "blur(8px)" }}
          >
            <motion.div
              initial={{ y: 80, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 80, opacity: 0 }}
              transition={{ type: "spring", stiffness: 400, damping: 35 }}
              className="w-full max-w-lg bg-card border border-border rounded-2xl p-6 mx-4 shadow-2xl"
            >
              {learnState === "labeling" && (
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl bg-primary/10 text-primary">
                      <Radio size={20} />
                    </div>
                    <div>
                      <h3 className="font-bold text-lg">Add Remote Button</h3>
                      <p className="text-sm text-muted-foreground">
                        {pendingDevice === "heat" ? "Heater" : "Air Conditioner"}
                      </p>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2 block">
                      Button Label
                    </label>
                    <input
                      autoFocus
                      type="text"
                      value={pendingLabel}
                      onChange={e => setPendingLabel(e.target.value)}
                      onKeyDown={e => e.key === "Enter" && pendingLabel.trim() && startLearning()}
                      placeholder='e.g. "Power", "Eco Mode", "Heat Up"'
                      className="w-full bg-background border border-border rounded-xl px-4 py-3 text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-primary text-sm"
                      data-testid="input-ir-label"
                    />
                  </div>
                  <div className="flex gap-3">
                    <Button variant="outline" className="flex-1" onClick={cancelLearning}>
                      Cancel
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!pendingLabel.trim()}
                      onClick={startLearning}
                      data-testid="btn-start-learning"
                    >
                      Start Learning
                    </Button>
                  </div>
                </div>
              )}

              {learnState === "listening" && (
                <div className="flex flex-col items-center gap-4 py-2">
                  <div className="p-4 rounded-full bg-primary/10 text-primary animate-pulse">
                    <Loader size={36} className="animate-spin" />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg mb-1">Listening…</h3>
                    <p className="text-sm text-muted-foreground">
                      Point your remote at the IR receiver and press <strong>"{pendingLabel}"</strong>
                    </p>
                  </div>
                  <button
                    onClick={cancelLearning}
                    className="text-xs text-muted-foreground underline underline-offset-2"
                  >
                    Cancel
                  </button>
                </div>
              )}

              {learnState === "success" && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="p-4 rounded-full bg-green-500/10 text-green-400">
                    <CheckCircle size={36} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg text-green-400">Button Saved!</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      <strong>"{pendingLabel}"</strong> added to{" "}
                      {pendingDevice === "heat" ? "Heater" : "Air Conditioner"}
                    </p>
                  </div>
                </div>
              )}

              {learnState === "failed" && (
                <div className="flex flex-col items-center gap-3 py-2">
                  <div className="p-4 rounded-full bg-destructive/10 text-destructive">
                    <AlertCircle size={36} />
                  </div>
                  <div className="text-center">
                    <h3 className="font-bold text-lg text-destructive">No Signal Received</h3>
                    <p className="text-sm text-muted-foreground mt-1">
                      Make sure the climate ESP is connected and the remote is pointed at the receiver
                    </p>
                  </div>
                </div>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── IR Section component ──────────────────────────────────────────────────────
interface IRSectionProps {
  label: string;
  icon: React.ReactNode;
  color: string;
  borderColor: string;
  glowColor: string;
  buttons: IRButton[];
  editMode: boolean;
  onAdd: () => void;
  onFire: (btn: IRButton) => void;
  onDelete: (id: string) => void;
}

function IRSection({ label, icon, color, borderColor, glowColor, buttons, editMode, onAdd, onFire, onDelete }: IRSectionProps) {
  return (
    <Card
      className={`bg-card/60 border p-4 transition-all duration-300 ${buttons.length > 0 ? borderColor : "border-border"}`}
      style={{ boxShadow: buttons.length > 0 ? `0 0 30px -10px ${glowColor}` : "none" }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className={color}>{icon}</span>
          <h2 className="text-base font-bold uppercase tracking-wide">{label}</h2>
          {buttons.length > 0 && (
            <span className="text-[10px] font-bold text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
              {buttons.length} button{buttons.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={onAdd}
          className={`flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 rounded-xl border transition-all hover:scale-105 ${color} border-current/30 bg-current/5`}
          data-testid={`btn-add-${label.toLowerCase().replace(/\s+/g, "-")}`}
        >
          <Plus size={12} />
          Add Button
        </button>
      </div>

      {buttons.length === 0 ? (
        <div className="flex items-center justify-center h-10 rounded-xl border border-dashed border-border/50 text-muted-foreground/40 text-xs">
          No buttons yet — add your first remote button
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {buttons.map(btn => (
              <motion.div
                key={btn.id}
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative"
              >
                <button
                  onClick={() => !editMode && onFire(btn)}
                  className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition-all
                    ${editMode
                      ? "border-destructive/30 bg-destructive/5 text-muted-foreground cursor-default pr-7"
                      : `${borderColor} bg-current/5 ${color} hover:scale-105 active:scale-95`
                    }`}
                  data-testid={`btn-ir-${btn.label.toLowerCase().replace(/\s+/g, "-")}`}
                >
                  <Radio size={10} className="opacity-60" />
                  {btn.label}
                </button>
                {editMode && (
                  <button
                    onClick={() => onDelete(btn.id)}
                    className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center hover:scale-110 transition-transform"
                    data-testid={`btn-delete-${btn.label.toLowerCase().replace(/\s+/g, "-")}`}
                  >
                    <X size={10} />
                  </button>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </Card>
  );
}
