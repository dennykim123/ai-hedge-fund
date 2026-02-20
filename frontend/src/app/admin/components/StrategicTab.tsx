"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

interface PMGoal {
  id: string;
  name: string;
  emoji: string;
  strategy: string;
  llm_provider: string;
  goal: string;
  current_capital: number;
  itd_return: number;
}

interface StrategicOverview {
  regime: string;
  regime_confidence: number;
  avg_daily_return_pct: number;
  pms: PMGoal[];
}

interface Thesis {
  pm_id: string;
  pm_name: string;
  pm_emoji: string;
  thesis: string;
  status: "active" | "flagged" | "invalidated";
  confidence: number;
}

interface SocialSignal {
  symbol: string;
  is_tipping_point: boolean;
  zscore: number;
  direction: string;
  conviction: number;
  reddit_mentions: number;
  trends_interest: number;
  trends_trending: boolean;
}

const REGIME_CONFIG = {
  bull: { emoji: "🚀", color: "text-[#00d4aa]", bg: "bg-[#00d4aa]/10", label: "Bull Market" },
  bear: { emoji: "🐻", color: "text-[#ff6b6b]", bg: "bg-[#ff6b6b]/10", label: "Bear Market" },
  neutral: { emoji: "⚖️", color: "text-yellow-400", bg: "bg-yellow-400/10", label: "Neutral / Sideways" },
  normal: { emoji: "📊", color: "text-gray-400", bg: "bg-gray-400/10", label: "Normal" },
};

const STATUS_STYLES = {
  active: "bg-[#00d4aa]/20 text-[#00d4aa] border-[#00d4aa]/30",
  flagged: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  invalidated: "bg-[#ff6b6b]/20 text-[#ff6b6b] border-[#ff6b6b]/30",
};

export function StrategicTab() {
  const [overview, setOverview] = useState<StrategicOverview | null>(null);
  const [theses, setTheses] = useState<Thesis[]>([]);
  const [socialSignals, setSocialSignals] = useState<SocialSignal[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/fund/strategic/overview`).then((r) => r.json()).then(setOverview),
      fetch(`${BASE_URL}/api/fund/strategic/thesis-health`).then((r) => r.json()).then((d) => setTheses(d.theses || [])),
      fetch(`${BASE_URL}/api/fund/strategic/social-signals`).then((r) => r.json()).then((d) => setSocialSignals(d.signals || [])),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const regime = overview?.regime ?? "neutral";
  const regimeCfg = REGIME_CONFIG[regime as keyof typeof REGIME_CONFIG] ?? REGIME_CONFIG.neutral;

  if (loading) {
    return <div className="space-y-4 animate-pulse">{Array.from({ length: 3 }).map((_, i) => <div key={i} className="glass-card h-40" />)}</div>;
  }

  return (
    <div className="space-y-5">
      {/* Market Regime */}
      <div className={`glass-card p-5 ${regimeCfg.bg} border-opacity-50`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="text-4xl">{regimeCfg.emoji}</span>
            <div>
              <p className="text-xs text-[#8b949e] tracking-widest">MARKET REGIME</p>
              <p className={`text-2xl font-bold ${regimeCfg.color}`}>{regimeCfg.label}</p>
              <p className="text-sm text-[#8b949e]">
                Confidence: {((overview?.regime_confidence ?? 0) * 100).toFixed(0)}% |
                Avg Daily: {overview?.avg_daily_return_pct && overview.avg_daily_return_pct >= 0 ? "+" : ""}{(overview?.avg_daily_return_pct ?? 0).toFixed(3)}%
              </p>
            </div>
          </div>
          <div className="text-right">
            <div className="w-24 h-24 rounded-full border-4 border-[#30363d] flex items-center justify-center">
              <div className="text-center">
                <p className={`text-xl font-mono font-bold ${regimeCfg.color}`}>
                  {((overview?.regime_confidence ?? 0) * 100).toFixed(0)}%
                </p>
                <p className="text-xs text-[#8b949e]">conf</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Thesis Health */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#8b949e] tracking-widest">THESIS HEALTH</p>
            <div className="flex gap-2 text-xs">
              <span className="text-[#00d4aa]">{theses.filter(t => t.status === "active").length} Active</span>
              <span className="text-yellow-400">{theses.filter(t => t.status === "flagged").length} Flagged</span>
              <span className="text-[#ff6b6b]">{theses.filter(t => t.status === "invalidated").length} Invalid</span>
            </div>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {theses.map((t) => (
              <div key={t.pm_id} className="flex items-center gap-3 p-2 bg-[#1c2128] rounded-lg">
                <span>{t.pm_emoji}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{t.pm_name}</p>
                  <p className="text-xs text-[#8b949e] truncate">{t.thesis}</p>
                </div>
                <span className={`text-xs px-2 py-0.5 rounded border flex-shrink-0 ${STATUS_STYLES[t.status]}`}>
                  {t.status}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Social Tipping Points */}
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs text-[#8b949e] tracking-widest">SOCIAL TIPPING POINTS</p>
            <span className="text-xs text-[#8b949e]">📱 Vox Populi</span>
          </div>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {socialSignals.slice(0, 8).map((sig) => (
              <div key={sig.symbol} className={`p-3 rounded-lg border ${sig.is_tipping_point ? "bg-[#ff6b6b]/10 border-[#ff6b6b]/30" : "bg-[#1c2128] border-[#30363d]"}`}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {sig.is_tipping_point && <span className="text-sm animate-pulse">🚨</span>}
                    <span className="font-mono font-bold text-white">{sig.symbol}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${sig.direction === "bullish" ? "bg-[#00d4aa]/20 text-[#00d4aa]" : sig.direction === "bearish" ? "bg-[#ff6b6b]/20 text-[#ff6b6b]" : "bg-gray-500/20 text-gray-400"}`}>
                      {sig.direction}
                    </span>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-mono text-[#8b949e]">Z: {sig.zscore.toFixed(1)}σ</p>
                    <p className="text-xs text-[#8b949e]">Reddit: {sig.reddit_mentions}</p>
                  </div>
                </div>
                {sig.is_tipping_point && (
                  <p className="text-xs text-[#ff6b6b] mt-1">
                    ⚡ Tipping point detected! Conviction: {(sig.conviction * 100).toFixed(0)}%
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* PM Strategy Goals Grid */}
      <div className="glass-card p-5">
        <p className="text-xs text-[#8b949e] tracking-widest mb-4">PM STRATEGY GOALS</p>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {overview?.pms?.map((pm) => (
            <div key={pm.id} className="flex items-start gap-3 p-3 bg-[#1c2128] rounded-lg">
              <span className="text-2xl flex-shrink-0">{pm.emoji}</span>
              <div className="min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-sm font-medium text-white">{pm.name}</p>
                  <span className={`text-xs font-mono ${pm.itd_return >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}>
                    {pm.itd_return >= 0 ? "+" : ""}{pm.itd_return.toFixed(1)}%
                  </span>
                </div>
                <p className="text-xs text-[#8b949e] leading-relaxed">{pm.goal}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
