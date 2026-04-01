import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Sun, Lightbulb, Eclipse, BedDouble, Monitor, Tent } from "lucide-react";
import { LightingZone, hueToRgb } from "@/hooks/useSimulatedData";
import { motion } from "framer-motion";

interface ZoneCardProps {
  zone: LightingZone;
  onToggle: (id: string) => void;
  onBrightnessChange: (id: string, val: number) => void;
  onColorChange: (id: string, hue: number) => void;
  onWarmthToggle: (id: string) => void;
}

export function ZoneCard({ zone, onToggle, onBrightnessChange, onColorChange, onWarmthToggle }: ZoneCardProps) {
  const getIcon = () => {
    switch (zone.id) {
      case 'cab': return <Lightbulb size={24} />;
      case 'living': return <Sun size={24} />;
      case 'bed': return <BedDouble size={24} />;
      case 'desk': return <Monitor size={24} />;
      case 'awning': return <Tent size={24} />;
      default: return <Lightbulb size={24} />;
    }
  };

  // Determine glow / accent color
  const [r, g, b] = zone.hasColor ? hueToRgb(zone.hue) : [232, 184, 75];
  const glowRgb = zone.hasColor
    ? `rgba(${r},${g},${b},0.18)`
    : zone.isWarm ? 'hsla(38,92%,50%,0.15)' : 'hsla(173,80%,40%,0.15)';
  const accentHex = zone.hasColor
    ? `rgb(${r},${g},${b})`
    : zone.isWarm ? 'hsl(38,92%,50%)' : 'hsl(173,80%,40%)';

  const borderColor = zone.isOn
    ? zone.hasColor ? `rgba(${r},${g},${b},0.5)` : undefined
    : undefined;

  return (
    <motion.div
      layout
      className={`relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 ${zone.isOn && !zone.hasColor ? 'border-primary/50' : zone.isOn ? 'border-transparent' : 'border-border'}`}
      style={{
        borderColor: zone.isOn ? borderColor : undefined,
        boxShadow: zone.isOn ? `0 0 40px -10px ${glowRgb}, inset 0 0 20px -10px ${glowRgb}` : 'none',
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div
            className="p-3 rounded-full"
            style={{
              background: zone.isOn ? 'hsl(240 20% 8%)' : 'hsl(240 15% 15%)',
              color: zone.isOn ? accentHex : 'hsl(240 10% 50%)',
            }}
          >
            {getIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{zone.name}</h3>
            <p className="text-sm text-muted-foreground flex items-center gap-1.5">
              {zone.isOn ? `${zone.brightness}%` : 'Off'}
              {zone.hasColor && zone.isOn && (
                <span
                  className="inline-block w-2.5 h-2.5 rounded-full border border-white/20"
                  style={{ background: accentHex }}
                />
              )}
            </p>
          </div>
        </div>
        <Switch
          checked={zone.isOn}
          onCheckedChange={() => onToggle(zone.id)}
          className="scale-125 data-[state=checked]:bg-primary"
          data-testid={`toggle-light-${zone.id}`}
        />
      </div>

      <div className={`space-y-5 transition-opacity duration-300 ${zone.isOn ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
        {/* Brightness */}
        <div className="flex items-center gap-4">
          <Eclipse size={18} className="text-muted-foreground flex-shrink-0" />
          <Slider
            value={[zone.brightness]}
            min={10}
            max={100}
            step={1}
            onValueChange={(vals) => onBrightnessChange(zone.id, vals[0])}
            className="flex-1"
            data-testid={`slider-brightness-${zone.id}`}
          />
          <Sun size={20} className="flex-shrink-0" style={{ color: accentHex }} />
        </div>

        {/* Color picker (RGB zones) or Warm/Cool toggle */}
        {zone.hasColor ? (
          <div className="space-y-2 pt-2 border-t border-border/50">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-muted-foreground">Color</span>
              <span
                className="text-xs font-bold px-2 py-0.5 rounded-full"
                style={{ background: accentHex + '33', color: accentHex }}
              >
                {zone.hue}°
              </span>
            </div>
            {/* Rainbow hue slider */}
            <div className="relative h-8 flex items-center">
              <input
                type="range"
                min={0}
                max={360}
                step={1}
                value={zone.hue}
                onChange={(e) => onColorChange(zone.id, Number(e.target.value))}
                data-testid={`slider-color-${zone.id}`}
                style={{
                  width: '100%',
                  height: '10px',
                  appearance: 'none',
                  borderRadius: '9999px',
                  outline: 'none',
                  cursor: 'pointer',
                  background: 'linear-gradient(to right, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000)',
                }}
                className="hue-slider"
              />
            </div>
            {/* Preset colors */}
            <div className="flex gap-2 pt-1">
              {[
                { label: 'Warm', hue: 38 },
                { label: 'White', hue: 60 },
                { label: 'Teal', hue: 173 },
                { label: 'Blue', hue: 220 },
                { label: 'Red', hue: 0 },
              ].map(preset => {
                const [pr, pg, pb] = hueToRgb(preset.hue);
                return (
                  <button
                    key={preset.label}
                    onClick={() => onColorChange(zone.id, preset.hue)}
                    className="flex-1 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-wider transition-all"
                    style={{
                      background: `rgba(${pr},${pg},${pb},0.15)`,
                      color: `rgb(${pr},${pg},${pb})`,
                      border: zone.hue === preset.hue ? `1px solid rgb(${pr},${pg},${pb})` : '1px solid transparent',
                    }}
                    data-testid={`preset-${preset.label.toLowerCase()}`}
                  >
                    {preset.label}
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            <span className="text-sm font-medium text-muted-foreground">Color Temp</span>
            <div
              className="flex bg-muted rounded-full p-1 cursor-pointer"
              onClick={() => onWarmthToggle(zone.id)}
              data-testid={`toggle-warmth-${zone.id}`}
            >
              <div className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${zone.isWarm ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Warm
              </div>
              <div className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${!zone.isWarm ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground'}`}>
                Cool
              </div>
            </div>
          </div>
        )}
      </div>
    </motion.div>
  );
}
