"use client";

import { useEffect, useRef, useState } from "react";
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
  pm_id: string;
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

interface CryptoAgent {
  id: string;
  name: string;
  emoji: string;
  strategy: string;
  capital: number;
  itd_return: number;
  is_active: boolean;
}

export default function CryptoTrade() {
  const { t } = useI18n();
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [trades, setTrades] = useState<TradeResult[]>([]);
  const [signals, setSignals] = useState<Signal[]>([]);
  const [agents, setAgents] = useState<CryptoAgent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");
  const [running, setRunning] = useState(false);
  const [lastResult, setLastResult] = useState<string | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveEvents, setLiveEvents] = useState<
    Array<{ type: string; pm_id: string; result: any; timestamp: string }>
  >([]);
  const wsRef = useRef<WebSocket | null>(null);

  const fetchData = async () => {
    try {
      const [priceRes, portRes, sigRes, agentRes] = await Promise.all([
        fetch(`${BASE_URL}/api/crypto/prices`),
        fetch(`${BASE_URL}/api/crypto/portfolio`),
        fetch(`${BASE_URL}/api/trading/signals/recent?limit=20`),
        fetch(`${BASE_URL}/api/crypto/agents`),
      ]);
      const priceData = await priceRes.json();
      const portData = await portRes.json();
      const sigData = await sigRes.json();
      const agentData = await agentRes.json();

      setPrices(priceData.prices || []);
      setTrades(portData.trades?.slice(0, 10) || []);
      setSignals((sigData.signals || []).slice(0, 10));
      setAgents(agentData.agents || []);
    } catch {
      // silent
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    const protocol = BASE_URL.startsWith("https://") ? "wss://" : "ws://";
    const host = BASE_URL.replace("http://", "").replace("https://", "");
    const wsUrl = `${protocol}${host}/api/crypto/ws`;

    const connect = () => {
      const ws = new WebSocket(wsUrl);
      wsRef.current = ws;

      ws.onopen = () => {
        setWsConnected(true);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "pong") return;
          const enriched = {
            type: data.type ?? "unknown",
            pm_id: data.pm_id ?? "",
            result: data.result ?? data,
            timestamp: new Date().toISOString(),
          };
          setLiveEvents((prev) => [enriched, ...prev].slice(0, 20));
        } catch {
          // ignore non-JSON messages
        }
      };

      ws.onclose = () => {
        setWsConnected(false);
        wsRef.current = null;
      };

      ws.onerror = () => {
        ws.close();
      };
    };

    connect();

    const pingInterval = setInterval(() => {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send("ping");
      }
    }, 30_000);

    return () => {
      clearInterval(pingInterval);
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  const getAgentEmoji = (pmId: string): string => {
    const agent = agents.find((a) => a.id === pmId);
    return agent?.emoji ?? "";
  };

  const selectedAgentObj = agents.find((a) => a.id === selectedAgent);

  const runCycle = async () => {
    setRunning(true);
    setLastResult(null);
    try {
      const url =
        selectedAgent === "all"
          ? `${BASE_URL}/api/crypto/trade-all`
          : `${BASE_URL}/api/crypto/agents/${selectedAgent}/trade`;
      const res = await fetch(url, { method: "POST" });
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
              : `Cycle complete: ${r?.status || "done"}`,
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
                $
                {p.price.toLocaleString(undefined, {
                  minimumFractionDigits: p.price < 10 ? 4 : 2,
                  maximumFractionDigits: p.price < 10 ? 4 : 2,
                })}
              </span>
              <span
                className={`text-[10px] font-mono ${p.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}
              >
                {p.change_24h >= 0 ? "+" : ""}
                {p.change_24h.toFixed(1)}%
              </span>
            </div>
          ))}
        </div>

        <div className="flex items-center gap-3 mb-4">
          <label className="text-xs text-gray-500">
            {t("crypto.select_agent")}
          </label>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="bg-gray-800 text-white border border-[#30363d] rounded-lg px-3 py-2 text-sm focus:outline-none"
          >
            <option value="all">{t("crypto.all_agents")}</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.emoji} {a.name}
              </option>
            ))}
          </select>
        </div>

        <button
          onClick={runCycle}
          disabled={running}
          className="px-6 py-3 bg-[#f7931a] hover:bg-[#e8860f] disabled:opacity-50
                     text-black font-bold rounded-lg transition text-sm"
        >
          {running
            ? selectedAgent === "all"
              ? t("crypto.running_all")
              : t("crypto.running")
            : selectedAgent === "all"
              ? t("crypto.run_all_agents")
              : `${selectedAgentObj?.emoji ?? ""} Run ${selectedAgentObj?.name ?? selectedAgent}`}
        </button>

        {lastResult && (
          <div className="mt-3 text-sm text-gray-400 bg-gray-800 rounded-lg px-4 py-2 font-mono">
            {lastResult}
          </div>
        )}
      </div>

      {/* Live Feed */}
      <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
        <div className="flex items-center gap-2 mb-3">
          <h2 className="text-sm tracking-widest text-gray-500">
            {t("crypto.live_feed")}
          </h2>
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold ${
              wsConnected
                ? "bg-green-500/20 text-green-400"
                : "bg-gray-700 text-gray-500"
            }`}
          >
            {wsConnected
              ? t("crypto.live_connected")
              : t("crypto.live_disconnected")}
          </span>
        </div>
        {liveEvents.length === 0 ? (
          <p className="text-gray-600 text-sm">Waiting for live trades...</p>
        ) : (
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {liveEvents.slice(0, 10).map((ev, idx) => {
              const ts = new Date(ev.timestamp);
              const timeStr = ts.toLocaleTimeString("en-US", {
                hour12: false,
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              });
              const result = ev.result;
              const summary =
                result?.action && result?.symbol
                  ? `${result.action} ${result.symbol}${result.price ? ` @ $${Number(result.price).toLocaleString()}` : ""}`
                  : (result?.status ?? "");
              return (
                <div
                  key={`${ev.timestamp}-${idx}`}
                  className="flex items-center gap-3 bg-gray-800 rounded-lg px-3 py-2"
                >
                  <span className="text-[11px] font-mono text-gray-500 shrink-0">
                    {timeStr}
                  </span>
                  <span className="text-xs" title={ev.pm_id}>
                    {getAgentEmoji(ev.pm_id) || ev.pm_id.slice(0, 8)}
                  </span>
                  <span
                    className={`text-[10px] px-1.5 py-0.5 rounded font-bold shrink-0 ${
                      ev.type === "trade" || ev.type === "auto_trade"
                        ? "bg-[#f7931a]/20 text-[#f7931a]"
                        : "bg-gray-700 text-gray-400"
                    }`}
                  >
                    {ev.type}
                  </span>
                  {summary && (
                    <span className="text-xs text-gray-400 truncate">
                      {summary}
                    </span>
                  )}
                </div>
              );
            })}
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
                    <span className="text-xs" title={s.pm_id}>
                      {getAgentEmoji(s.pm_id)}
                    </span>
                    <span className="text-xs font-bold text-white">
                      {s.symbol}
                    </span>
                    <span
                      className={`text-xs px-1.5 py-0.5 rounded ${s.signal_type === "BUY" ? "bg-green-500/20 text-green-400" : s.signal_type === "SELL" ? "bg-red-500/20 text-red-400" : "bg-gray-700 text-gray-400"}`}
                    >
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
                    <span className="text-xs" title={trade.pm_id}>
                      {getAgentEmoji(trade.pm_id)}
                    </span>
                    <span
                      className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.action === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}
                    >
                      {trade.action}
                    </span>
                    <span className="text-xs text-white">{trade.symbol}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-xs font-mono text-gray-400">
                      {trade.quantity.toFixed(4)} @ $
                      {trade.price.toLocaleString()}
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
