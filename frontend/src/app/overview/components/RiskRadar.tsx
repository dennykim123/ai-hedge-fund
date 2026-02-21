"use client";

import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from "recharts";
import { useI18n } from "@/lib/i18n";

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
  const { t } = useI18n();

  const data = [
    { subject: t("ov.gross_exp"), value: Math.min(100, grossExposure / 3), fullMark: 100 },
    { subject: t("ov.net_exp"), value: Math.min(100, netExposure), fullMark: 100 },
    { subject: t("ov.margin"), value: Math.min(100, marginUtil), fullMark: 100 },
    { subject: t("ov.concentration"), value: Math.min(100, concentration), fullMark: 100 },
    { subject: t("ov.volatility"), value: Math.min(100, volatility), fullMark: 100 },
  ];

  const maxRisk = Math.max(...data.map((d) => d.value));
  const radarColor =
    maxRisk > 75 ? "#ff6b6b" : maxRisk > 50 ? "#f0b429" : "#00d4aa";

  return (
    <div className="glass-card p-5">
      <p className="text-xs text-[#8b949e] tracking-widest mb-2">{t("ov.risk_radar")}</p>
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
