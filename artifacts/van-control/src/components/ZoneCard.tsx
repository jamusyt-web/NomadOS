import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Sun, Lightbulb, Eclipse, BedDouble, Monitor, Tent } from "lucide-react";
import { LightingZone } from "@/hooks/useSimulatedData";
import { motion } from "framer-motion";

interface ZoneCardProps {
  zone: LightingZone;
  onToggle: (id: string) => void;
  onBrightnessChange: (id: string, val: number) => void;
  onWarmthToggle: (id: string) => void;
}

export function ZoneCard({ zone, onToggle, onBrightnessChange, onWarmthToggle }: ZoneCardProps) {
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

  const glowColor = zone.isWarm ? 'hsla(38, 92%, 50%, 0.15)' : 'hsla(173, 80%, 40%, 0.15)';
  const activeColorClass = zone.isWarm ? 'text-primary' : 'text-accent';

  return (
    <motion.div 
      layout
      className={`relative overflow-hidden rounded-2xl border bg-card p-5 transition-all duration-300 ${zone.isOn ? 'border-primary/50' : 'border-border'}`}
      style={{
        boxShadow: zone.isOn ? `0 0 40px -10px ${glowColor}, inset 0 0 20px -10px ${glowColor}` : 'none'
      }}
    >
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className={`p-3 rounded-full ${zone.isOn ? 'bg-background shadow-inner ' + activeColorClass : 'bg-muted text-muted-foreground'}`}>
            {getIcon()}
          </div>
          <div>
            <h3 className="font-semibold text-lg">{zone.name}</h3>
            <p className="text-sm text-muted-foreground">{zone.isOn ? `${zone.brightness}%` : 'Off'}</p>
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
        <div className="flex items-center gap-4">
          <Eclipse size={18} className="text-muted-foreground" />
          <Slider 
            value={[zone.brightness]} 
            min={10} 
            max={100} 
            step={1}
            onValueChange={(vals) => onBrightnessChange(zone.id, vals[0])}
            className="flex-1"
            data-testid={`slider-brightness-${zone.id}`}
          />
          <Sun size={20} className={activeColorClass} />
        </div>

        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-sm font-medium text-muted-foreground">Color Temp</span>
          <div className="flex bg-muted rounded-full p-1 cursor-pointer" onClick={() => onWarmthToggle(zone.id)} data-testid={`toggle-warmth-${zone.id}`}>
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${zone.isWarm ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Warm
            </div>
            <div className={`px-4 py-1.5 rounded-full text-xs font-bold transition-colors ${!zone.isWarm ? 'bg-accent text-accent-foreground shadow-sm' : 'text-muted-foreground'}`}>
              Cool
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
