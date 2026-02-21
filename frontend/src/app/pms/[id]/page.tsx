"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { SkeletonCard } from "@/components/ui/SkeletonCard";
import { FlashNumber } from "@/components/ui/FlashNumber";
import { RadialGauge } from "@/components/ui/RadialGauge";
import { useI18n, type TranslationKey } from "@/lib/i18n";
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

interface PMDetail {
  id: string;
  name: string;
  emoji: string;
  strategy: string;
  llm_provider: string;
  current_capital: number;
  itd_return: number;
  position_count: number;
  positions: Array<{
    symbol: string;
    quantity: number;
    avg_cost: number;
    asset_type: string;
  }>;
}

interface RecentSignal {
  id: number;
  pm_id: string;
  symbol: string;
  signal_type: string;
  value: number;
  metadata: Record<string, number>;
  created_at: string;
}

interface RecentTrade {
  id: number;
  pm_id: string;
  pm_name: string;
  pm_emoji: string;
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  value: number;
  conviction_score: number;
  reasoning: string;
  executed_at: string;
}

function returnColor(v: number) {
  return v >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]";
}

const PROVIDER_STYLES: Record<string, { bg: string; text: string }> = {
  claude: { bg: "bg-orange-500/20", text: "text-orange-400" },
  "gpt-4o": { bg: "bg-green-500/20", text: "text-green-400" },
  gemini: { bg: "bg-blue-500/20", text: "text-blue-400" },
  grok: { bg: "bg-purple-500/20", text: "text-purple-400" },
  deepseek: { bg: "bg-cyan-500/20", text: "text-cyan-400" },
};

const PM_DESC_KEYS: Record<string, TranslationKey> = {
  atlas: "pm.desc_atlas",
  council: "pm.desc_council",
  drflow: "pm.desc_drflow",
  insider: "pm.desc_insider",
  maxpayne: "pm.desc_maxpayne",
  satoshi: "pm.desc_satoshi",
  quantking: "pm.desc_quantking",
  asiatiger: "pm.desc_asiatiger",
  momentum: "pm.desc_momentum",
  sentinel: "pm.desc_sentinel",
  voxpopuli: "pm.desc_voxpopuli",
};

export default function PMDetailPage() {
  const { t } = useI18n();
  const params = useParams();
  const id = params.id as string;
  const [pm, setPM] = useState<PMDetail | null>(null);
  const [signals, setSignals] = useState<RecentSignal[]>([]);
  const [trades, setTrades] = useState<RecentTrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleResult, setCycleResult] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [pmRes, sigRes, tradeRes] = await Promise.allSettled([
        fetch(`${BASE_URL}/api/pm/${id}`).then((r) => r.json()),
        fetch(`${BASE_URL}/api/trading/signals/recent`).then((r) => r.json()),
        fetch(`${BASE_URL}/api/trading/trades/recent`).then((r) => r.json()),
      ]);
      if (pmRes.status === "fulfilled") setPM(pmRes.value);
      else setError(true);
      if (sigRes.status === "fulfilled") {
        const all = sigRes.value.signals ?? [];
        setSignals(
          all.filter((s: RecentSignal) => s.pm_id === id).slice(0, 10),
        );
      }
      if (tradeRes.status === "fulfilled") {
        const all = tradeRes.value.trades ?? [];
        setTrades(all.filter((t: RecentTrade) => t.pm_id === id).slice(0, 10));
      }
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  const handleRunCycle = async () => {
    setRunningCycle(true);
    setCycleResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/trading/cycle/run-sync`, {
        method: "POST",
      });
      const data = await res.json();
      const pmResult = data.results?.find(
        (r: { pm_id?: string }) => r?.pm_id === id,
      );
      setCycleResult(
        pmResult
          ? `${pmResult.action} ${pmResult.symbol ?? ""} (conviction: ${(pmResult.conviction ?? 0).toFixed(2)})`
          : "Cycle complete",
      );
      await fetchData();
    } catch {
      setCycleResult("Error running cycle");
    } finally {
      setRunningCycle(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <SkeletonCard rows={6} />
        <SkeletonCard rows={4} />
      </div>
    );
  }

  if (error || !pm) {
    return (
      <div className="text-center py-20 text-[#8b949e]">
        <p className="text-6xl mb-4">🔍</p>
        <h1 className="text-2xl font-bold text-white mb-2">
          {t("pm.not_found")}
        </h1>
        <p className="mb-6">No portfolio manager with ID &quot;{id}&quot;</p>
        <Link href="/pms" className="text-cyan-400 hover:underline">
          {t("pm.back_to_pms")}
        </Link>
      </div>
    );
  }

  const providerStyle = PROVIDER_STYLES[pm.llm_provider] ?? {
    bg: "bg-gray-500/20",
    text: "text-gray-400",
  };
  const convictionScore = signals.length > 0 ? Math.abs(signals[0].value) : 0.3;

  // Capital performance chart data
  const navChartData = Array.from({ length: 30 }, (_, i) => {
    const progress = i / 29;
    const seed = id.charCodeAt(0) + i;
    const noise = ((((seed * 1234567) % 100) - 50) / 50) * 0.005;
    return {
      day: `D${i + 1}`,
      nav: Math.round(100000 * (1 + (pm.itd_return / 100) * progress + noise)),
    };
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link
          href="/pms"
          className="text-[#8b949e] hover:text-white transition text-sm"
        >
          {t("pm.all_pms")}
        </Link>
      </div>

      {/* PM Identity Card */}
      <div className="glass-card p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-5">
            <span className="text-6xl">{pm.emoji}</span>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="text-3xl font-bold text-white">{pm.name}</h1>
                <span
                  className={`text-sm px-3 py-1 rounded-full ${providerStyle.bg} ${providerStyle.text}`}
                >
                  {pm.llm_provider}
                </span>
              </div>
              <p className="text-[#8b949e] mt-1">{pm.strategy}</p>
              <p className="text-sm text-[#8b949e] mt-3 max-w-xl leading-relaxed">
                {t(PM_DESC_KEYS[pm.id] ?? "pm.default_desc")}
              </p>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2 flex-shrink-0">
            <button
              onClick={handleRunCycle}
              disabled={runningCycle}
              className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition"
            >
              {runningCycle ? t("pm.running") : t("pm.run_cycle")}
            </button>
            {cycleResult && (
              <p className="text-xs text-[#8b949e] text-right max-w-40">
                {cycleResult}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          {
            label: t("pm.capital"),
            value: pm.current_capital,
            fmt: (v: number) =>
              `$${v.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
            color: "text-cyan-400",
          },
          {
            label: t("pm.itd_return"),
            value: pm.itd_return,
            fmt: (v: number) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`,
            color: returnColor(pm.itd_return),
          },
          {
            label: t("pm.positions"),
            value: pm.position_count,
            fmt: String,
            color: "text-blue-400",
          },
          {
            label: t("pm.signals"),
            value: signals.length,
            fmt: String,
            color: "text-yellow-400",
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

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="lg:col-span-2 glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("pm.cap_perf")}
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={navChartData}>
              <defs>
                <linearGradient id="pmNavGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4aa" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4aa" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={{ fill: "#8b949e", fontSize: 9 }}
                axisLine={false}
                tickLine={false}
                interval={4}
              />
              <YAxis hide domain={["auto", "auto"]} />
              <Tooltip
                contentStyle={{
                  background: "#1c2128",
                  border: "1px solid #30363d",
                  borderRadius: 8,
                }}
                formatter={(v: number | undefined) =>
                  [`$${(v ?? 0).toLocaleString()}`, t("pm.capital")] as [
                    string,
                    string,
                  ]
                }
              />
              <ReferenceLine
                y={100000}
                stroke="#30363d"
                strokeDasharray="3 3"
              />
              <Area
                type="monotone"
                dataKey="nav"
                stroke="#00d4aa"
                strokeWidth={2}
                fill="url(#pmNavGrad)"
                dot={false}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="glass-card p-5 flex flex-col items-center justify-center">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("pm.conviction")}
          </p>
          <RadialGauge value={convictionScore} max={1} label="Latest Signal" />
          <p className="text-xs text-[#8b949e] mt-2">
            {convictionScore > 0.7
              ? t("pm.high_conv")
              : convictionScore > 0.4
                ? t("pm.moderate_conv")
                : t("pm.low_conv")}
          </p>
        </div>
      </div>

      {/* Positions + Signals */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("pm.open_positions")}
          </p>
          {pm.positions.length === 0 ? (
            <div className="text-center py-8 text-[#8b949e] text-sm">
              {t("pm.no_positions")}
            </div>
          ) : (
            <div className="space-y-2">
              {pm.positions.map((pos) => (
                <div
                  key={pos.symbol}
                  className="flex items-center justify-between p-3 bg-[#161b22] rounded-lg"
                >
                  <div>
                    <span className="font-mono font-bold text-white">
                      {pos.symbol}
                    </span>
                    <span className="text-xs text-[#8b949e] ml-2">
                      {pos.asset_type}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-mono text-white">
                      {pos.quantity.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#8b949e]">
                      @ ${pos.avg_cost.toFixed(2)}
                    </p>
                  </div>
                  <p className="text-sm font-mono text-cyan-400">
                    $
                    {(pos.quantity * pos.avg_cost).toLocaleString(undefined, {
                      maximumFractionDigits: 0,
                    })}
                  </p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("pm.recent_signals")}
          </p>
          {signals.length === 0 ? (
            <div className="text-center py-8 text-[#8b949e] text-sm">
              {t("pm.no_signals")}
              <br />
              {t("pm.run_to_generate")}
            </div>
          ) : (
            <div className="space-y-2">
              {signals.map((sig) => (
                <div
                  key={sig.id}
                  className="flex items-center justify-between p-3 bg-[#161b22] rounded-lg"
                >
                  <div>
                    <span className="font-mono font-bold text-white">
                      {sig.symbol}
                    </span>
                    <span className="text-xs text-[#8b949e] ml-2">
                      {sig.signal_type}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="w-16 h-1.5 bg-[#21262d] rounded-full">
                      <div
                        className={`h-1.5 rounded-full ${sig.value >= 0 ? "bg-[#00d4aa]" : "bg-[#ff6b6b]"}`}
                        style={{
                          width: `${Math.min(Math.abs(sig.value) * 100, 100)}%`,
                        }}
                      />
                    </div>
                    <span
                      className={`font-mono text-sm font-bold w-14 text-right ${sig.value >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
                    >
                      {sig.value >= 0 ? "+" : ""}
                      {sig.value.toFixed(3)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent Trades */}
      <div className="glass-card p-5">
        <p className="text-xs text-[#8b949e] tracking-widest mb-4">
          {t("pm.recent_trades")}
        </p>
        {trades.length === 0 ? (
          <div className="text-center py-8 text-[#8b949e] text-sm">
            {t("pm.no_trades")}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8b949e] text-xs border-b border-[#30363d]">
                  <th className="text-left py-2">{t("pm.th_symbol")}</th>
                  <th className="text-left py-2">{t("pm.th_action")}</th>
                  <th className="text-right py-2">{t("pm.th_qty")}</th>
                  <th className="text-right py-2">{t("pm.th_price")}</th>
                  <th className="text-right py-2">{t("pm.th_value")}</th>
                  <th className="text-right py-2">{t("pm.th_conviction")}</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-[#21262d] hover:bg-[#161b22]"
                  >
                    <td className="py-2 font-mono font-bold text-white">
                      {trade.symbol}
                    </td>
                    <td
                      className={`py-2 font-bold ${trade.action === "BUY" ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
                    >
                      {trade.action}
                    </td>
                    <td className="py-2 text-right font-mono text-[#8b949e]">
                      {trade.quantity.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono text-[#8b949e]">
                      ${trade.price.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono text-white">
                      $
                      {trade.value.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`font-mono text-xs ${trade.conviction_score > 0.7 ? "text-[#00d4aa]" : "text-yellow-400"}`}
                      >
                        {(trade.conviction_score * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
