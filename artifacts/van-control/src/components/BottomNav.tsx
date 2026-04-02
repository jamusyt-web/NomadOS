import { Link, useLocation } from "wouter";
import { Home, Lightbulb, BatteryCharging, Thermometer } from "lucide-react";
import { motion } from "framer-motion";
import { useSimulatedData } from "@/hooks/useSimulatedData";

export function BottomNav() {
  const [location] = useLocation();
  const { state } = useSimulatedData();

  const activeLights = state.lights.filter(l => l.isOn).length;

  const tabs = [
    { path: "/",         label: "Home",    icon: Home,            badge: null },
    { path: "/lighting", label: "Lights",  icon: Lightbulb,       badge: activeLights > 0 ? activeLights : null },
    { path: "/power",    label: "Power",   icon: BatteryCharging, badge: null },
    { path: "/climate",  label: "Climate", icon: Thermometer,     badge: null },
  ];

  return (
    <div
      className="h-[60px] w-full flex items-center justify-around px-4 z-50 relative"
      style={{ borderTop: "1px solid rgba(255,255,255,0.05)", background: "hsl(240 20% 5% / 0.97)", backdropFilter: "blur(12px)" }}
      data-testid="bottom-nav"
    >
      {tabs.map((tab) => {
        const isActive = location === tab.path;
        const Icon = tab.icon;

        return (
          <Link
            key={tab.path}
            href={tab.path}
            className="relative flex flex-col items-center justify-center h-full flex-1 gap-0.5"
            data-testid={`nav-${tab.label.toLowerCase()}`}
          >
            {/* Active indicator bar at top */}
            {isActive && (
              <motion.div
                layoutId="nav-bar"
                className="gpu-layer absolute top-0 left-1/2 -translate-x-1/2 h-0.5 w-8 rounded-full bg-primary"
                transition={{ type: "spring", stiffness: 500, damping: 40 }}
              />
            )}

            {/* Icon */}
            <div className="relative">
              <Icon
                size={20}
                strokeWidth={isActive ? 2 : 1.5}
                className={`transition-all duration-200 ${isActive ? "text-primary" : "text-muted-foreground/60"}`}
              />
              {/* Badge */}
              {tab.badge !== null && (
                <span className="absolute -top-1 -right-2 w-4 h-4 rounded-full bg-primary text-background text-[9px] font-bold flex items-center justify-center">
                  {tab.badge}
                </span>
              )}
            </div>

            {/* Label */}
            <span className={`text-[10px] tracking-widest uppercase font-medium transition-colors duration-200 ${isActive ? "text-primary" : "text-muted-foreground/50"}`}>
              {tab.label}
            </span>
          </Link>
        );
      })}
    </div>
  );
}
