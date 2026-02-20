"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";

interface Props {
  grossExposure: number;
  netExposure: number;
  marginUtil: number;
  concentration: number;
  volatility: number;
}

export function RiskRadar({
  grossExposure,
  netExposure,
  marginUtil,
  concentration,
  volatility,
}: Props) {
  const data = [
    { subject: "Gross Exp", value: Math.min(100, grossExposure / 3), fullMark: 100 },
    { subject: "Net Exp", value: Math.min(100, netExposure), fullMark: 100 },
    { subject: "Margin", value: Math.min(100, marginUtil), fullMark: 100 },
    { subject: "Concentration", value: Math.min(100, concentration), fullMark: 100 },
    { subject: "Volatility", value: Math.min(100, volatility), fullMark: 100 },
  ];

  const maxRisk = Math.max(...data.map((d) => d.value));
  const radarColor =
    maxRisk > 75 ? "#ff6b6b" : maxRisk > 50 ? "#f0b429" : "#00d4aa";

  return (
    <div className="glass-card p-5">
      <p className="text-xs text-[#8b949e] tracking-widest mb-2">RISK RADAR</p>
      <ResponsiveContainer width="100%" height={160}>
        <RadarChart data={data}>
          <PolarGrid stroke="#30363d" />
          <PolarAngleAxis
            dataKey="subject"
            tick={{ fill: "#8b949e", fontSize: 10 }}
          />
          <Radar
            dataKey="value"
            stroke={radarColor}
            fill={radarColor}
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
}
