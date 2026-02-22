"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface ServiceInfo {
  status: string;
  uptime?: string;
}

interface SystemData {
  services: Record<string, ServiceInfo>;
  signal_freshness: Record<string, string | null>;
}

interface SocialFreshnessItem {
  status: string;
  last_fetch: string | null;
}

interface SOQStatus {
  queue_depth: number;
  avg_latency_ms: number;
  orders_today: number;
}

interface BrokerInfo {
  pm_id: string;
  name: string;
  emoji: string;
  broker_type: string;
  broker_class: string;
  is_live: boolean;
  is_active: boolean;
}

interface SignalRecord {
  id: number;
  pm_id: string;
  symbol: string;
  signal_type: string;
  value: number;
  metadata: {
    rsi?: number;
    momentum?: number;
    volatility?: number;
    rsi_signal?: string;
    momentum_signal?: string;
  };
  created_at: string;
}

interface ReconcileItem {
  pm_id: string;
  pm_name: string;
  emoji: string;
  symbol: string;
  db_qty: number | null;
  broker_qty: number | null;
  diff: number | null;
  status: string;
  error?: string;
}

interface PipelineStats {
  pending: number;
  executing: number;
  completed_24h: number;
  rejected_24h: number;
}

const SERVICE_ICONS: Record<string, string> = {
  backend: "🟢",
  database: "🗄️",
  market_data: "📈",
  llm_providers: "🤖",
};

function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    healthy: "bg-green-900/30 text-green-400 border border-green-500/30",
    not_configured:
      "bg-yellow-900/30 text-yellow-400 border border-yellow-500/30",
    error: "bg-red-900/30 text-red-400 border border-red-500/30",
    degraded: "bg-orange-900/30 text-orange-400 border border-orange-500/30",
  };
  const style =
    styles[status] ?? "bg-gray-800 text-[#8b949e] border border-[#30363d]";
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${style}`}>
      {status.replace(/_/g, " ")}
    </span>
  );
}

function UpDot({ status }: { status: string }) {
  const color =
    status === "healthy"
      ? "bg-green-400"
      : status === "not_configured"
        ? "bg-yellow-400"
        : "bg-red-400";
  return (
    <span
      className={`inline-block w-2 h-2 rounded-full ${color} animate-pulse`}
    />
  );
}

export function SystemTab() {
  const { t } = useI18n();
  const [system, setSystem] = useState<SystemData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStats | null>(null);
  const [socialFreshness, setSocialFreshness] = useState<Record<
    string,
    SocialFreshnessItem
  > | null>(null);
  const [soq, setSoq] = useState<SOQStatus | null>(null);
  const [brokers, setBrokers] = useState<BrokerInfo[]>([]);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleMsg, setCycleMsg] = useState<string | null>(null);
  const [killSwitchLoading, setKillSwitchLoading] = useState(false);
  const [bybitTestnet, setBybitTestnet] = useState(true);
  const [toggleLiveLoading, setToggleLiveLoading] = useState(false);
  const [signals, setSignals] = useState<SignalRecord[]>([]);
  const [reconcileData, setReconcileData] = useState<ReconcileItem[]>([]);
  const [reconciling, setReconciling] = useState(false);

  const fetchAll = useCallback(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/fund/system/overview`)
        .then((r) => r.json())
        .then(setSystem)
        .catch(() => {}),
      fetch(`${BASE_URL}/api/fund/order-pipeline/stats`)
        .then((r) => r.json())
        .then(setPipeline)
        .catch(() => {}),
      fetch(`${BASE_URL}/api/fund/social/freshness`)
        .then((r) => r.json())
        .then(setSocialFreshness)
        .catch(() => {}),
      fetch(`${BASE_URL}/api/fund/soq/status`)
        .then((r) => r.json())
        .then(setSoq)
        .catch(() => {}),
      fetch(`${BASE_URL}/api/fund/broker/status`)
        .then((r) => r.json())
        .then((d) => {
          setBrokers(d.brokers ?? []);
          if (d.bybit_testnet !== undefined) setBybitTestnet(d.bybit_testnet);
        })
        .catch(() => {}),
      fetch(`${BASE_URL}/api/trading/signals/recent?limit=20`)
        .then((r) => r.json())
        .then((d) => setSignals(d.signals ?? []))
        .catch(() => {}),
    ]);
  }, []);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 15_000);
    return () => clearInterval(interval);
  }, [fetchAll]);

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
        `✅ ${t("sys.cycle_complete")} — ${trades} ${t("sys.trades_exec")}`,
      );
      fetchAll();
    } catch {
      setCycleMsg(`❌ ${t("sys.error_cycle")}`);
    } finally {
      setRunningCycle(false);
    }
  };

  const handleKillSwitch = async () => {
    if (!confirm("Are you sure? This will stop ALL trading immediately."))
      return;
    setKillSwitchLoading(true);
    try {
      const allActive = brokers.every((b) => b.is_active);
      const endpoint = allActive ? "kill-switch" : "resume";
      await fetch(`${BASE_URL}/api/fund/broker/${endpoint}`, {
        method: "POST",
      });
      fetchAll();
    } catch {
      // ignore
    } finally {
      setKillSwitchLoading(false);
    }
  };

  const handleToggleLive = async () => {
    if (bybitTestnet) {
      // testnet → LIVE: 이중 확인 필요
      const first = confirm(
        "WARNING: This will switch Bybit to LIVE trading with REAL money.\n\nAre you sure?",
      );
      if (!first) return;
      const second = confirm(
        "FINAL CONFIRMATION: Real funds will be used for trading.\n\nClick OK to enable LIVE mode.",
      );
      if (!second) return;
    }
    setToggleLiveLoading(true);
    try {
      const res = await fetch(`${BASE_URL}/api/fund/broker/toggle-live`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.bybit_testnet !== undefined) setBybitTestnet(data.bybit_testnet);
      fetchAll();
    } catch {
      // ignore
    } finally {
      setToggleLiveLoading(false);
    }
  };

  const handleReconcile = async () => {
    setReconciling(true);
    try {
      const res = await fetch(`${BASE_URL}/api/fund/broker/reconcile`);
      const data = await res.json();
      setReconcileData(data.positions ?? []);
    } catch {
      // ignore
    } finally {
      setReconciling(false);
    }
  };

  const allActive = brokers.length > 0 && brokers.every((b) => b.is_active);

  const healthyCount = system
    ? Object.values(system.services).filter((s) => s.status === "healthy")
        .length
    : 0;
  const totalCount = system ? Object.values(system.services).length : 0;

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">{t("sys.status")}</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {healthyCount}/{totalCount} {t("sys.healthy")}
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={handleRunCycle}
            disabled={runningCycle}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition"
          >
            {runningCycle
              ? `⏳ ${t("sys.running")}`
              : `▶ ${t("sys.run_cycle")}`}
          </button>
        </div>
      </div>
      {cycleMsg && (
        <div className="bg-[#1c2128] border border-[#30363d] rounded-lg px-4 py-2 text-sm text-[#e6edf3]">
          {cycleMsg}
        </div>
      )}

      {/* Services Grid */}
      <div className="glass-card p-5">
        <p className="text-xs text-[#8b949e] tracking-widest mb-4">
          {t("sys.service")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {system &&
            Object.entries(system.services).map(([name, info]) => (
              <div key={name} className="bg-[#1c2128] p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <UpDot status={info.status} />
                  <span className="text-lg">{SERVICE_ICONS[name] ?? "⚙️"}</span>
                  <span className="text-xs text-[#8b949e] uppercase tracking-wide flex-1">
                    {name.replace(/_/g, " ")}
                  </span>
                </div>
                <StatusBadge status={info.status} />
                {info.uptime && (
                  <p className="text-xs text-[#8b949e] mt-2">{info.uptime}</p>
                )}
              </div>
            ))}
        </div>
      </div>

      {/* Order Pipeline + SOQ */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Pipeline Stats */}
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("sys.pipeline")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            {pipeline &&
              Object.entries(pipeline).map(([key, value]) => {
                const isActive = key === "pending" || key === "executing";
                return (
                  <div
                    key={key}
                    className="bg-[#1c2128] p-4 rounded-lg text-center"
                  >
                    <p
                      className={`text-2xl font-mono font-bold ${
                        isActive && value > 0 ? "text-cyan-400" : "text-white"
                      }`}
                    >
                      {value}
                    </p>
                    <p className="text-xs text-[#8b949e] mt-1 uppercase">
                      {key.replace(/_/g, " ")}
                    </p>
                  </div>
                );
              })}
          </div>

          {/* SOQ Stats */}
          {soq && (
            <div className="mt-4 pt-4 border-t border-[#30363d]">
              <p className="text-xs text-[#8b949e] tracking-widest mb-3">
                {t("sys.soq")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-white">
                    {soq.queue_depth}
                  </p>
                  <p className="text-xs text-[#8b949e]">{t("sys.queue")}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-white">
                    {soq.avg_latency_ms}
                    <span className="text-xs ml-0.5">ms</span>
                  </p>
                  <p className="text-xs text-[#8b949e]">{t("sys.latency")}</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-cyan-400">
                    {soq.orders_today}
                  </p>
                  <p className="text-xs text-[#8b949e]">{t("sys.today")}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Social Signal Freshness */}
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("sys.freshness")}
          </p>
          <div className="space-y-3">
            {/* Signal freshness from system */}
            {system?.signal_freshness &&
              Object.entries(system.signal_freshness).map(
                ([signal, timestamp]) => (
                  <div
                    key={signal}
                    className="flex items-center justify-between bg-[#1c2128] px-4 py-3 rounded-lg"
                  >
                    <div className="flex items-center gap-2">
                      <UpDot
                        status={timestamp ? "healthy" : "not_configured"}
                      />
                      <p className="text-sm font-medium capitalize">{signal}</p>
                    </div>
                    <p className="text-xs text-[#8b949e]">
                      {timestamp
                        ? new Date(timestamp).toLocaleTimeString()
                        : t("sys.no_data")}
                    </p>
                  </div>
                ),
              )}

            {/* Social freshness detail */}
            {socialFreshness && (
              <div className="pt-3 border-t border-[#30363d]">
                <p className="text-xs text-[#8b949e] tracking-widest mb-3">
                  {t("sys.social_sources")}
                </p>
                {Object.entries(socialFreshness).map(([source, info]) => (
                  <div
                    key={source}
                    className="flex items-center justify-between bg-[#1c2128] px-4 py-2.5 rounded-lg mb-2"
                  >
                    <div className="flex items-center gap-2">
                      <UpDot status={info.status} />
                      <p className="text-sm capitalize">
                        {source.replace(/_/g, " ")}
                      </p>
                    </div>
                    <StatusBadge status={info.status} />
                  </div>
                ))}
                <p className="text-xs text-[#8b949e] mt-2">
                  {t("sys.configure_api")}{" "}
                  <code className="bg-[#1c2128] px-1 rounded">.env</code>{" "}
                  {t("sys.to_enable")}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Broker Status */}
      {brokers.length > 0 && (
        <div className="glass-card p-5">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <p className="text-xs text-[#8b949e] tracking-widest">
                {t("sys.broker_status")}
              </p>
              <span
                className={`text-xs px-2 py-0.5 rounded-full font-bold ${
                  bybitTestnet
                    ? "bg-yellow-900/30 text-yellow-400 border border-yellow-500/30"
                    : "bg-red-900/40 text-red-300 border border-red-500/50 animate-pulse"
                }`}
              >
                {bybitTestnet ? "TESTNET" : "LIVE"}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={handleToggleLive}
                disabled={toggleLiveLoading}
                className={`px-3 py-1.5 font-bold rounded-lg text-xs transition ${
                  bybitTestnet
                    ? "bg-orange-600 hover:bg-orange-500 text-white"
                    : "bg-yellow-600 hover:bg-yellow-500 text-black"
                } disabled:opacity-50`}
              >
                {toggleLiveLoading
                  ? "..."
                  : bybitTestnet
                    ? t("sys.switch_live")
                    : t("sys.switch_testnet")}
              </button>
              <button
                onClick={handleKillSwitch}
                disabled={killSwitchLoading}
                className={`px-4 py-1.5 font-bold rounded-lg text-sm transition ${
                  allActive
                    ? "bg-red-600 hover:bg-red-500 text-white"
                    : "bg-green-600 hover:bg-green-500 text-white"
                } disabled:opacity-50`}
              >
                {killSwitchLoading
                  ? "..."
                  : allActive
                    ? t("sys.kill_switch")
                    : t("sys.resume_all")}
              </button>
            </div>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {brokers.map((b) => (
              <div key={b.pm_id} className="bg-[#1c2128] p-3 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-lg">{b.emoji}</span>
                  <span className="text-sm font-medium text-white truncate">
                    {b.name}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      b.is_live
                        ? "bg-red-900/30 text-red-400 border border-red-500/30"
                        : b.broker_class === "PaperAdapter"
                          ? "bg-gray-800 text-[#8b949e] border border-[#30363d]"
                          : "bg-yellow-900/30 text-yellow-400 border border-yellow-500/30"
                    }`}
                  >
                    {b.is_live
                      ? "LIVE"
                      : b.broker_class === "PaperAdapter"
                        ? "paper"
                        : "testnet"}
                  </span>
                  <span className="text-xs text-[#8b949e]">
                    {b.broker_type}
                  </span>
                  {!b.is_active && (
                    <span className="text-xs px-2 py-0.5 rounded-full bg-red-900/30 text-red-400 border border-red-500/30">
                      {t("sys.stopped")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Signal Feed */}
      {signals.length > 0 && (
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">
            {t("sys.signal_feed")}
          </p>
          <div className="space-y-2 max-h-80 overflow-y-auto">
            {signals.map((s) => {
              const score = s.value;
              const scoreColor =
                score > 0.25
                  ? "text-green-400"
                  : score < -0.25
                    ? "text-red-400"
                    : "text-[#8b949e]";
              const scoreBg =
                score > 0.25
                  ? "bg-green-900/30 border-green-500/30"
                  : score < -0.25
                    ? "bg-red-900/30 border-red-500/30"
                    : "bg-gray-800 border-[#30363d]";
              return (
                <div
                  key={s.id}
                  className="flex items-center justify-between bg-[#1c2128] px-4 py-3 rounded-lg"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`text-xs font-mono font-bold px-2 py-0.5 rounded border ${scoreBg} ${scoreColor}`}
                    >
                      {score > 0 ? "+" : ""}
                      {score.toFixed(3)}
                    </span>
                    <span className="text-sm font-medium text-white">
                      {s.symbol}
                    </span>
                    <span className="text-xs text-[#8b949e]">{s.pm_id}</span>
                  </div>
                  <div className="flex items-center gap-3">
                    {s.metadata?.rsi !== undefined && (
                      <span className="text-xs text-[#8b949e]">
                        RSI{" "}
                        <span
                          className={
                            s.metadata.rsi < 35
                              ? "text-green-400"
                              : s.metadata.rsi > 65
                                ? "text-red-400"
                                : "text-white"
                          }
                        >
                          {s.metadata.rsi.toFixed(1)}
                        </span>
                      </span>
                    )}
                    {s.metadata?.momentum !== undefined && (
                      <span className="text-xs text-[#8b949e]">
                        MOM{" "}
                        <span className="text-white">
                          {s.metadata.momentum.toFixed(3)}
                        </span>
                      </span>
                    )}
                    {s.metadata?.volatility !== undefined && (
                      <span className="text-xs text-[#8b949e]">
                        VOL{" "}
                        <span className="text-white">
                          {s.metadata.volatility.toFixed(3)}
                        </span>
                      </span>
                    )}
                    {s.metadata?.rsi_signal && (
                      <span
                        className={`text-xs px-1.5 py-0.5 rounded ${
                          s.metadata.rsi_signal === "BUY"
                            ? "bg-green-900/30 text-green-400"
                            : s.metadata.rsi_signal === "SELL"
                              ? "bg-red-900/30 text-red-400"
                              : "bg-gray-800 text-[#8b949e]"
                        }`}
                      >
                        {s.metadata.rsi_signal}
                      </span>
                    )}
                    <span className="text-xs text-[#8b949e]">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleTimeString()
                        : ""}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Balance Reconciliation */}
      <div className="glass-card p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs text-[#8b949e] tracking-widest">
            {t("sys.reconciliation")}
          </p>
          <button
            onClick={handleReconcile}
            disabled={reconciling}
            className="px-3 py-1.5 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-bold rounded-lg text-xs transition"
          >
            {reconciling ? t("sys.reconciling") : t("sys.reconcile")}
          </button>
        </div>
        {reconcileData.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-xs text-[#8b949e] uppercase border-b border-[#30363d]">
                  <th className="text-left py-2 px-3">PM</th>
                  <th className="text-left py-2 px-3">{t("pm.th_symbol")}</th>
                  <th className="text-right py-2 px-3">{t("sys.db_qty")}</th>
                  <th className="text-right py-2 px-3">
                    {t("sys.broker_qty")}
                  </th>
                  <th className="text-right py-2 px-3">{t("sys.diff")}</th>
                  <th className="text-center py-2 px-3">Status</th>
                </tr>
              </thead>
              <tbody>
                {reconcileData.map((item, idx) => (
                  <tr
                    key={`${item.pm_id}-${item.symbol}-${idx}`}
                    className="border-b border-[#30363d]/50 hover:bg-[#1c2128]"
                  >
                    <td className="py-2 px-3">
                      <span className="mr-1">{item.emoji}</span>
                      <span className="text-white">{item.pm_name}</span>
                    </td>
                    <td className="py-2 px-3 font-mono text-white">
                      {item.symbol}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-white">
                      {item.db_qty !== null ? item.db_qty.toFixed(4) : "—"}
                    </td>
                    <td className="py-2 px-3 text-right font-mono text-white">
                      {item.broker_qty !== null
                        ? item.broker_qty.toFixed(4)
                        : "—"}
                    </td>
                    <td
                      className={`py-2 px-3 text-right font-mono ${
                        item.diff !== null && Math.abs(item.diff) > 0.0001
                          ? "text-red-400"
                          : "text-green-400"
                      }`}
                    >
                      {item.diff !== null
                        ? (item.diff > 0 ? "+" : "") + item.diff.toFixed(4)
                        : "—"}
                    </td>
                    <td className="py-2 px-3 text-center">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                          item.status === "match"
                            ? "bg-green-900/30 text-green-400 border border-green-500/30"
                            : item.status === "mismatch"
                              ? "bg-red-900/30 text-red-400 border border-red-500/30"
                              : item.status === "paper"
                                ? "bg-gray-800 text-[#8b949e] border border-[#30363d]"
                                : "bg-yellow-900/30 text-yellow-400 border border-yellow-500/30"
                        }`}
                      >
                        {item.status === "match"
                          ? t("sys.match")
                          : item.status === "mismatch"
                            ? t("sys.mismatch")
                            : item.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-[#8b949e] text-center py-6">
            {t("sys.no_positions")}
          </p>
        )}
      </div>

      {/* Environment Info */}
      <div className="glass-card p-5">
        <p className="text-xs text-[#8b949e] tracking-widest mb-4">
          {t("sys.env")}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          {[
            { label: "BACKEND", value: "FastAPI v0.2.0" },
            { label: "DATABASE", value: "SQLite (Paper Trading)" },
            { label: "MODE", value: "Paper Trading" },
            { label: "API URL", value: BASE_URL.replace("http://", "") },
          ].map(({ label, value }) => (
            <div key={label} className="bg-[#1c2128] p-4 rounded-lg">
              <p className="text-xs text-[#8b949e] mb-1">{label}</p>
              <p className="font-mono text-sm text-white truncate">{value}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
