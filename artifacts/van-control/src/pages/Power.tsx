import { useSimulatedData } from "@/hooks/useSimulatedData";
import { CircularGauge } from "@/components/CircularGauge";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Battery, Zap, Sun, Plug, Activity, ArrowDownToLine, ArrowUpToLine } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip } from "recharts";

// Mock data for the chart
const generateMockChartData = () => {
  const data = [];
  let val = 0;
  for (let i = 6; i <= 18; i++) {
    if (i < 12) val += Math.random() * 50;
    else val -= Math.random() * 50;
    data.push({ time: `${i}:00`, watts: Math.max(0, val) });
  }
  return data;
};
const chartData = generateMockChartData();

export default function Power() {
  const { state, toggleInverter } = useSimulatedData();
  const { battery, solar, inverter } = state;

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="h-full grid grid-cols-12 gap-6 pb-6"
    >
      {/* Left Column - Battery */}
      <div className="col-span-5 flex flex-col gap-6">
        <Card className="flex-1 bg-card/60 border-border p-6 flex flex-col relative overflow-hidden">
          <div className="absolute top-0 right-0 p-3 opacity-10">
            <Battery size={120} />
          </div>
          
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-primary/20 text-primary rounded-lg">
              <Battery size={24} />
            </div>
            <h2 className="text-xl font-bold uppercase tracking-wide">Main Battery</h2>
          </div>

          <div className="flex justify-center my-4">
            <CircularGauge 
              percentage={battery.soc} 
              label="STATE OF CHARGE" 
              valueText={`${battery.soc.toFixed(0)}%`}
              size={220}
              strokeWidth={16}
              color="hsl(var(--primary))"
            />
          </div>

          <div className="grid grid-cols-2 gap-4 mt-auto">
            <div className="bg-background/50 rounded-xl p-4 flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground mb-1 uppercase">Voltage</span>
              <span className="text-2xl font-bold text-foreground">{battery.voltage.toFixed(2)}<span className="text-sm text-muted-foreground">V</span></span>
            </div>
            <div className="bg-background/50 rounded-xl p-4 flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground mb-1 uppercase">Current</span>
              <div className="flex items-center gap-2">
                <span className={`text-2xl font-bold ${battery.currentAmps > 0 ? 'text-primary' : 'text-accent'}`}>
                  {battery.currentAmps > 0 ? '+' : ''}{battery.currentAmps.toFixed(1)}<span className="text-sm opacity-70">A</span>
                </span>
                {battery.currentAmps > 0 ? <ArrowUpToLine className="text-primary" size={16} /> : <ArrowDownToLine className="text-accent" size={16} />}
              </div>
            </div>
            <div className="bg-background/50 rounded-xl p-4 flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground mb-1 uppercase">Temp</span>
              <span className="text-2xl font-bold text-foreground">{battery.tempF.toFixed(0)}<span className="text-sm text-muted-foreground">°F</span></span>
            </div>
            <div className="bg-background/50 rounded-xl p-4 flex flex-col">
              <span className="text-xs font-semibold text-muted-foreground mb-1 uppercase">Est. Time</span>
              <span className="text-2xl font-bold text-foreground">{battery.timeRemainingHrs.toFixed(1)}<span className="text-sm text-muted-foreground">h</span></span>
            </div>
          </div>
        </Card>
      </div>

      {/* Right Column - Solar & Inverter */}
      <div className="col-span-7 flex flex-col gap-6">
        
        {/* Solar Card */}
        <Card className="bg-card/60 border-border p-6 h-1/2 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2 bg-primary/20 text-primary rounded-lg">
                <Sun size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-wide">Solar Array</h2>
            </div>
            <div className="text-right">
              <div className="text-3xl font-bold text-primary">{solar.inputWatts.toFixed(0)}<span className="text-lg text-primary/70">W</span></div>
              <div className="text-xs font-semibold text-muted-foreground">{solar.voltage.toFixed(1)}V Array</div>
            </div>
          </div>

          <div className="flex-1 min-h-0 w-full mt-2">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorWatts" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <Area type="monotone" dataKey="watts" stroke="hsl(var(--primary))" strokeWidth={2} fillOpacity={1} fill="url(#colorWatts)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          
          <div className="mt-4 flex justify-between items-center px-2 py-3 bg-background/50 rounded-xl">
            <span className="text-sm font-semibold text-muted-foreground uppercase">Daily Yield</span>
            <span className="text-lg font-bold text-foreground">{(solar.yieldWhToday / 1000).toFixed(2)} kWh</span>
          </div>
        </Card>

        {/* Lower Row: Inverter & Shore */}
        <div className="h-1/2 grid grid-cols-2 gap-6">
          <Card className={`border-border p-6 flex flex-col transition-all duration-300 ${inverter.isOn ? 'bg-accent/10 border-accent/30 shadow-[0_0_30px_hsla(var(--accent),0.15)]' : 'bg-card/60'}`}>
            <div className="flex items-start justify-between mb-auto">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg transition-colors ${inverter.isOn ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                  <Zap size={24} />
                </div>
                <div>
                  <h2 className="text-xl font-bold uppercase tracking-wide">Inverter</h2>
                  <span className="text-xs font-semibold text-muted-foreground">120V AC Output</span>
                </div>
              </div>
              <Switch 
                checked={inverter.isOn} 
                onCheckedChange={toggleInverter} 
                className="scale-125 data-[state=checked]:bg-accent"
                data-testid="toggle-inverter"
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="bg-background/40 rounded-xl p-4">
                <span className="text-xs font-semibold text-muted-foreground block mb-1 uppercase">Output Volts</span>
                <span className={`text-2xl font-bold ${inverter.isOn ? 'text-foreground' : 'text-muted-foreground'}`}>{inverter.isOn ? '120.0' : '0.0'}<span className="text-sm opacity-70">V</span></span>
              </div>
              <div className="bg-background/40 rounded-xl p-4">
                <span className="text-xs font-semibold text-muted-foreground block mb-1 uppercase">Load</span>
                <span className={`text-2xl font-bold ${inverter.isOn ? 'text-accent' : 'text-muted-foreground'}`}>{inverter.isOn ? inverter.loadWatts.toFixed(0) : '0'}<span className="text-sm opacity-70">W</span></span>
              </div>
            </div>
          </Card>

          <Card className="bg-card/60 border-border p-6 flex flex-col">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-2 bg-muted text-muted-foreground rounded-lg">
                <Plug size={24} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-wide">External Power</h2>
            </div>

            <div className="flex flex-col justify-center h-full gap-4">
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-dashed border-border">
                <div className="flex items-center gap-3">
                  <Plug size={20} className="text-muted-foreground" />
                  <span className="font-semibold">Shore Power</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-muted text-xs font-bold text-muted-foreground uppercase">Disconnected</span>
              </div>
              
              <div className="flex items-center justify-between p-4 bg-background/50 rounded-xl border border-dashed border-border">
                <div className="flex items-center gap-3">
                  <Activity size={20} className="text-muted-foreground" />
                  <span className="font-semibold">Alternator</span>
                </div>
                <span className="px-3 py-1 rounded-full bg-muted text-xs font-bold text-muted-foreground uppercase">Off</span>
              </div>
            </div>
          </Card>
        </div>

      </div>
    </motion.div>
  );
}
