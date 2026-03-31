import { useSimulatedData } from "@/hooks/useSimulatedData";
import { Card } from "@/components/ui/card";
import { motion } from "framer-motion";
import { Thermometer, Snowflake, Wind, Plus, Minus } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Climate() {
  const { state, setFridgeTarget, setFanSpeed } = useSimulatedData();
  const { climate } = state;

  const fanSpeeds: Array<'off' | 'low' | 'medium' | 'high'> = ['off', 'low', 'medium', 'high'];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="h-full flex gap-6 pb-6"
    >
      {/* Left Col: Ambient Temps */}
      <div className="w-1/3 flex flex-col gap-6">
        <Card className="flex-1 bg-card/60 border-border p-6 flex flex-col relative overflow-hidden">
          <div className="absolute -top-10 -right-10 opacity-5">
            <Thermometer size={200} />
          </div>
          
          <h2 className="text-xl font-bold uppercase tracking-wide mb-6">Cabin Temp</h2>
          
          <div className="flex-1 flex flex-col items-center justify-center">
            <span className="text-8xl font-bold tracking-tighter text-foreground">
              {climate.indoorTempF.toFixed(0)}<span className="text-4xl text-muted-foreground">°</span>
            </span>
            <span className="text-lg text-primary font-semibold mt-2">Perfect</span>
          </div>

          <div className="mt-auto bg-background/50 rounded-xl p-4 flex justify-between items-center">
            <span className="text-sm font-semibold text-muted-foreground uppercase">Outside</span>
            <span className="text-xl font-bold">{climate.outdoorTempF.toFixed(0)}°F</span>
          </div>
        </Card>
      </div>

      {/* Right Col: Fridge & Fan */}
      <div className="w-2/3 flex flex-col gap-6">
        
        {/* Refrigerator */}
        <Card className={`flex-1 border-border p-6 flex transition-all duration-500 ${climate.fridgeCompressorOn ? 'bg-[#0F172A] border-accent/30 shadow-[0_0_30px_hsla(var(--accent),0.1)]' : 'bg-card/60'}`}>
          <div className="flex-1 flex flex-col">
            <div className="flex items-center gap-3 mb-auto">
              <div className={`p-2 rounded-lg transition-colors ${climate.fridgeCompressorOn ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>
                <Snowflake size={24} />
              </div>
              <div>
                <h2 className="text-xl font-bold uppercase tracking-wide">Refrigerator</h2>
                <span className="text-xs font-semibold text-accent flex items-center gap-1">
                  {climate.fridgeCompressorOn && <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />}
                  {climate.fridgeCompressorOn ? 'Compressor Running (45W)' : 'Idle (0W)'}
                </span>
              </div>
            </div>

            <div className="flex items-end gap-2 mb-4">
              <span className="text-6xl font-bold tracking-tighter text-foreground">{climate.fridgeTemp.toFixed(1)}°</span>
              <span className="text-lg text-muted-foreground mb-2 uppercase font-semibold">Current</span>
            </div>
          </div>

          <div className="w-48 bg-background/50 rounded-2xl p-4 flex flex-col items-center justify-between border border-border">
            <span className="text-xs font-semibold text-muted-foreground uppercase">Target Temp</span>
            
            <Button 
              variant="outline" 
              size="icon" 
              className="w-16 h-16 rounded-full border-border bg-background hover:bg-accent/20 hover:text-accent hover:border-accent/50"
              onClick={() => setFridgeTarget(climate.fridgeTarget + 1)}
              data-testid="btn-fridge-temp-up"
            >
              <Plus size={32} />
            </Button>
            
            <span className="text-4xl font-bold my-2">{climate.fridgeTarget}°</span>
            
            <Button 
              variant="outline" 
              size="icon" 
              className="w-16 h-16 rounded-full border-border bg-background hover:bg-primary/20 hover:text-primary hover:border-primary/50"
              onClick={() => setFridgeTarget(climate.fridgeTarget - 1)}
              data-testid="btn-fridge-temp-down"
            >
              <Minus size={32} />
            </Button>
          </div>
        </Card>

        {/* Roof Fan */}
        <Card className="h-40 bg-card/60 border-border p-6 flex flex-col justify-center">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg transition-colors ${climate.fanSpeed !== 'off' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'}`}>
                <Wind size={24} className={climate.fanSpeed !== 'off' ? 'animate-[spin_2s_linear_infinite]' : ''} />
              </div>
              <h2 className="text-xl font-bold uppercase tracking-wide">Roof Vent Fan</h2>
            </div>
            {climate.fanSpeed !== 'off' && (
              <span className="text-xs font-bold text-primary px-3 py-1 rounded-full bg-primary/10 uppercase">
                Drawing {climate.fanSpeed === 'low' ? '15' : climate.fanSpeed === 'medium' ? '30' : '60'}W
              </span>
            )}
          </div>

          <div className="flex bg-background/80 rounded-xl p-1.5 border border-border gap-1">
            {fanSpeeds.map((speed) => (
              <button
                key={speed}
                onClick={() => setFanSpeed(speed)}
                className={`flex-1 py-3 rounded-lg text-sm font-bold uppercase tracking-wider transition-all ${climate.fanSpeed === speed ? 'bg-primary text-primary-foreground shadow-md scale-[1.02]' : 'text-muted-foreground hover:bg-muted'}`}
                data-testid={`btn-fan-${speed}`}
              >
                {speed}
              </button>
            ))}
          </div>
        </Card>

      </div>
    </motion.div>
  );
}
