"use client";

import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { useI18n } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface AlphaEntry {
  pm_id: string;
  name: string;
  emoji: string;
  provider: string;
  total_return_pct: number;
  alpha_pct: number;
  sharpe: number;
  sortino: number;
  mdd: number;
  calmar?: number;
  data_days?: number;
}

interface ProviderEntry {
  provider: string;
  pms: string[];
  avg_return: number;
}

interface ConvictionBucket {
  range: string;
  total: number;
  correct: number;
  accuracy: number;
}

const PROVIDER_COLORS: Record<string, string> = {
  claude: "#00d4aa",
  openai: "#74aa9c",
  gemini: "#4285f4",
  grok: "#9b59b6",
  deepseek: "#e74c3c",
};

function returnColor(v: number) {
  return v > 0 ? "#00d4aa" : v < 0 ? "#ff6b6b" : "#8b949e";
}

export function AnalyticsTab() {
  const { t } = useI18n();
  const [alpha, setAlpha] = useState<AlphaEntry[]>([]);
  const [providers, setProviders] = useState<ProviderEntry[]>([]);
  const [conviction, setConviction] = useState<ConvictionBucket[]>([]);
  const [activeView, setActiveView] = useState<
    "alpha" | "providers" | "conviction"
  >("alpha");

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/fund/analytics/alpha`)
        .then((r) => r.json())
        .then((d) => setAlpha(d.leaderboard || [])),
      fetch(`${BASE_URL}/api/fund/analytics/provider`)
        .then((r) => r.json())
        .then((d) => setProviders(d.providers || [])),
      fetch(`${BASE_URL}/api/fund/analytics/conviction`)
        .then((r) => r.json())
        .then((d) => setConviction(d.buckets || [])),
    ]).catch(() => {});
  }, []);

  const views = [
    { id: "alpha" as const, label: t("anal.alpha") },
    { id: "providers" as const, label: t("anal.providers") },
    { id: "conviction" as const, label: t("anal.conviction_acc") },
  ];

  const returnBarData = alpha.map((pm) => ({
    name: pm.emoji + " " + pm.name.split(" ")[0],
    return: pm.total_return_pct,
    alpha: pm.alpha_pct,
  }));

  return (
    <div className="space-y-6">
      {/* View Toggle */}
      <div className="flex gap-2">
        {views.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveView(id)}
            className={`px-4 py-1.5 text-sm rounded-lg font-medium transition ${
              activeView === id
                ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/30"
                : "text-[#8b949e] hover:text-white border border-transparent"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Alpha Leaderboard View */}
      {activeView === "alpha" && (
        <div className="space-y-5">
          {/* Return Bar Chart */}
          {returnBarData.length > 0 && (
            <div className="glass-card p-5">
              <p className="text-xs text-[#8b949e] tracking-widest mb-4">
                {t("anal.pm_return")}
              </p>
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={returnBarData} barSize={18}>
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#8b949e", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8b949e", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1c2128",
                      border: "1px solid #30363d",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number | undefined) => [
                      `${(v ?? 0) >= 0 ? "+" : ""}${(v ?? 0).toFixed(2)}%`,
                      "Return",
                    ]}
                  />
                  <Bar dataKey="return" radius={[3, 3, 0, 0]}>
                    {returnBarData.map((entry, i) => (
                      <Cell
                        key={i}
                        fill={returnColor(entry.return)}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Full Leaderboard Table */}
          <div className="glass-card p-5">
            <p className="text-xs text-[#8b949e] tracking-widest mb-4">
              {t("anal.full_alpha")}
            </p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-[#8b949e] text-xs">
                    <th className="text-left pb-3">#</th>
                    <th className="text-left pb-3">PM</th>
                    <th className="text-right pb-3">{t("anal.return")}</th>
                    <th className="text-right pb-3">{t("anal.alpha_spy")}</th>
                    <th className="text-right pb-3 text-cyan-600">SHARPE</th>
                    <th className="text-right pb-3 text-cyan-600">SORTINO</th>
                    <th className="text-right pb-3 text-cyan-600">MAX DD</th>
                    <th className="text-right pb-3">{t("anal.days")}</th>
                  </tr>
                </thead>
                <tbody>
                  {alpha.map((pm, idx) => (
                    <tr
                      key={pm.pm_id}
                      className="border-t border-[#30363d] hover:bg-[#1c2128] transition"
                    >
                      <td className="py-2.5 text-[#8b949e] font-mono text-xs">
                        #{idx + 1}
                      </td>
                      <td className="py-2.5">
                        <span className="mr-2">{pm.emoji}</span>
                        <span className="font-medium">{pm.name}</span>
                        <span
                          className="ml-2 text-xs px-1.5 py-0.5 rounded"
                          style={{
                            backgroundColor: `${PROVIDER_COLORS[pm.provider] ?? "#8b949e"}20`,
                            color: PROVIDER_COLORS[pm.provider] ?? "#8b949e",
                          }}
                        >
                          {pm.provider}
                        </span>
                      </td>
                      <td
                        className="py-2.5 text-right font-mono"
                        style={{ color: returnColor(pm.total_return_pct) }}
                      >
                        {pm.total_return_pct >= 0 ? "+" : ""}
                        {pm.total_return_pct.toFixed(2)}%
                      </td>
                      <td
                        className="py-2.5 text-right font-mono"
                        style={{ color: returnColor(pm.alpha_pct) }}
                      >
                        {pm.alpha_pct >= 0 ? "+" : ""}
                        {pm.alpha_pct.toFixed(2)}%
                      </td>
                      <td className="py-2.5 text-right font-mono text-[#8b949e]">
                        {pm.sharpe ? pm.sharpe.toFixed(2) : "—"}
                      </td>
                      <td className="py-2.5 text-right font-mono text-[#8b949e]">
                        {pm.sortino ? pm.sortino.toFixed(2) : "—"}
                      </td>
                      <td
                        className="py-2.5 text-right font-mono"
                        style={{
                          color: pm.mdd < 0 ? "#ff6b6b" : "#8b949e",
                        }}
                      >
                        {pm.mdd ? `${(pm.mdd * 100).toFixed(1)}%` : "—"}
                      </td>
                      <td className="py-2.5 text-right text-[#8b949e] font-mono text-xs">
                        {pm.data_days ?? 0}d
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Provider View */}
      {activeView === "providers" && (
        <div className="space-y-5">
          <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
            {providers.map((prov) => (
              <div key={prov.provider} className="glass-card p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div
                    className="w-3 h-3 rounded-full"
                    style={{
                      backgroundColor:
                        PROVIDER_COLORS[prov.provider] ?? "#8b949e",
                    }}
                  />
                  <h3 className="font-bold capitalize">{prov.provider}</h3>
                  <span className="text-xs text-[#8b949e] ml-auto">
                    {prov.pms.length} PM{prov.pms.length !== 1 ? "s" : ""}
                  </span>
                </div>
                <div className="mb-4">
                  <p className="text-xs text-[#8b949e] mb-1">
                    {t("anal.avg_return")}
                  </p>
                  <p
                    className="text-2xl font-mono font-bold"
                    style={{ color: returnColor(prov.avg_return) }}
                  >
                    {prov.avg_return >= 0 ? "+" : ""}
                    {prov.avg_return.toFixed(2)}%
                  </p>
                </div>
                <div className="space-y-1">
                  {prov.pms.map((pmId) => {
                    const pmData = alpha.find((a) => a.pm_id === pmId);
                    return (
                      <div
                        key={pmId}
                        className="flex items-center justify-between text-sm bg-[#1c2128] px-3 py-1.5 rounded"
                      >
                        <span className="text-[#e6edf3]">
                          {pmData?.emoji} {pmData?.name ?? pmId}
                        </span>
                        {pmData && (
                          <span
                            className="font-mono text-xs"
                            style={{
                              color: returnColor(pmData.total_return_pct),
                            }}
                          >
                            {pmData.total_return_pct >= 0 ? "+" : ""}
                            {pmData.total_return_pct.toFixed(2)}%
                          </span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Provider Return Chart */}
          {providers.length > 0 && (
            <div className="glass-card p-5">
              <p className="text-xs text-[#8b949e] tracking-widest mb-4">
                {t("anal.provider_returns")}
              </p>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart
                  data={providers.map((p) => ({
                    name: p.provider,
                    value: p.avg_return,
                  }))}
                  barSize={40}
                >
                  <XAxis
                    dataKey="name"
                    tick={{ fill: "#8b949e", fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8b949e", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(1)}%`}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1c2128",
                      border: "1px solid #30363d",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number | undefined) => [
                      `${(v ?? 0) >= 0 ? "+" : ""}${(v ?? 0).toFixed(2)}%`,
                      "Avg Return",
                    ]}
                  />
                  <Bar dataKey="value" radius={[4, 4, 0, 0]}>
                    {providers.map((p, i) => (
                      <Cell
                        key={i}
                        fill={PROVIDER_COLORS[p.provider] ?? "#8b949e"}
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </div>
      )}

      {/* Conviction Accuracy View */}
      {activeView === "conviction" && (
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("anal.conviction_cal")}
          </p>
          {conviction.every((b) => b.total === 0) ? (
            <div className="text-center py-12 text-[#8b949e] text-sm">
              <p className="text-4xl mb-3">📊</p>
              <p>{t("anal.no_trades")}</p>
              <p className="mt-1">{t("anal.run_to_see")}</p>
            </div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={conviction} barSize={30}>
                  <XAxis
                    dataKey="range"
                    tick={{ fill: "#8b949e", fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    tick={{ fill: "#8b949e", fontSize: 9 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v: number) => `${v.toFixed(0)}%`}
                    domain={[0, 100]}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "#1c2128",
                      border: "1px solid #30363d",
                      borderRadius: 8,
                      fontSize: 12,
                    }}
                    formatter={(v: number | undefined) => [
                      `${(v ?? 0).toFixed(1)}%`,
                      "Accuracy",
                    ]}
                  />
                  <Bar dataKey="accuracy" radius={[4, 4, 0, 0]}>
                    {conviction.map((b, i) => (
                      <Cell
                        key={i}
                        fill={
                          b.accuracy >= 60
                            ? "#00d4aa"
                            : b.accuracy >= 40
                              ? "#f0b429"
                              : "#ff6b6b"
                        }
                        fillOpacity={0.85}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
              <div className="mt-4 overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[#8b949e] text-xs">
                      <th className="text-left pb-2">{t("anal.conv_range")}</th>
                      <th className="text-right pb-2">{t("anal.trades")}</th>
                      <th className="text-right pb-2">{t("anal.correct")}</th>
                      <th className="text-right pb-2">{t("anal.accuracy")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {conviction.map((b) => (
                      <tr key={b.range} className="border-t border-[#30363d]">
                        <td className="py-2 font-mono">{b.range}</td>
                        <td className="py-2 text-right text-[#8b949e]">
                          {b.total}
                        </td>
                        <td className="py-2 text-right text-[#8b949e]">
                          {b.correct}
                        </td>
                        <td
                          className="py-2 text-right font-mono font-bold"
                          style={{
                            color:
                              b.accuracy >= 60
                                ? "#00d4aa"
                                : b.accuracy >= 40
                                  ? "#f0b429"
                                  : "#ff6b6b",
                          }}
                        >
                          {b.accuracy.toFixed(1)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
