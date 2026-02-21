"use client";

import { useEffect, useState, useRef } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
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

interface NavPoint {
  date: string;
  nav: number;
  return_pct: number;
  cumulative_return_pct: number;
}

interface RadarData {
  concentration: number;
  volatility: number;
  drawdown: number;
  correlation: number;
  leverage: number;
  liquidity: number;
}

interface NavSummary {
  current_nav: number;
  initial_nav: number;
  total_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  data_days: number;
}

function buildAlerts(
  stats: FundStats | null,
  riskData: RiskData | null,
  navSummary: NavSummary | null,
  t: (key: TranslationKey) => string,
): Array<{ level: AlertLevel; message: string }> {
  const alerts: Array<{ level: AlertLevel; message: string }> = [];
  if (!stats) return [{ level: "ok", message: t("ov.alert_connecting") }];

  if (navSummary?.max_drawdown_pct && navSummary.max_drawdown_pct > 10) {
    alerts.push({
      level: "danger",
      message: `MDD ${navSummary.max_drawdown_pct.toFixed(1)}% — ${t("ov.alert_dd_exceeded")}`,
    });
  } else if (stats.itd_return < -3) {
    alerts.push({
      level: "warn",
      message: `ITD ${stats.itd_return.toFixed(1)}% — ${t("ov.alert_loss")}`,
    });
  }

  if (riskData?.vix && riskData.vix > 30) {
    alerts.push({
      level: "danger",
      message: `VIX ${riskData.vix.toFixed(1)} — ${t("ov.alert_fear")}`,
    });
  } else if (riskData?.vix && riskData.vix > 20) {
    alerts.push({
      level: "warn",
      message: `VIX ${riskData.vix.toFixed(1)} — ${t("ov.alert_vol")}`,
    });
  }

  if (navSummary?.sharpe_ratio && navSummary.sharpe_ratio > 1.5) {
    alerts.push({
      level: "ok",
      message: `Sharpe ${navSummary.sharpe_ratio.toFixed(2)} — ${t("ov.alert_excellent")}`,
    });
  }

  if (alerts.length === 0) {
    alerts.push({
      level: "ok",
      message: t("ov.alert_normal"),
    });
  }

  return alerts;
}

export default function OverviewPage() {
  const { t } = useI18n();
  const [stats, setStats] = useState<FundStats | null>(null);
  const [pms, setPMs] = useState<PMSummary[]>([]);
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [navHistory, setNavHistory] = useState<NavPoint[]>([]);
  const [navSummary, setNavSummary] = useState<NavSummary | null>(null);
  const [radarData, setRadarData] = useState<RadarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [liveConnected, setLiveConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchAll = async () => {
    try {
      const [statsRes, pmsRes, riskRes, navHistRes, navSumRes, radarRes] =
        await Promise.allSettled([
          fetch(`${BASE_URL}/api/fund/stats`).then((r) => r.json()),
          fetch(`${BASE_URL}/api/fund/pms`).then((r) => r.json()),
          fetch(`${BASE_URL}/api/fund/risk/overview`).then((r) => r.json()),
          fetch(`${BASE_URL}/api/fund/nav/history`).then((r) => r.json()),
          fetch(`${BASE_URL}/api/trading/nav/summary`).then((r) => r.json()),
          fetch(`${BASE_URL}/api/trading/risk/concentration`).then((r) =>
            r.json(),
          ),
        ]);

      if (statsRes.status === "fulfilled") setStats(statsRes.value);
      if (pmsRes.status === "fulfilled") setPMs(pmsRes.value);
      if (riskRes.status === "fulfilled") setRisk(riskRes.value);
      if (navHistRes.status === "fulfilled" && navHistRes.value.history) {
        const pts = navHistRes.value.history.map(
          (h: {
            date: string;
            nav: number;
            daily_return_pct: number;
            cumulative_return_pct: number;
          }) => ({
            date: h.date.substring(5),
            nav: h.nav,
            return_pct: h.daily_return_pct,
            cumulative_return_pct: h.cumulative_return_pct,
          }),
        );
        setNavHistory(pts.slice(-30));
      }
      if (navSumRes.status === "fulfilled") setNavSummary(navSumRes.value);
      if (radarRes.status === "fulfilled" && radarRes.value.radar) {
        setRadarData(radarRes.value.radar);
      }
    } catch {
      // silently handle
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();

    const wsUrl = BASE_URL.replace("http", "ws") + "/api/fund/ws/live";
    const connectWs = () => {
      try {
        const ws = new WebSocket(wsUrl);
        wsRef.current = ws;
        ws.onopen = () => setLiveConnected(true);
        ws.onclose = () => {
          setLiveConnected(false);
          setTimeout(connectWs, 5000);
        };
        ws.onerror = () => setLiveConnected(false);
        ws.onmessage = (e) => {
          try {
            const msg = JSON.parse(e.data);
            if (msg.type === "nav_update" && msg.data) {
              setStats((prev) =>
                prev
                  ? {
                      ...prev,
                      nav: msg.data.nav,
                      today_return: msg.data.daily_return_pct,
                    }
                  : prev,
              );
            }
          } catch {
            /* ignore */
          }
        };
      } catch {
        setLiveConnected(false);
      }
    };

    connectWs();
    const interval = setInterval(fetchAll, 30_000);
    return () => {
      clearInterval(interval);
      wsRef.current?.close();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const alerts = buildAlerts(stats, risk, navSummary, t);
  const fmtCurrency = (v: number) =>
    `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`;
  const fmtPct = (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`;
  const fmtNum = (v: number) => v.toFixed(2);

  return (
    <div className="space-y-4">
      <AlertBanner alerts={alerts} />

      <div className="grid grid-cols-3 lg:grid-cols-7 gap-px bg-[#30363d] rounded-xl overflow-hidden">
        {[
          {
            label: t("ov.fund_nav"),
            value: stats?.nav ?? 0,
            fmt: fmtCurrency,
            color: "text-cyan-400",
          },
          {
            label: t("ov.today"),
            value: stats?.today_return ?? 0,
            fmt: fmtPct,
            color:
              (stats?.today_return ?? 0) >= 0
                ? "text-[#00d4aa]"
                : "text-[#ff6b6b]",
          },
          {
            label: t("ov.itd_return"),
            value: stats?.itd_return ?? 0,
            fmt: fmtPct,
            color:
              (stats?.itd_return ?? 0) >= 0
                ? "text-[#00d4aa]"
                : "text-[#ff6b6b]",
          },
          {
            label: t("ov.sharpe"),
            value: navSummary?.sharpe_ratio ?? 0,
            fmt: fmtNum,
            color:
              (navSummary?.sharpe_ratio ?? 0) >= 1.5
                ? "text-[#00d4aa]"
                : "text-yellow-400",
          },
          {
            label: t("ov.max_dd"),
            value: -(navSummary?.max_drawdown_pct ?? 0),
            fmt: fmtPct,
            color: "text-[#ff6b6b]",
          },
          {
            label: t("ov.active_pms"),
            value: stats?.active_pms ?? 0,
            fmt: String,
            color: "text-blue-400",
          },
          {
            label: t("ov.positions"),
            value: stats?.total_positions ?? 0,
            fmt: String,
            color: "text-yellow-400",
          },
        ].map(({ label, value, fmt, color }) => (
          <div
            key={label}
            className="bg-[#0d1117] px-4 py-5 flex flex-col items-center"
          >
            <FlashNumber
              value={value}
              format={fmt}
              className={`text-xl font-mono font-bold ${color}`}
            />
            <span className="text-xs text-[#8b949e] tracking-widest mt-1">
              {label}
            </span>
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
            mdd={(navSummary?.max_drawdown_pct ?? 0) / 100}
            sharpe={navSummary?.sharpe_ratio ?? 0}
          />
          <NAVSparkline data={navHistory} />
          <RiskRadar
            grossExposure={risk?.exposure?.gross_pct ?? 0}
            netExposure={risk?.exposure?.net_pct ?? 0}
            marginUtil={risk?.margin?.utilization_pct ?? 0}
            concentration={radarData?.concentration ?? 0}
            volatility={radarData?.volatility ?? 0}
          />
        </div>
      )}

      {loading ? <SkeletonCard rows={3} /> : <PMHeatmap pms={pms} />}

      <div className="flex items-center justify-end gap-2 text-xs text-[#8b949e]">
        <div
          className={`w-2 h-2 rounded-full ${liveConnected ? "bg-[#00d4aa] animate-pulse" : "bg-gray-600"}`}
        />
        {liveConnected ? t("ov.ws_live") : t("ov.polling")}
      </div>
    </div>
  );
}
