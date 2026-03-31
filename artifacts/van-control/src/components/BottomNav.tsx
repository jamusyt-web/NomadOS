import { Link, useLocation } from "wouter";
import { Home, Lightbulb, BatteryCharging, Thermometer } from "lucide-react";
import { motion } from "framer-motion";

export function BottomNav() {
  const [location] = useLocation();

  const tabs = [
    { path: "/", label: "Home", icon: Home },
    { path: "/lighting", label: "Lights", icon: Lightbulb },
    { path: "/power", label: "Power", icon: BatteryCharging },
    { path: "/climate", label: "Climate", icon: Thermometer },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 h-24 bg-background/95 backdrop-blur-md border-t border-border flex items-center justify-around px-4 pb-2 z-50">
      {tabs.map((tab) => {
        const isActive = location === tab.path;
        const Icon = tab.icon;

        return (
          <Link key={tab.path} href={tab.path} className="relative flex flex-col items-center justify-center w-24 h-full" data-testid={`nav-${tab.label.toLowerCase()}`}>
            <div className={`p-3 rounded-2xl transition-colors duration-200 z-10 ${isActive ? 'text-primary' : 'text-muted-foreground hover:text-foreground'}`}>
              <Icon size={28} strokeWidth={isActive ? 2.5 : 2} />
            </div>
            <span className={`text-[11px] font-bold tracking-wide uppercase mt-1 z-10 ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              {tab.label}
            </span>
            {isActive && (
              <motion.div
                layoutId="nav-pill"
                className="absolute inset-1 top-2 bottom-4 bg-primary/10 rounded-2xl border border-primary/20"
                transition={{ type: "spring", stiffness: 400, damping: 30 }}
              />
            )}
          </Link>
        );
      })}
    </div>
  );
}
