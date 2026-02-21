"use client";

import { useEffect, useState } from "react";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { FlashNumber } from "@/components/ui/FlashNumber";
import { useI18n } from "@/lib/i18n";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from "recharts";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const FEED_TYPE_COLORS: Record<string, string> = {
  trade: "bg-blue-500/20 text-blue-300",
  research: "bg-purple-500/20 text-purple-300",
  risk_decision: "bg-red-500/20 text-red-300",
  negotiation: "bg-yellow-500/20 text-yellow-300",
};

interface FeedItem {
  emoji: string;
  type: string;
  summary: string;
  time: string | null;
}

interface NavPoint {
  date: string;
  nav: number;
  daily_return_pct: number;
  cumulative_return_pct: number;
}

interface NavSummary {
  current_nav: number;
  total_return_pct: number;
  sharpe_ratio: number;
  max_drawdown_pct: number;
  data_days: number;
}

interface PMPerf {
  id: string;
  name: string;
  emoji: string;
  strategy: string;
  llm_provider: string;
  current_capital: number;
  itd_return: number;
  trade_count: number;
}

export function DashboardTab() {
  const { t } = useI18n();
  const [feed, setFeed] = useState<FeedItem[]>([]);
  const [navHistory, setNavHistory] = useState<NavPoint[]>([]);
  const [navSummary, setNavSummary] = useState<NavSummary | null>(null);
  const [pmPerf, setPMPerf] = useState<PMPerf[]>([]);
  const [loading, setLoading] = useState(true);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleMsg, setCycleMsg] = useState<string | null>(null);

  const fetchData = () => {
    Promise.all([
      fetch(`${BASE_URL}/api/fund/activity-feed`)
        .then((r) => r.json())
        .then((d) => setFeed(d.items || [])),
      fetch(`${BASE_URL}/api/fund/nav/history`)
        .then((r) => r.json())
        .then((d) => setNavHistory((d.history || []).slice(-60))),
      fetch(`${BASE_URL}/api/trading/nav/summary`)
        .then((r) => r.json())
        .then(setNavSummary),
      fetch(`${BASE_URL}/api/fund/pm-performance`)
        .then((r) => r.json())
        .then((d) => setPMPerf(d.pms || []))
        .catch(() => {
          fetch(`${BASE_URL}/api/fund/pms`)
            .then((r) => r.json())
            .then((pms) =>
              setPMPerf(pms.map((p: PMPerf) => ({ ...p, trade_count: 0 }))),
            );
        }),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 30_000);
    return () => clearInterval(interval);
  }, []);

  const handleRunCycle = async () => {
    setRunningCycle(true);
    setCycleMsg(null);
    try {
      const res = await fetch(`${BASE_URL}/api/trading/cycle/run-sync`, {
        method: "POST",
      });
      const data = await res.json();
      const trades =
        data.results?.filter(
          (r: { action?: string }) =>
            r?.action === "BUY" || r?.action === "SELL",
        ).length ?? 0;
      setCycleMsg(
        `${t("dash.cycle_complete")}: ${trades} ${t("dash.trades_executed")}`,
      );
      fetchData();
    } catch {
      setCycleMsg(t("dash.error_cycle"));
    } finally {
      setRunningCycle(false);
    }
  };

  const isPositive = (navHistory.at(-1)?.cumulative_return_pct ?? 0) >= 0;
  const chartColor = isPositive ? "#00d4aa" : "#ff6b6b";

  if (loading) {
    return (
      <div className="space-y-5">
        <div className="grid grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="glass-card h-20 animate-pulse" />
          ))}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
          <SkeletonCard rows={6} />
          <SkeletonCard rows={8} />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Stats + Run Cycle */}
      <div className="flex items-center justify-between">
        <div className="grid grid-cols-4 gap-4 flex-1 mr-4">
          {[
            {
              label: t("dash.fund_nav"),
              value: navSummary?.current_nav ?? 0,
              fmt: (v: number) =>
                `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              color: "text-cyan-400",
            },
            {
              label: t("dash.itd_return"),
              value: navSummary?.total_return_pct ?? 0,
              fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
              color:
                (navSummary?.total_return_pct ?? 0) >= 0
                  ? "text-[#00d4aa]"
                  : "text-[#ff6b6b]",
            },
            {
              label: t("dash.sharpe"),
              value: navSummary?.sharpe_ratio ?? 0,
              fmt: (v: number) => v.toFixed(2),
              color:
                (navSummary?.sharpe_ratio ?? 0) >= 1.5
                  ? "text-[#00d4aa]"
                  : "text-yellow-400",
            },
            {
              label: t("dash.max_dd"),
              value: -(navSummary?.max_drawdown_pct ?? 0),
              fmt: (v: number) => `${v.toFixed(2)}%`,
              color: "text-[#ff6b6b]",
            },
          ].map(({ label, value, fmt, color }) => (
            <div key={label} className="glass-card p-4 text-center">
              <p className="text-xs text-[#8b949e] tracking-widest">{label}</p>
              <FlashNumber
                value={value}
                format={fmt}
                className={`text-xl font-mono font-bold ${color}`}
              />
            </div>
          ))}
        </div>
        <div className="flex flex-col gap-2 items-end">
          <button
            onClick={handleRunCycle}
            disabled={runningCycle}
            className="px-5 py-2.5 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition whitespace-nowrap"
          >
            {runningCycle ? t("dash.running") : `▶ ${t("dash.run_all")}`}
          </button>
          {cycleMsg && <p className="text-xs text-[#8b949e]">{cycleMsg}</p>}
        </div>
      </div>

      {/* NAV Chart */}
      <div className="glass-card p-5">
        <p className="text-xs text-[#8b949e] tracking-widest mb-4">
          {t("dash.nav_history")}
        </p>
        {navHistory.length < 2 ? (
          <div className="h-40 flex items-center justify-center text-[#8b949e] text-sm">
            {t("dash.loading_nav")}
          </div>
        ) : (
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={navHistory}>
              <defs>
                <linearGradient id="dashNavGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={chartColor} stopOpacity={0.3} />
                  <stop offset="95%" stopColor={chartColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="date"
                tick={{ fill: "#8b949e", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={Math.floor(navHistory.length / 6)}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "#1c2128",
                  border: "1px solid #30363d",
                  borderRadius: 8,
                }}
                formatter={(v: number | undefined) => [
                  `$${(v ?? 0).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
                  "NAV",
                ]}
              />
              <ReferenceLine
                y={navHistory[0]?.nav}
                stroke="#30363d"
                strokeDasharray="3 3"
              />
              <Area
                type="monotone"
                dataKey="nav"
                stroke={chartColor}
                strokeWidth={2}
                fill="url(#dashNavGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* PM Leaderboard */}
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("dash.pm_leaderboard")}
          </p>
          <div className="space-y-2">
            {pmPerf.slice(0, 8).map((pm, idx) => (
              <div
                key={pm.id}
                className="flex items-center gap-3 p-2.5 bg-[#1c2128] rounded-lg hover:bg-[#21262d] transition"
              >
                <span className="text-xs text-[#8b949e] w-4 text-center font-mono">
                  #{idx + 1}
                </span>
                <span className="text-lg">{pm.emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {pm.name}
                  </p>
                  <p className="text-xs text-[#8b949e] truncate">
                    {pm.strategy}
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className={`font-mono font-bold text-sm ${pm.itd_return >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
                  >
                    {pm.itd_return >= 0 ? "+" : ""}
                    {pm.itd_return.toFixed(2)}%
                  </p>
                  <p className="text-xs text-[#8b949e]">
                    $
                    {pm.current_capital.toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Activity Feed */}
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("dash.activity_feed")}
          </p>
          <div className="max-h-72 overflow-y-auto">
            {feed.length > 0 ? (
              <div className="relative pl-6">
                <div className="absolute left-2 top-0 bottom-0 w-px bg-[#30363d]" />
                {feed.map((item, i) => (
                  <div key={i} className="relative flex items-start gap-3 pb-3">
                    <div
                      className="absolute left-[-16px] top-1.5 w-3 h-3 rounded-full border-2 border-[#0d1117]"
                      style={{
                        backgroundColor:
                          item.type === "trade"
                            ? "#3b82f6"
                            : item.type === "risk_decision"
                              ? "#ff6b6b"
                              : item.type === "research"
                                ? "#a855f7"
                                : "#f0b429",
                      }}
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-0.5">
                        <span>{item.emoji}</span>
                        <span
                          className={`text-xs px-1.5 py-0.5 rounded ${FEED_TYPE_COLORS[item.type] ?? "bg-gray-500/20 text-gray-400"}`}
                        >
                          {item.type}
                        </span>
                        <span className="text-xs text-[#8b949e] ml-auto shrink-0">
                          {item.time
                            ? new Date(item.time).toLocaleString("ko-KR", {
                                year: "numeric",
                                month: "2-digit",
                                day: "2-digit",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : ""}
                        </span>
                      </div>
                      <p className="text-sm text-[#e6edf3]">{item.summary}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-[#8b949e] text-sm">
                {t("dash.no_activity")}
                <br />
                {t("dash.run_to_see")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
