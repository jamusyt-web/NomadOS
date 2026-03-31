import { useSimulatedData } from "@/hooks/useSimulatedData";
import { CircularGauge } from "@/components/CircularGauge";
import { PowerFlowDiagram } from "@/components/PowerFlowDiagram";
import { Card } from "@/components/ui/card";
import { Battery, Zap, Sun, Clock, Lightbulb } from "lucide-react";
import { motion } from "framer-motion";

export default function Dashboard() {
  const { state, toggleLight } = useSimulatedData();

  const activeLights = state.lights.filter(l => l.isOn);

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="h-full flex flex-col gap-6"
    >
      {/* Top Row - Power Flow and Key Gauge */}
      <div className="grid grid-cols-3 gap-6 h-64">
        {/* Gauge Card */}
        <Card className="col-span-1 bg-card/50 backdrop-blur border-border flex items-center justify-center relative overflow-hidden">
          <div className="absolute top-4 left-4 flex items-center gap-2 text-muted-foreground">
            <Battery size={20} />
            <span className="font-semibold text-sm uppercase tracking-wide">House Battery</span>
          </div>
          <CircularGauge 
            percentage={state.battery.soc} 
            label="SOC" 
            valueText={`${state.battery.soc.toFixed(0)}%`}
            subText={`${state.battery.voltage.toFixed(1)}V`}
            color={state.battery.soc > 20 ? "hsl(var(--primary))" : "hsl(var(--destructive))"}
          />
        </Card>

        {/* Power Flow Card */}
        <Card className="col-span-2 bg-card/50 backdrop-blur border-border flex flex-col p-4 relative">
          <div className="absolute top-4 left-4 text-muted-foreground font-semibold text-sm uppercase tracking-wide">System Power Flow</div>
          <div className="flex-1 flex items-center justify-center mt-6">
            <PowerFlowDiagram />
          </div>
        </Card>
      </div>

      {/* Bottom Row - Metrics and Quick Toggles */}
      <div className="grid grid-cols-4 gap-6 flex-1">
        {/* Quick Stats Grid */}
        <div className="col-span-3 grid grid-cols-3 gap-4">
          <Card className="bg-card/40 border-border p-5 flex flex-col justify-between hover-elevate">
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <Sun className="text-primary" />
              <span className="font-semibold uppercase text-xs">Solar In</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tighter text-primary">{state.solar.inputWatts.toFixed(0)}</span>
              <span className="text-lg text-muted-foreground mb-1">W</span>
            </div>
          </Card>
          
          <Card className="bg-card/40 border-border p-5 flex flex-col justify-between hover-elevate">
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <Zap className="text-accent" />
              <span className="font-semibold uppercase text-xs">Load Out</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tighter text-accent">{Math.abs(state.battery.currentAmps * state.battery.voltage).toFixed(0)}</span>
              <span className="text-lg text-muted-foreground mb-1">W</span>
            </div>
          </Card>

          <Card className="bg-card/40 border-border p-5 flex flex-col justify-between hover-elevate">
            <div className="flex items-center gap-3 text-muted-foreground mb-2">
              <Clock className="text-muted-foreground" />
              <span className="font-semibold uppercase text-xs">Time Remaining</span>
            </div>
            <div className="flex items-end gap-2">
              <span className="text-4xl font-bold tracking-tighter">{state.battery.timeRemainingHrs.toFixed(1)}</span>
              <span className="text-lg text-muted-foreground mb-1">hrs</span>
            </div>
          </Card>
        </div>

        {/* Quick Actions */}
        <Card className="col-span-1 bg-card/40 border-border p-5 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <span className="font-semibold text-sm uppercase text-muted-foreground">Quick Actions</span>
            <div className="w-2 h-2 rounded-full bg-primary animate-pulse" />
          </div>
          
          <div className="space-y-3 flex-1">
            <button 
              onClick={() => toggleLight('cab')}
              className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 ${state.lights.find(l=>l.id === 'cab')?.isOn ? 'bg-primary text-primary-foreground shadow-[0_0_15px_hsla(var(--primary),0.4)]' : 'bg-muted text-muted-foreground'}`}
              data-testid="btn-quick-cab-light"
            >
              <Lightbulb size={18} />
              Cab Lights
            </button>
            <button 
              onClick={() => toggleLight('living')}
              className={`w-full py-4 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 ${state.lights.find(l=>l.id === 'living')?.isOn ? 'bg-primary text-primary-foreground shadow-[0_0_15px_hsla(var(--primary),0.4)]' : 'bg-muted text-muted-foreground'}`}
              data-testid="btn-quick-living-light"
            >
              <Lightbulb size={18} />
              Living Area
            </button>
          </div>
        </Card>
      </div>
    </motion.div>
  );
}
