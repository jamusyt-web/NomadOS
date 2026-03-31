import React from "react";
import { motion } from "framer-motion";

interface CircularGaugeProps {
  percentage: number;
  label: string;
  valueText: string;
  subText?: string;
  size?: number;
  strokeWidth?: number;
  color?: string;
}

export function CircularGauge({
  percentage,
  label,
  valueText,
  subText,
  size = 200,
  strokeWidth = 14,
  color = "hsl(var(--primary))",
}: CircularGaugeProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = radius * 2 * Math.PI;
  const offset = circumference - (percentage / 100) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke="hsl(var(--muted))"
          strokeWidth={strokeWidth}
          className="opacity-50"
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="transparent"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1, ease: "easeOut" }}
          strokeLinecap="round"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
        <span className="text-sm font-medium text-muted-foreground uppercase tracking-wider">{label}</span>
        <span className="text-4xl font-bold mt-1 mb-1 tracking-tight text-foreground">{valueText}</span>
        {subText && <span className="text-xs text-muted-foreground">{subText}</span>}
      </div>
    </div>
  );
}
