"use client";

import { useEffect, useState, useCallback } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8001";

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
    not_configured: "bg-yellow-900/30 text-yellow-400 border border-yellow-500/30",
    error: "bg-red-900/30 text-red-400 border border-red-500/30",
    degraded: "bg-orange-900/30 text-orange-400 border border-orange-500/30",
  };
  const style = styles[status] ?? "bg-gray-800 text-[#8b949e] border border-[#30363d]";
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
    <span className={`inline-block w-2 h-2 rounded-full ${color} animate-pulse`} />
  );
}

export function SystemTab() {
  const [system, setSystem] = useState<SystemData | null>(null);
  const [pipeline, setPipeline] = useState<PipelineStats | null>(null);
  const [socialFreshness, setSocialFreshness] = useState<Record<string, SocialFreshnessItem> | null>(null);
  const [soq, setSoq] = useState<SOQStatus | null>(null);
  const [runningCycle, setRunningCycle] = useState(false);
  const [cycleMsg, setCycleMsg] = useState<string | null>(null);

  const fetchAll = useCallback(() => {
    Promise.all([
      fetch(`${BASE_URL}/api/fund/system/overview`).then((r) => r.json()).then(setSystem).catch(() => {}),
      fetch(`${BASE_URL}/api/fund/order-pipeline/stats`).then((r) => r.json()).then(setPipeline).catch(() => {}),
      fetch(`${BASE_URL}/api/fund/social/freshness`).then((r) => r.json()).then(setSocialFreshness).catch(() => {}),
      fetch(`${BASE_URL}/api/fund/soq/status`).then((r) => r.json()).then(setSoq).catch(() => {}),
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
          (r: { action?: string }) => r?.action === "BUY" || r?.action === "SELL",
        ).length ?? 0;
      setCycleMsg(`✅ Cycle complete — ${trades} trades executed`);
      fetchAll();
    } catch {
      setCycleMsg("❌ Error running trading cycle");
    } finally {
      setRunningCycle(false);
    }
  };

  const healthyCount = system
    ? Object.values(system.services).filter((s) => s.status === "healthy").length
    : 0;
  const totalCount = system ? Object.values(system.services).length : 0;

  return (
    <div className="space-y-6">
      {/* System Health Overview */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-white">System Status</h2>
          <p className="text-xs text-[#8b949e] mt-0.5">
            {healthyCount}/{totalCount} services healthy
          </p>
        </div>
        <div className="flex gap-3 items-center">
          <button
            onClick={handleRunCycle}
            disabled={runningCycle}
            className="px-4 py-2 bg-cyan-500 hover:bg-cyan-400 disabled:opacity-50 text-black font-bold rounded-lg text-sm transition"
          >
            {runningCycle ? "⏳ Running..." : "▶ Run Trading Cycle"}
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
        <p className="text-xs text-[#8b949e] tracking-widest mb-4">SERVICE STATUS</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {system &&
            Object.entries(system.services).map(([name, info]) => (
              <div key={name} className="bg-[#1c2128] p-4 rounded-lg">
                <div className="flex items-center gap-2 mb-3">
                  <UpDot status={info.status} />
                  <span className="text-lg">
                    {SERVICE_ICONS[name] ?? "⚙️"}
                  </span>
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
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">ORDER PIPELINE</p>
          <div className="grid grid-cols-2 gap-3">
            {pipeline &&
              Object.entries(pipeline).map(([key, value]) => {
                const isActive = key === "pending" || key === "executing";
                return (
                  <div key={key} className="bg-[#1c2128] p-4 rounded-lg text-center">
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
              <p className="text-xs text-[#8b949e] tracking-widest mb-3">SOQ METRICS</p>
              <div className="grid grid-cols-3 gap-2">
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-white">
                    {soq.queue_depth}
                  </p>
                  <p className="text-xs text-[#8b949e]">Queue</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-white">
                    {soq.avg_latency_ms}
                    <span className="text-xs ml-0.5">ms</span>
                  </p>
                  <p className="text-xs text-[#8b949e]">Latency</p>
                </div>
                <div className="text-center">
                  <p className="text-lg font-mono font-bold text-cyan-400">
                    {soq.orders_today}
                  </p>
                  <p className="text-xs text-[#8b949e]">Today</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Social Signal Freshness */}
        <div className="glass-card p-5">
          <p className="text-xs text-[#8b949e] tracking-widest mb-4">SIGNAL FRESHNESS</p>
          <div className="space-y-3">
            {/* Signal freshness from system */}
            {system?.signal_freshness &&
              Object.entries(system.signal_freshness).map(([signal, timestamp]) => (
                <div
                  key={signal}
                  className="flex items-center justify-between bg-[#1c2128] px-4 py-3 rounded-lg"
                >
                  <div className="flex items-center gap-2">
                    <UpDot status={timestamp ? "healthy" : "not_configured"} />
                    <p className="text-sm font-medium capitalize">{signal}</p>
                  </div>
                  <p className="text-xs text-[#8b949e]">
                    {timestamp
                      ? new Date(timestamp).toLocaleTimeString()
                      : "No data"}
                  </p>
                </div>
              ))}

            {/* Social freshness detail */}
            {socialFreshness && (
              <div className="pt-3 border-t border-[#30363d]">
                <p className="text-xs text-[#8b949e] tracking-widest mb-3">
                  SOCIAL DATA SOURCES
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
                  Configure API keys in <code className="bg-[#1c2128] px-1 rounded">.env</code> to enable real social data
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Environment Info */}
      <div className="glass-card p-5">
        <p className="text-xs text-[#8b949e] tracking-widest mb-4">ENVIRONMENT</p>
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
