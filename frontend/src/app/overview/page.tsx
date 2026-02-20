"use client";

import { useEffect, useState } from "react";
import { FundHealthBadge } from "./components/FundHealthBadge";
import { PMHeatmap } from "./components/PMHeatmap";
import { NAVSparkline } from "./components/NAVSparkline";
import { RiskRadar } from "./components/RiskRadar";
import { AlertBanner, AlertLevel } from "./components/AlertBanner";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { FlashNumber } from "@/components/ui/FlashNumber";
import { FundStats, PMSummary } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface RiskData {
  exposure: { gross_pct: number; net_pct: number };
  margin: { utilization_pct: number };
  vix: number | null;
}

function buildAlerts(
  stats: FundStats | null,
  riskData: RiskData | null
): Array<{ level: AlertLevel; message: string }> {
  const alerts: Array<{ level: AlertLevel; message: string }> = [];
  if (!stats) return alerts;
  if (stats.itd_return < -10)
    alerts.push({ level: "danger", message: `ITD ${stats.itd_return.toFixed(1)}% — MDD threshold exceeded` });
  else if (stats.itd_return < -3)
    alerts.push({ level: "warn", message: `ITD ${stats.itd_return.toFixed(1)}% — Loss warning` });
  if (riskData?.vix && riskData.vix > 30)
    alerts.push({ level: "danger", message: `VIX ${riskData.vix} — Extreme fear` });
  else if (riskData?.vix && riskData.vix > 20)
    alerts.push({ level: "warn", message: `VIX ${riskData.vix} — Volatility rising` });
  if (alerts.length === 0)
    alerts.push({ level: "ok", message: "All indicators within normal range" });
  return alerts;
}

export default function OverviewPage() {
  const [stats, setStats] = useState<FundStats | null>(null);
  const [pms, setPMs] = useState<PMSummary[]>([]);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/fund/stats`).then((r) => r.json()).then(setStats),
      fetch(`${BASE_URL}/api/fund/pms`).then((r) => r.json()).then(setPMs),
      fetch(`${BASE_URL}/api/fund/risk/overview`).then((r) => r.json()).then(setRisk),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));

    const interval = setInterval(() => {
      fetch(`${BASE_URL}/api/fund/stats`)
        .then((r) => r.json())
        .then(setStats)
        .catch(() => {});
    }, 30_000);
    return () => clearInterval(interval);
  }, []);

  const alerts = buildAlerts(stats, risk);
  const fmtCurrency = (v: number) =>
    `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;

  return (
    <div className="space-y-4">
      <AlertBanner alerts={alerts} />

      <div className="grid grid-cols-3 lg:grid-cols-6 gap-px bg-[#30363d] rounded-xl overflow-hidden">
        {[
          { label: "FUND NAV", value: stats?.nav ?? 0, fmt: fmtCurrency, color: "text-cyan-400" },
          { label: "TODAY", value: stats?.today_return ?? 0, fmt: fmtPct, color: (stats?.today_return ?? 0) >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]" },
          { label: "ITD RETURN", value: stats?.itd_return ?? 0, fmt: fmtPct, color: (stats?.itd_return ?? 0) >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]" },
          { label: "ACTIVE PMs", value: stats?.active_pms ?? 0, fmt: String, color: "text-blue-400" },
          { label: "POSITIONS", value: stats?.total_positions ?? 0, fmt: String, color: "text-yellow-400" },
          { label: "LIVE", value: 0, fmt: () => "", color: "" },
        ].map(({ label, value, fmt, color }) => (
          <div key={label} className="bg-[#0d1117] px-4 py-5 flex flex-col items-center">
            {label === "LIVE" ? (
              <>
                <div className="live-dot mb-1" />
                <span className="text-xs text-[#8b949e] tracking-widest">LIVE</span>
              </>
            ) : (
              <>
                <FlashNumber
                  value={value}
                  format={fmt}
                  className={`text-2xl font-mono font-bold ${color}`}
                />
                <span className="text-xs text-[#8b949e] tracking-widest mt-1">{label}</span>
              </>
            )}
          </div>
        ))}
      </div>

      {loading ? (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
          <SkeletonCard rows={5} />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <FundHealthBadge
            itdReturn={(stats?.itd_return ?? 0) / 100}
            mdd={0}
            sharpe={0}
          />
          <NAVSparkline data={[]} />
          <RiskRadar
            grossExposure={risk?.exposure?.gross_pct ?? 0}
            netExposure={risk?.exposure?.net_pct ?? 0}
            marginUtil={risk?.margin?.utilization_pct ?? 0}
            concentration={0}
            volatility={0}
          />
        </div>
      )}

      {loading ? <SkeletonCard rows={3} /> : <PMHeatmap pms={pms} />}
    </div>
  );
}
