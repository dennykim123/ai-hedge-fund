"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CryptoPrice {
  symbol: string;
  coin: string;
  price: number;
  change_24h: number;
}

interface TradeResult {
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

interface Signal {
  id: number;
  pm_id: string;
  symbol: string;
  signal_type: string;
  value: number;
  created_at: string | null;
}

export default function CryptoTrade() {
  const { t } = useI18n();
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [trades, setTrades] = useState<TradeResult[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      const [priceRes, portRes, sigRes] = await Promise.all([
        fetch(`${BASE_URL}/api/crypto/prices`),
        fetch(`${BASE_URL}/api/crypto/portfolio`),
        fetch(`${BASE_URL}/api/trading/signals/recent?limit=20`),
      ]);
      const priceData = await priceRes.json();
      const portData = await portRes.json();
      const sigData = await sigRes.json();

      setPrices(priceData.prices || []);
      setTrades(portData.trades?.slice(0, 10) || []);
      setSignals(
        (sigData.signals || []).filter((s: Signal) => s.pm_id === "satoshi").slice(0, 10)
      );
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const runCycle = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const res = await fetch(`${BASE_URL}/api/crypto/trade`, { method: "POST" });
      const data = await res.json();
      if (data.error) {
        setLastResult(`Error: ${data.message || data.error}`);
      } else {
        const r = data.result;
        setLastResult(
          r?.status === "executed"
            ? `${r.action} ${r.quantity} ${r.symbol} @ $${r.price}`
            : r?.status === "hold"
              ? `HOLD — ${r.symbol} (conviction too low)`
              : `Cycle complete: ${r?.status || "done"}`
        );
        await fetchData();
      }
    } catch {
      setLastResult("Network error");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f7931a]">
          {t("crypto.trade_title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("crypto.trade_subtitle")}
        </p>
      </div>

      {/* Quick Trade Panel */}
      <div className="bg-gray-900 border border-[#30363d] rounded-xl p-6">
        <h2 className="text-sm tracking-widest text-gray-500 mb-4">
          {t("crypto.run_cycle")}
        </h2>

        {/* Price Ticker */}
        <div className="flex gap-3 flex-wrap mb-4">
          {prices.map((p) => (
            <div
              key={p.symbol}
              className="flex items-center gap-2 bg-gray-800 rounded-lg px-3 py-1.5"
            >
              <span className="text-xs font-bold text-white">{p.coin}</span>
              <span className="text-xs font-mono text-gray-400">
                ${p.price.toLocaleString(undefined, { minimumFractionDigits: p.price < 10 ? 4 : 2, maximumFractionDigits: p.price < 10 ? 4 : 2 })}
              </span>
              <span className={`text-[10px] font-mono ${p.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                {p.change_24h >= 0 ? "+" : ""}{p.change_24h.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        <button
          onClick={runCycle}
          disabled={running}
          className="px-6 py-3 bg-[#f7931a] hover:bg-[#e8860f] disabled:opacity-50
                     text-black font-bold rounded-lg transition text-sm"
        >
          {running ? t("crypto.running") : t("crypto.run_satoshi")}
        </button>

        {lastResult && (
          <div className="mt-3 text-sm text-gray-400 bg-gray-800 rounded-lg px-4 py-2 font-mono">
            {lastResult}
          </div>
        )}
      </div>

      {/* Signals + Recent Trades */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Signals */}
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <h2 className="text-sm tracking-widest text-gray-500 mb-3">
            {t("crypto.signal_feed")}
          </h2>
          {signals.length === 0 ? (
            <p className="text-gray-600 text-sm">{t("crypto.no_signals")}</p>
          ) : (
            <div className="space-y-2">
              {signals.map((s) => (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">{s.symbol}</span>
                    <span className={`text-xs px-1.5 py-0.5 rounded ${s.signal_type === "BUY" ? "bg-green-500/20 text-green-400" : s.signal_type === "SELL" ? "bg-red-500/20 text-red-400" : "bg-gray-700 text-gray-400"}`}>
                      {s.signal_type}
                    </span>
                  </div>
                  <span className="text-xs font-mono text-gray-500">
                    {s.value.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Trades */}
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <h2 className="text-sm tracking-widest text-gray-500 mb-3">
            {t("crypto.recent_trades")}
          </h2>
          {trades.length === 0 ? (
            <p className="text-gray-600 text-sm">{t("crypto.no_trades")}</p>
          ) : (
            <div className="space-y-2">
              {trades.map((trade) => (
                <div
                  key={trade.id}
                  className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2"
                >
                  <div className="flex items-center gap-2">
                    <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.action === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                      {trade.action}
                    </span>
                    <span className="text-xs text-white">{trade.symbol}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-gray-400">
                      {trade.quantity.toFixed(4)} @ ${trade.price.toLocaleString()}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
