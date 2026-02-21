"use client";

import { useEffect, useState } from "react";
import { SkeletonCard, SkeletonTable } from "@/components/ui/SkeletonCard";
import { useI18n } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Trade {
  id: number;
  pm_id: string;
  pm_name: string;
  pm_emoji: string;
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  value: number;
  conviction: number;
  reasoning: string;
  sector: string;
  executed_at: string | null;
}

interface Position {
  symbol: string;
  sector: string;
  total_quantity: number;
  total_value: number;
  pms: string[];
  pm_names: string[];
  pct_of_nav: number;
}

interface ExposureData {
  net_exposure: {
    long: number;
    short: number;
    net: number;
    gross: number;
    net_pct: number;
    gross_pct: number;
  };
  pm_exposure: Array<{
    pm_id: string;
    pm_name: string;
    pm_emoji: string;
    value: number;
    pct: number;
  }>;
}

const SECTOR_COLORS: Record<string, string> = {
  Technology: "bg-blue-500/20 text-blue-300 border-blue-500/30",
  Consumer: "bg-green-500/20 text-green-300 border-green-500/30",
  Crypto: "bg-orange-500/20 text-orange-300 border-orange-500/30",
  "Index ETF": "bg-cyan-500/20 text-cyan-300 border-cyan-500/30",
  Bonds: "bg-purple-500/20 text-purple-300 border-purple-500/30",
  Commodities: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
  Volatility: "bg-red-500/20 text-red-300 border-red-500/30",
  "Asia ETF": "bg-pink-500/20 text-pink-300 border-pink-500/30",
  Meme: "bg-fuchsia-500/20 text-fuchsia-300 border-fuchsia-500/30",
};

export function PortfolioTab() {
  const { t } = useI18n();
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Position[]>([]);
  const [exposure, setExposure] = useState<ExposureData | null>(null);
  const [loading, setLoading] = useState(true);
  const [hoveredPos, setHoveredPos] = useState<string | null>(null);
  const [view, setView] = useState<"positions" | "trades" | "exposure">(
    "positions",
  );

  const fetchData = () => {
    Promise.all([
      fetch(`${BASE_URL}/api/fund/trades`)
        .then((r) => r.json())
        .then((d) => setTrades(d.trades || [])),
      fetch(`${BASE_URL}/api/fund/positions/breakdown`)
        .then((r) => r.json())
        .then((d) => setPositions(d.positions || [])),
      fetch(`${BASE_URL}/api/fund/exposure`)
        .then((r) => r.json())
        .then(setExposure),
    ])
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchData();
  }, []);

  const totalPositionValue = positions.reduce((s, p) => s + p.total_value, 0);
  const totalTradeValue = trades.reduce((s, t) => s + t.value, 0);

  if (loading) {
    return (
      <div className="space-y-6">
        <SkeletonCard rows={2} />
        <SkeletonTable rows={6} cols={6} />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-[#8b949e] tracking-widest">
            {t("port.positions")}
          </p>
          <p className="text-2xl font-mono font-bold text-cyan-400">
            {positions.length}
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-[#8b949e] tracking-widest">
            {t("port.total_exposure")}
          </p>
          <p className="text-2xl font-mono font-bold text-white">
            $
            {totalPositionValue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-[#8b949e] tracking-widest">
            {t("port.net_exposure_pct")}
          </p>
          <p
            className={`text-2xl font-mono font-bold ${(exposure?.net_exposure.net_pct ?? 0) >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
          >
            {(exposure?.net_exposure.net_pct ?? 0).toFixed(1)}%
          </p>
        </div>
        <div className="glass-card p-4 text-center">
          <p className="text-xs text-[#8b949e] tracking-widest">
            {t("port.trades_value")}
          </p>
          <p className="text-2xl font-mono font-bold text-yellow-400">
            $
            {totalTradeValue.toLocaleString(undefined, {
              maximumFractionDigits: 0,
            })}
          </p>
        </div>
      </div>

      {/* View Toggle */}
      <div className="flex gap-2">
        {(["positions", "trades", "exposure"] as const).map((v) => (
          <button
            key={v}
            onClick={() => setView(v)}
            className={`px-4 py-1.5 text-xs rounded-lg border transition ${view === v ? "bg-cyan-500/20 border-cyan-500/50 text-cyan-400" : "border-[#30363d] text-[#8b949e] hover:border-gray-500"}`}
          >
            {v === "positions"
              ? t("port.positions_tab")
              : v === "trades"
                ? t("port.trades_tab")
                : t("port.exposure_tab")}
          </button>
        ))}
        <button
          onClick={fetchData}
          className="ml-auto px-3 py-1.5 text-xs rounded-lg border border-[#30363d] text-[#8b949e] hover:border-gray-500 transition"
        >
          ↻ {t("port.refresh")}
        </button>
      </div>

      {/* Positions View */}
      {view === "positions" && (
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("port.active_positions")}
          </p>
          {positions.length === 0 ? (
            <div className="text-center py-8 text-[#8b949e] text-sm">
              {t("port.no_positions")}
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
              {positions.map((p) => {
                const sectorStyle =
                  SECTOR_COLORS[p.sector] ??
                  "bg-gray-500/20 text-gray-300 border-gray-500/30";
                return (
                  <div
                    key={p.symbol}
                    className="relative bg-[#1c2128] p-4 rounded-lg cursor-pointer border border-[#30363d] hover:border-cyan-500/40 transition-all"
                    onMouseEnter={() => setHoveredPos(p.symbol)}
                    onMouseLeave={() => setHoveredPos(null)}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <p className="font-mono font-bold text-white">
                        {p.symbol}
                      </p>
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded border ${sectorStyle}`}
                      >
                        {p.sector.split(" ")[0]}
                      </span>
                    </div>
                    <p className="text-sm font-mono text-cyan-400">
                      $
                      {p.total_value.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </p>
                    <p className="text-xs text-[#8b949e]">
                      {p.pct_of_nav.toFixed(1)}% {t("port.of_nav")}
                    </p>

                    {/* Tooltip */}
                    {hoveredPos === p.symbol && (
                      <div className="absolute bottom-full left-0 mb-2 z-20 min-w-40">
                        <div className="bg-[#0d1117] border border-[#30363d] rounded-lg px-3 py-2 shadow-xl text-xs">
                          <p className="text-[#8b949e]">
                            Qty:{" "}
                            <span className="text-white font-mono">
                              {p.total_quantity.toFixed(2)}
                            </span>
                          </p>
                          <p className="text-[#8b949e]">
                            PMs:{" "}
                            <span className="text-white">
                              {p.pm_names.join(", ")}
                            </span>
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Trades View */}
      {view === "trades" && (
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("port.trade_history")}
          </p>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-[#8b949e] text-xs border-b border-[#30363d]">
                  <th className="text-left py-2">{t("port.time")}</th>
                  <th className="text-left py-2">{t("port.pm")}</th>
                  <th className="text-left py-2">{t("port.action")}</th>
                  <th className="text-left py-2">{t("port.symbol")}</th>
                  <th className="text-right py-2">{t("port.qty")}</th>
                  <th className="text-right py-2">{t("port.price")}</th>
                  <th className="text-right py-2">{t("port.value")}</th>
                  <th className="text-right py-2">{t("port.conviction")}</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => (
                  <tr
                    key={t.id}
                    className="border-b border-[#21262d] hover:bg-[#161b22] group"
                  >
                    <td className="py-2 text-[#8b949e] text-xs">
                      {t.executed_at
                        ? new Date(t.executed_at).toLocaleString()
                        : "—"}
                    </td>
                    <td className="py-2">
                      <span className="font-medium">
                        {t.pm_emoji} {t.pm_name ?? t.pm_id}
                      </span>
                    </td>
                    <td className="py-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded font-bold ${t.action === "BUY" ? "bg-[#00d4aa]/20 text-[#00d4aa]" : "bg-[#ff6b6b]/20 text-[#ff6b6b]"}`}
                      >
                        {t.action}
                      </span>
                    </td>
                    <td className="py-2 font-mono font-bold text-white">
                      {t.symbol}
                    </td>
                    <td className="py-2 text-right font-mono text-[#8b949e]">
                      {t.quantity.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono text-[#8b949e]">
                      ${t.price.toFixed(2)}
                    </td>
                    <td className="py-2 text-right font-mono text-white">
                      $
                      {t.value.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </td>
                    <td className="py-2 text-right">
                      <span
                        className={`font-mono text-xs ${t.conviction > 0.7 ? "text-[#00d4aa]" : t.conviction > 0.5 ? "text-yellow-400" : "text-[#8b949e]"}`}
                      >
                        {(t.conviction * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
                {trades.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-[#8b949e]">
                      {t("port.no_trades")}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Exposure View */}
      {view === "exposure" && exposure && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="glass-card p-5">
            <p className="text-xs text-[#8b949e] tracking-widest mb-4">
              {t("port.net_exposure")}
            </p>
            <div className="space-y-3">
              {[
                {
                  label: t("port.long_exposure"),
                  value: exposure.net_exposure.long,
                  color: "bg-[#00d4aa]",
                },
                {
                  label: t("port.short_exposure"),
                  value: exposure.net_exposure.short,
                  color: "bg-[#ff6b6b]",
                },
                {
                  label: t("port.net_exposure"),
                  value: exposure.net_exposure.net,
                  color: "bg-cyan-400",
                },
                {
                  label: t("port.gross_exposure"),
                  value: exposure.net_exposure.gross,
                  color: "bg-yellow-400",
                },
              ].map(({ label, value, color }) => (
                <div key={label}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-[#8b949e]">{label}</span>
                    <span className="font-mono text-white">
                      $
                      {value.toLocaleString(undefined, {
                        maximumFractionDigits: 0,
                      })}
                    </span>
                  </div>
                  <div className="w-full bg-[#21262d] rounded-full h-2">
                    <div
                      className={`${color} h-2 rounded-full`}
                      style={{
                        width: `${Math.min((value / 1100000) * 100, 100)}%`,
                      }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="glass-card p-5">
            <p className="text-xs text-[#8b949e] tracking-widest mb-4">
              {t("port.pm_exposure")}
            </p>
            {exposure.pm_exposure.length === 0 ? (
              <p className="text-[#8b949e] text-sm text-center py-4">
                {t("port.no_pm_exposure")}
              </p>
            ) : (
              <div className="space-y-2">
                {exposure.pm_exposure.map((pm) => (
                  <div key={pm.pm_id} className="flex items-center gap-3">
                    <span className="w-5 flex-shrink-0">{pm.pm_emoji}</span>
                    <span className="text-sm text-white flex-1 truncate">
                      {pm.pm_name}
                    </span>
                    <div className="w-24 bg-[#21262d] rounded-full h-1.5">
                      <div
                        className="bg-cyan-400 h-1.5 rounded-full"
                        style={{ width: `${pm.pct}%` }}
                      />
                    </div>
                    <span className="font-mono text-xs text-[#8b949e] w-10 text-right">
                      {pm.pct.toFixed(1)}%
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
