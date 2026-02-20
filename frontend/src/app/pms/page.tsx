"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PMSummary } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

const PROVIDER_COLORS: Record<string, string> = {
  claude: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  "gpt-4o": "bg-green-500/20 text-green-400 border-green-500/30",
  gemini: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  grok: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  deepseek: "bg-cyan-500/20 text-cyan-400 border-cyan-500/30",
  default: "bg-gray-500/20 text-gray-400 border-gray-500/30",
};

const STRATEGY_TAGS: Record<string, string> = {
  "Macro Regime": "🌍",
  "Multi-Persona": "🏛️",
  "Event-Driven": "🔬",
  "Smart Money": "🕵️",
  "Contrarian": "💀",
  "Crypto": "₿",
  "Pure Quant": "📊",
  "Asia Markets": "🌏",
  "Trend Following": "⚡",
  "Risk Hedge": "🛡️",
  "Social Signals": "📱",
};

function ReturnBadge({ value }: { value: number }) {
  const isPos = value >= 0;
  return (
    <span className={`font-mono font-bold text-lg ${isPos ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}>
      {isPos ? "+" : ""}{value.toFixed(2)}%
    </span>
  );
}

function MiniBar({ value, max = 10 }: { value: number; max?: number }) {
  const pct = Math.min(Math.abs(value) / max * 100, 100);
  const isPos = value >= 0;
  return (
    <div className="w-full bg-[#21262d] rounded-full h-1.5 mt-1">
      <div
        className={`h-1.5 rounded-full transition-all ${isPos ? "bg-[#00d4aa]" : "bg-[#ff6b6b]"}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

export default function PMsPage() {
  const [pms, setPMs] = useState<PMSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortBy, setSortBy] = useState<"return" | "capital" | "name">("return");

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/pms`)
      .then((r) => r.json())
      .then((data) => { setPMs(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, []);

  const sorted = [...pms].sort((a, b) => {
    if (sortBy === "return") return b.itd_return - a.itd_return;
    if (sortBy === "capital") return b.current_capital - a.current_capital;
    return a.name.localeCompare(b.name);
  });

  const totalNAV = pms.reduce((s, p) => s + p.current_capital, 0);
  const bestPM = pms.reduce((best, p) => (!best || p.itd_return > best.itd_return) ? p : best, pms[0]);
  const avgReturn = pms.length ? pms.reduce((s, p) => s + p.itd_return, 0) / pms.length : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">AI Portfolio Managers</h1>
          <p className="text-[#8b949e] text-sm mt-1">11 AI personalities, each with distinct strategies</p>
        </div>
        <div className="flex gap-2">
          {(["return", "capital", "name"] as const).map((s) => (
            <button
              key={s}
              onClick={() => setSortBy(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${sortBy === s ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" : "border-[#30363d] text-[#8b949e] hover:border-[#8b949e]"}`}
            >
              {s === "return" ? "By Return" : s === "capital" ? "By Capital" : "By Name"}
            </button>
          ))}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-3 gap-4">
        <div className="glass-card p-4">
          <p className="text-xs text-[#8b949e] tracking-widest">TOTAL NAV</p>
          <p className="text-xl font-mono font-bold text-cyan-400">${totalNAV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-[#8b949e] tracking-widest">AVG RETURN</p>
          <p className={`text-xl font-mono font-bold ${avgReturn >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}>
            {avgReturn >= 0 ? "+" : ""}{avgReturn.toFixed(2)}%
          </p>
        </div>
        <div className="glass-card p-4">
          <p className="text-xs text-[#8b949e] tracking-widest">BEST PM</p>
          <p className="text-xl font-mono font-bold text-yellow-400">
            {bestPM ? `${bestPM.emoji} ${bestPM.name}` : "—"}
          </p>
        </div>
      </div>

      {/* PM Grid */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 11 }).map((_, i) => (
            <div key={i} className="glass-card p-6 animate-pulse h-40" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((pm, idx) => {
            const providerColor = PROVIDER_COLORS[pm.llm_provider] ?? PROVIDER_COLORS.default;
            const allocationPct = totalNAV > 0 ? (pm.current_capital / totalNAV * 100) : 0;
            return (
              <Link key={pm.id} href={`/pms/${pm.id}`}>
                <div className="glass-card p-5 hover:border-cyan-500/50 transition-all cursor-pointer group">
                  {/* Rank Badge */}
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      <span className="text-3xl">{pm.emoji}</span>
                      <div>
                        <div className="flex items-center gap-2">
                          <h2 className="font-bold text-white group-hover:text-cyan-400 transition">{pm.name}</h2>
                          <span className="text-xs text-[#8b949e]">#{idx + 1}</span>
                        </div>
                        <p className="text-xs text-[#8b949e]">{STRATEGY_TAGS[pm.strategy] ?? ""} {pm.strategy}</p>
                      </div>
                    </div>
                    <span className={`text-xs px-2 py-0.5 rounded border ${providerColor}`}>
                      {pm.llm_provider}
                    </span>
                  </div>

                  {/* Stats */}
                  <div className="flex justify-between items-end">
                    <div>
                      <p className="text-xs text-[#8b949e]">CAPITAL</p>
                      <p className="font-mono text-white text-sm">${pm.current_capital.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
                      <p className="text-xs text-[#8b949e]">{allocationPct.toFixed(1)}% of fund</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-[#8b949e]">ITD RETURN</p>
                      <ReturnBadge value={pm.itd_return} />
                    </div>
                  </div>

                  {/* Return Bar */}
                  <MiniBar value={pm.itd_return} max={10} />

                  <div className="mt-3 text-xs text-[#8b949e] group-hover:text-cyan-400 transition">
                    View details →
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
