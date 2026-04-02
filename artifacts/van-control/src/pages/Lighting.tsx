import { useSimulatedData } from "@/hooks/useSimulatedData";
import { useHardware } from "@/hooks/useHardware";
import { hueToRgb } from "@/hooks/useSimulatedData";
import { ZoneCard } from "@/components/ZoneCard";
import { motion } from "framer-motion";
import { PowerOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Lighting() {
  const { state, toggleLight, setLightBrightness, setLightColor, toggleLightWarmth, turnAllLightsOff } = useSimulatedData();
  const { sendCommand } = useHardware();

  const anyOn = state.lights.some(l => l.isOn);

  const handleToggle = (id: string) => {
    const zone = state.lights.find(l => l.id === id);
    if (!zone) return;
    const newOn = !zone.isOn;
    toggleLight(id);
    if (zone.hasColor) {
      const [r, g, b] = hueToRgb(zone.hue);
      sendCommand({ cmd: 'setState', on: newOn, brightness: zone.brightness, r, g, b });
    } else {
      sendCommand({ cmd: 'setLight', idx: state.lights.findIndex(l => l.id === id), on: newOn, brightness: zone.brightness });
    }
  };

  const handleBrightness = (id: string, brightness: number) => {
    const zone = state.lights.find(l => l.id === id);
    if (!zone) return;
    setLightBrightness(id, brightness);
    if (zone.hasColor) {
      const [r, g, b] = hueToRgb(zone.hue);
      sendCommand({ cmd: 'setState', on: zone.isOn, brightness, r, g, b });
    } else {
      sendCommand({ cmd: 'setLight', idx: state.lights.findIndex(l => l.id === id), on: zone.isOn, brightness });
    }
  };

  const handleColor = (id: string, hue: number) => {
    const zone = state.lights.find(l => l.id === id);
    if (!zone) return;
    setLightColor(id, hue);
    const [r, g, b] = hueToRgb(hue);
    sendCommand({ cmd: 'setState', on: zone.isOn, brightness: zone.brightness, r, g, b });
  };

  const handleAllOff = () => {
    turnAllLightsOff();
    sendCommand({ cmd: 'allLightsOff' });
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="gpu-layer h-full flex flex-col pb-6"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Lighting Control</h1>
          <p className="text-muted-foreground mt-1">Manage interior and exterior zones</p>
        </div>

        <Button
          size="lg"
          variant={anyOn ? "default" : "secondary"}
          onClick={handleAllOff}
          className={`h-14 px-8 rounded-2xl font-bold text-lg transition-all ${anyOn ? 'shadow-[0_0_20px_hsla(var(--primary),0.3)] hover:scale-105' : 'opacity-50 grayscale'}`}
          data-testid="btn-master-off"
        >
          <PowerOff className="mr-2" size={24} />
          ALL OFF
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-6 flex-1 overflow-y-auto no-scrollbar pb-10">
        {state.lights.map((zone, i) => (
          <motion.div
            key={zone.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
          >
            <ZoneCard
              zone={zone}
              onToggle={handleToggle}
              onBrightnessChange={handleBrightness}
              onColorChange={handleColor}
              onWarmthToggle={toggleLightWarmth}
            />
          </motion.div>
        ))}

        <div className="rounded-2xl border border-dashed border-border/50 bg-transparent flex flex-col items-center justify-center text-muted-foreground opacity-30">
          <span className="text-sm font-semibold uppercase tracking-wider mb-2">Expansion Port</span>
          <span className="text-xs">No device connected</span>
        </div>
      </div>
    </motion.div>
  );
}
