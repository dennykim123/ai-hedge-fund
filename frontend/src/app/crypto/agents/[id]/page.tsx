"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

/* ── Interfaces ─────────────────────────────────────── */

interface PMInfo {
  id: string;
  name: string;
  emoji: string;
  strategy: string;
  llm_provider: string;
  capital: number;
  initial_capital: number;
  itd_return: number;
  is_active: boolean;
}

interface Position {
  symbol: string;
  quantity: number;
  avg_cost: number;
  market_value: number;
}

interface Trade {
  id: number;
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  value: number;
  conviction_score: number;
  reasoning: string;
  executed_at: string | null;
}

interface RiskMetrics {
  pm_id: string;
  total_trades: number;
  buy_count: number;
  sell_count: number;
  win_rate: number;
  avg_conviction: number;
  sharpe_ratio: number;
  max_drawdown: number;
  profit_factor: number;
  avg_trade_value: number;
}

interface DetailResponse {
  pm: PMInfo;
  positions: Position[];
  trades: Trade[];
}

/* ── Component ──────────────────────────────────────── */

export default function CryptoAgentDetail() {
  const { t } = useI18n();
  const params = useParams();
  const id = params.id as string;

  const [pm, setPm] = useState<PMInfo | null>(null);
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [risk, setRisk] = useState<RiskMetrics | null>(null);
  const [loading, setLoading] = useState(true);
  const [toggling, setToggling] = useState(false);
  const [runningCycle, setRunningCycle] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  /* ── Data fetching ────────────────────────────────── */

  const fetchDetail = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/crypto/agents/${id}/detail`);
      const data: DetailResponse = await res.json();
      setPm(data.pm);
      setPositions(data.positions ?? []);
      setTrades(data.trades ?? []);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, [id]);

  const fetchRisk = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/crypto/agents/${id}/risk`);
      const data: RiskMetrics = await res.json();
      setRisk(data);
    } catch {
      // silent
    }
  }, [id]);

  useEffect(() => {
    fetchDetail();
    fetchRisk();
    const interval = setInterval(() => {
      fetchDetail();
      fetchRisk();
    }, 30_000);
    return () => clearInterval(interval);
  }, [fetchDetail, fetchRisk]);

  /* ── Actions ──────────────────────────────────────── */

  const handleToggle = async () => {
    if (!pm) return;
    setToggling(true);
    try {
      await fetch(`${BASE_URL}/api/crypto/agents/${id}/toggle`, {
        method: "PATCH",
      });
      await fetchDetail();
    } catch {
      // silent
    } finally {
      setToggling(false);
    }
  };

  const handleRunCycle = async () => {
    setRunningCycle(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${BASE_URL}/api/crypto/agents/${id}/trade`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) {
        setStatusMessage(`Error: ${data.message || data.error}`);
      } else {
        setStatusMessage(`${pm?.name ?? id} cycle complete`);
        await fetchDetail();
        await fetchRisk();
      }
    } catch {
      setStatusMessage("Network error");
    } finally {
      setRunningCycle(false);
    }
  };

  /* ── Derived values ───────────────────────────────── */

  const totalPositionValue = positions.reduce(
    (sum, p) => sum + p.market_value,
    0
  );

  /* ── Helpers ──────────────────────────────────────── */

  const riskColor = (value: number, thresholdGood: number, invert = false) => {
    const isGood = invert ? value <= thresholdGood : value >= thresholdGood;
    return isGood ? "text-green-400" : "text-red-400";
  };

  /* ── Loading state ────────────────────────────────── */

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="h-10 bg-gray-800 rounded-lg animate-pulse w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div
              key={i}
              className="bg-gray-900 border border-[#30363d] rounded-xl p-4 h-20 animate-pulse"
            />
          ))}
        </div>
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4 h-48 animate-pulse" />
      </div>
    );
  }

  if (!pm) {
    return (
      <div className="space-y-4">
        <Link
          href="/crypto/agents"
          className="text-sm text-gray-500 hover:text-[#f7931a] transition"
        >
          {t("crypto.back_to_agents")}
        </Link>
        <p className="text-gray-400">Agent not found.</p>
      </div>
    );
  }

  /* ── Render ───────────────────────────────────────── */

  return (
    <div className="space-y-6">
      {/* ── Header ──────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex flex-col gap-2">
          <Link
            href="/crypto/agents"
            className="text-sm text-gray-500 hover:text-[#f7931a] transition"
          >
            {t("crypto.back_to_agents")}
          </Link>
          <div className="flex items-center gap-3">
            <span className="text-3xl">{pm.emoji}</span>
            <div>
              <h1 className="text-2xl font-bold text-white">{pm.name}</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                {t(`crypto.desc_${pm.id}` as TranslationKey)}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Toggle */}
          <button
            onClick={handleToggle}
            disabled={toggling}
            className={`px-4 py-2 rounded-full text-xs font-bold transition border disabled:opacity-50 ${
              pm.is_active
                ? "bg-green-500/20 text-green-400 border-green-500/40 hover:bg-green-500/30"
                : "bg-red-500/20 text-red-400 border-red-500/40 hover:bg-red-500/30"
            }`}
          >
            {pm.is_active
              ? t("crypto.toggle_active")
              : t("crypto.toggle_inactive")}
          </button>

          {/* Run Cycle */}
          <button
            onClick={handleRunCycle}
            disabled={runningCycle}
            className="px-5 py-2 bg-[#f7931a] hover:bg-[#e8860f] disabled:opacity-50
                       text-black font-bold rounded-lg transition text-sm whitespace-nowrap"
          >
            {runningCycle ? t("crypto.running") : t("crypto.run_agent_cycle")}
          </button>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="text-sm text-gray-400 bg-gray-800 border border-[#30363d] rounded-lg px-4 py-2 font-mono">
          {statusMessage}
        </div>
      )}

      {/* ── Stats Row (4 cards) ─────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <span className="text-xs text-gray-500">{t("crypto.capital")}</span>
          <div className="text-lg font-mono text-white mt-1">
            ${pm.capital.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <span className="text-xs text-gray-500">
            {t("crypto.itd_return")}
          </span>
          <div
            className={`text-lg font-mono mt-1 font-bold ${
              pm.itd_return >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {pm.itd_return >= 0 ? "+" : ""}
            {pm.itd_return.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <span className="text-xs text-gray-500">
            {t("crypto.total_trades_count")}
          </span>
          <div className="text-lg font-mono text-white mt-1">
            {risk?.total_trades ?? 0}
          </div>
        </div>
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <span className="text-xs text-gray-500">{t("crypto.win_rate")}</span>
          <div
            className={`text-lg font-mono mt-1 font-bold ${
              (risk?.win_rate ?? 0) >= 50 ? "text-green-400" : "text-red-400"
            }`}
          >
            {risk ? `${risk.win_rate.toFixed(1)}%` : "-"}
          </div>
        </div>
      </div>

      {/* ── Risk Metrics (2x3 grid) ─────────────────── */}
      <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
        <h2 className="text-sm tracking-widest text-gray-500 mb-3">
          {t("crypto.risk_metrics")}
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
          {/* Sharpe Ratio */}
          <div className="bg-gray-800/50 border border-[#30363d] rounded-lg p-3">
            <span className="text-[10px] text-gray-500 tracking-widest block">
              {t("crypto.sharpe_ratio")}
            </span>
            <span
              className={`text-base font-mono font-bold mt-1 block ${
                risk ? riskColor(risk.sharpe_ratio, 1.0) : "text-gray-600"
              }`}
            >
              {risk ? risk.sharpe_ratio.toFixed(2) : "-"}
            </span>
          </div>

          {/* Max Drawdown */}
          <div className="bg-gray-800/50 border border-[#30363d] rounded-lg p-3">
            <span className="text-[10px] text-gray-500 tracking-widest block">
              {t("crypto.max_drawdown")}
            </span>
            <span
              className={`text-base font-mono font-bold mt-1 block ${
                risk
                  ? riskColor(risk.max_drawdown, 10, true)
                  : "text-gray-600"
              }`}
            >
              {risk ? `${risk.max_drawdown.toFixed(2)}%` : "-"}
            </span>
          </div>

          {/* Win Rate */}
          <div className="bg-gray-800/50 border border-[#30363d] rounded-lg p-3">
            <span className="text-[10px] text-gray-500 tracking-widest block">
              {t("crypto.win_rate")}
            </span>
            <span
              className={`text-base font-mono font-bold mt-1 block ${
                risk ? riskColor(risk.win_rate, 50) : "text-gray-600"
              }`}
            >
              {risk ? `${risk.win_rate.toFixed(1)}%` : "-"}
            </span>
          </div>

          {/* Profit Factor */}
          <div className="bg-gray-800/50 border border-[#30363d] rounded-lg p-3">
            <span className="text-[10px] text-gray-500 tracking-widest block">
              {t("crypto.profit_factor")}
            </span>
            <span
              className={`text-base font-mono font-bold mt-1 block ${
                risk ? riskColor(risk.profit_factor, 1.0) : "text-gray-600"
              }`}
            >
              {risk ? risk.profit_factor.toFixed(2) : "-"}
            </span>
          </div>

          {/* Total Trades */}
          <div className="bg-gray-800/50 border border-[#30363d] rounded-lg p-3">
            <span className="text-[10px] text-gray-500 tracking-widest block">
              {t("crypto.total_trades_count")}
            </span>
            <span className="text-base font-mono font-bold mt-1 block text-white">
              {risk ? risk.total_trades : "-"}
            </span>
          </div>

          {/* Avg Conviction */}
          <div className="bg-gray-800/50 border border-[#30363d] rounded-lg p-3">
            <span className="text-[10px] text-gray-500 tracking-widest block">
              {t("crypto.avg_conviction")}
            </span>
            <span
              className={`text-base font-mono font-bold mt-1 block ${
                risk ? riskColor(risk.avg_conviction, 0.6) : "text-gray-600"
              }`}
            >
              {risk ? `${(risk.avg_conviction * 100).toFixed(0)}%` : "-"}
            </span>
          </div>
        </div>
      </div>

      {/* ── Positions Table ─────────────────────────── */}
      <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
        <h2 className="text-sm tracking-widest text-gray-500 mb-3">
          {t("crypto.open_positions")}
        </h2>
        {positions.length === 0 ? (
          <p className="text-gray-600 text-sm py-8 text-center">
            {t("crypto.no_agent_positions")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-[#30363d]">
                  <th className="text-left py-2 px-3">
                    {t("crypto.th_symbol")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_quantity")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_avg_cost")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_value")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_allocation")}
                  </th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => {
                  const allocation =
                    totalPositionValue > 0
                      ? (p.market_value / totalPositionValue) * 100
                      : 0;
                  return (
                    <tr
                      key={p.symbol}
                      className="border-b border-[#30363d]/50 hover:bg-gray-800/50"
                    >
                      <td className="py-2.5 px-3 font-bold text-white">
                        {p.symbol}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                        {p.quantity.toFixed(6)}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                        ${p.avg_cost.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-white">
                        ${p.market_value.toLocaleString()}
                      </td>
                      <td className="py-2.5 px-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-[#f7931a] rounded-full"
                              style={{ width: `${allocation}%` }}
                            />
                          </div>
                          <span className="text-xs text-gray-500 font-mono w-10 text-right">
                            {allocation.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Trade History Table ──────────────────────── */}
      <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
        <h2 className="text-sm tracking-widest text-gray-500 mb-3">
          {t("crypto.agent_trades")}
        </h2>
        {trades.length === 0 ? (
          <p className="text-gray-600 text-sm py-8 text-center">
            {t("crypto.no_agent_trades")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-[#30363d]">
                  <th className="text-left py-2 px-3">
                    {t("crypto.th_time")}
                  </th>
                  <th className="text-left py-2 px-3">
                    {t("crypto.th_action")}
                  </th>
                  <th className="text-left py-2 px-3">
                    {t("crypto.th_symbol")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_quantity")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_price")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_value")}
                  </th>
                  <th className="text-right py-2 px-3">
                    {t("crypto.th_conviction")}
                  </th>
                  <th className="text-left py-2 px-3">Reasoning</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr
                    key={trade.id}
                    className="border-b border-[#30363d]/50 hover:bg-gray-800/50"
                  >
                    <td className="py-2.5 px-3 text-gray-500 text-xs font-mono whitespace-nowrap">
                      {trade.executed_at
                        ? new Date(trade.executed_at).toLocaleString()
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span
                        className={`text-xs font-bold px-1.5 py-0.5 rounded ${
                          trade.action === "BUY"
                            ? "bg-green-500/20 text-green-400"
                            : "bg-red-500/20 text-red-400"
                        }`}
                      >
                        {trade.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">
                      {trade.symbol}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      {trade.quantity.toFixed(6)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      ${trade.price.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white">
                      ${trade.value.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span
                        className={`text-xs font-mono ${
                          trade.conviction_score >= 0.7
                            ? "text-green-400"
                            : trade.conviction_score >= 0.4
                              ? "text-yellow-400"
                              : "text-gray-500"
                        }`}
                      >
                        {(trade.conviction_score * 100).toFixed(0)}%
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-gray-500 text-xs max-w-[200px] truncate">
                      {trade.reasoning}
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
