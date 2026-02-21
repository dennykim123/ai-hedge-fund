"use client";

import { useEffect, useState } from "react";
import { RadialGauge } from "@/components/ui/RadialGauge";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface RiskData {
  exposure: { gross_pct: number; net_pct: number };
  margin: { utilization_pct: number };
  vix: number | null;
  decisions_24h?: {
    approval_rate: number;
    total: number;
    approved: number;
    rejected: number;
  };
  concentration?: {
    top_ticker: string | null;
    top_sector: string | null;
  };
}

interface RadarData {
  concentration: number;
  volatility: number;
  drawdown: number;
  correlation: number;
  leverage: number;
  liquidity: number;
}

const RISK_THRESHOLDS = [
  { subject: "Concentration", key: "concentration", warn: 40, danger: 70 },
  { subject: "Volatility", key: "volatility", warn: 40, danger: 70 },
  { subject: "Drawdown", key: "drawdown", warn: 30, danger: 60 },
  { subject: "Correlation", key: "correlation", warn: 50, danger: 75 },
  { subject: "Leverage", key: "leverage", warn: 40, danger: 70 },
  { subject: "Liquidity", key: "liquidity", warn: 0, danger: 0 },
];

function riskColor(value: number, warn: number, danger: number) {
  if (danger > 0 && value >= danger) return "#ff6b6b";
  if (warn > 0 && value >= warn) return "#f0b429";
  return "#00d4aa";
}

export function RiskTab() {
  const { t } = useI18n();
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);

  const riskLabels: Record<string, TranslationKey> = {
    Concentration: "risk.th_concentration",
    Volatility: "risk.th_volatility",
    Drawdown: "risk.th_drawdown",
    Correlation: "risk.th_correlation",
    Leverage: "risk.th_leverage",
    Liquidity: "risk.th_liquidity",
  };

  useEffect(() => {
    const fetchData = () => {
      Promise.all([
        fetch(`${BASE_URL}/api/fund/risk/overview`)
          .then((r) => r.json())
          .then(setRisk)
          .catch(() => {}),
        fetch(`${BASE_URL}/api/trading/risk/concentration`)
          .then((r) => r.json())
          .then((d) => setRadarData(d.radar || null))
          .catch(() => {}),
      ]).finally(() => setLoading(false));
    };

    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const radarChartData = radarData
    ? RISK_THRESHOLDS.map(({ subject, key }) => ({
        subject: riskLabels[subject] ? t(riskLabels[subject]) : subject,
        value: radarData[key as keyof RadarData] ?? 0,
      }))
    : [];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <SkeletonCard key={i} rows={3} />
          ))}
        </div>
        <SkeletonCard rows={4} />
      </div>
    );
  }

  const overallRiskScore = radarData
    ? Math.round(
        (radarData.concentration +
          radarData.volatility +
          radarData.drawdown +
          radarData.correlation +
          radarData.leverage) /
          5,
      )
    : 0;

  const riskLevel =
    overallRiskScore >= 70
      ? {
          label: t("risk.high"),
          color: "text-[#ff6b6b]",
          bg: "bg-red-900/20 border-red-500/30",
        }
      : overallRiskScore >= 40
        ? {
            label: t("risk.moderate"),
            color: "text-[#f0b429]",
            bg: "bg-yellow-900/20 border-yellow-500/30",
          }
        : {
            label: t("risk.low"),
            color: "text-[#00d4aa]",
            bg: "bg-green-900/20 border-green-500/30",
          };

  return (
    <div className="space-y-6">
      {/* Risk Level Banner */}
      <div
        className={`border rounded-xl p-4 flex items-center justify-between ${riskLevel.bg}`}
      >
        <div>
          <p className={`text-xs tracking-widest mb-1 ${riskLevel.color}`}>
            {t("risk.overall")}
          </p>
          <p className={`text-2xl font-bold font-mono ${riskLevel.color}`}>
            {riskLevel.label}
          </p>
        </div>
        <div className="text-right">
          <p className="text-xs text-[#8b949e]">{t("risk.score")}</p>
          <p className={`text-4xl font-mono font-bold ${riskLevel.color}`}>
            {overallRiskScore}
          </p>
          <p className="text-xs text-[#8b949e]">/ 100</p>
        </div>
      </div>

      {/* Gauges Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RadialGauge
          label={t("risk.gross_exp")}
          value={risk?.exposure?.gross_pct ?? null}
          max={300}
          warnAt={150}
          dangerAt={200}
          unit="%"
        />
        <RadialGauge
          label={t("risk.net_exp")}
          value={risk?.exposure?.net_pct ?? null}
          max={100}
          warnAt={50}
          dangerAt={80}
          unit="%"
        />
        <RadialGauge
          label={t("risk.margin")}
          value={risk?.margin?.utilization_pct ?? null}
          max={100}
          warnAt={50}
          dangerAt={75}
          unit="%"
        />
        <RadialGauge
          label="VIX"
          value={risk?.vix ?? null}
          max={60}
          warnAt={20}
          dangerAt={30}
          unit=""
        />
      </div>

      {/* Radar + Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Risk Radar */}
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("risk.radar")}
          </p>
          {radarChartData.length > 0 ? (
            <ResponsiveContainer width="100%" height={260}>
              <RadarChart data={radarChartData} cx="50%" cy="50%">
                <PolarGrid stroke="#30363d" />
                <PolarAngleAxis
                  dataKey="subject"
                  tick={{ fill: "#8b949e", fontSize: 11 }}
                />
                <Tooltip
                  contentStyle={{
                    background: "#1c2128",
                    border: "1px solid #30363d",
                    borderRadius: 8,
                    fontSize: 12,
                  }}
                  formatter={(v: number | undefined) => [
                    `${(v ?? 0).toFixed(0)}`,
                    "Score",
                  ]}
                />
                <Radar
                  dataKey="value"
                  stroke="#00d4aa"
                  fill="#00d4aa"
                  fillOpacity={0.25}
                  strokeWidth={2}
                />
              </RadarChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-60 flex items-center justify-center text-[#8b949e] text-sm">
              {t("risk.no_data")}
            </div>
          )}
        </div>

        {/* Risk Metrics Breakdown */}
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("risk.breakdown")}
          </p>
          <div className="space-y-3">
            {RISK_THRESHOLDS.map(({ subject, key, warn, danger }) => {
              const value = radarData?.[key as keyof RadarData] ?? 0;
              const color = riskColor(value, warn, danger);
              return (
                <div key={key}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#8b949e]">
                      {riskLabels[subject] ? t(riskLabels[subject]) : subject}
                    </span>
                    <span className="font-mono" style={{ color }}>
                      {value.toFixed(0)}
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#1c2128] rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${Math.min(100, value)}%`,
                        backgroundColor: color,
                      }}
                    />
                  </div>
                </div>
              );
            })}
          </div>

          {/* Decision Stats */}
          {risk?.decisions_24h && (
            <div className="mt-6 pt-4 border-t border-[#30363d]">
              <p className="text-xs text-[#8b949e] tracking-widest mb-3">
                {t("risk.decisions")}
              </p>
              <div className="grid grid-cols-3 gap-3">
                <div className="bg-[#1c2128] p-3 rounded-lg text-center">
                  <p className="text-lg font-mono font-bold text-white">
                    {risk.decisions_24h.total}
                  </p>
                  <p className="text-xs text-[#8b949e]">{t("risk.total")}</p>
                </div>
                <div className="bg-[#1c2128] p-3 rounded-lg text-center">
                  <p className="text-lg font-mono font-bold text-[#00d4aa]">
                    {risk.decisions_24h.approved}
                  </p>
                  <p className="text-xs text-[#8b949e]">{t("risk.approved")}</p>
                </div>
                <div className="bg-[#1c2128] p-3 rounded-lg text-center">
                  <p className="text-lg font-mono font-bold text-[#ff6b6b]">
                    {risk.decisions_24h.rejected}
                  </p>
                  <p className="text-xs text-[#8b949e]">{t("risk.rejected")}</p>
                </div>
              </div>
              {risk.decisions_24h.total > 0 && (
                <div className="mt-3">
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-[#8b949e]">
                      {t("risk.approval_rate")}
                    </span>
                    <span className="text-[#00d4aa] font-mono">
                      {risk.decisions_24h.approval_rate.toFixed(0)}%
                    </span>
                  </div>
                  <div className="h-1.5 bg-[#1c2128] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-[#00d4aa] rounded-full transition-all duration-500"
                      style={{ width: `${risk.decisions_24h.approval_rate}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Concentration Info */}
          {risk?.concentration?.top_ticker && (
            <div className="mt-4 pt-4 border-t border-[#30363d]">
              <p className="text-xs text-[#8b949e] tracking-widest mb-2">
                {t("risk.concentration")}
              </p>
              <div className="flex gap-3">
                <div className="bg-[#1c2128] p-3 rounded-lg flex-1 text-center">
                  <p className="text-xs text-[#8b949e] mb-1">
                    {t("risk.top_ticker")}
                  </p>
                  <p className="font-mono font-bold text-white">
                    {risk.concentration.top_ticker}
                  </p>
                </div>
                {risk.concentration.top_sector && (
                  <div className="bg-[#1c2128] p-3 rounded-lg flex-1 text-center">
                    <p className="text-xs text-[#8b949e] mb-1">
                      {t("risk.top_sector")}
                    </p>
                    <p className="font-mono font-bold text-white">
                      {risk.concentration.top_sector}
                    </p>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
