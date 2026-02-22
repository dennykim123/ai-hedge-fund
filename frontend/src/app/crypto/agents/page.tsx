"use client";

import { useEffect, useState, useCallback } from "react";
import { useI18n, type TranslationKey } from "@/lib/i18n";
import Link from "next/link";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Agent {
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

interface LeaderboardResponse {
  leaderboard: Agent[];
  total_capital: number;
  avg_return: number;
}

interface SchedulerStatus {
  running: boolean;
  status: string;
  interval: number;
}

export default function CryptoAgents() {
  const { t } = useI18n();
  const [agents, setAgents] = useState<Agent[]>([]);
  const [totalCapital, setTotalCapital] = useState(0);
  const [avgReturn, setAvgReturn] = useState(0);
  const [loading, setLoading] = useState(true);
  const [runningAll, setRunningAll] = useState(false);
  const [runningAgent, setRunningAgent] = useState<string | null>(null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [togglingAgent, setTogglingAgent] = useState<string | null>(null);

  // Scheduler state
  const [scheduler, setScheduler] = useState<SchedulerStatus>({
    running: false,
    status: "stopped",
    interval: 300,
  });
  const [selectedInterval, setSelectedInterval] = useState(300);
  const [schedulerLoading, setSchedulerLoading] = useState(false);

  const fetchLeaderboard = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/crypto/leaderboard`);
      const data: LeaderboardResponse = await res.json();
      const sorted = [...(data.leaderboard || [])].sort(
        (a, b) => b.itd_return - a.itd_return
      );
      setAgents(sorted);
      setTotalCapital(data.total_capital ?? 0);
      setAvgReturn(data.avg_return ?? 0);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSchedulerStatus = useCallback(async () => {
    try {
      const res = await fetch(`${BASE_URL}/api/crypto/scheduler/status`);
      const data: SchedulerStatus = await res.json();
      setScheduler(data);
      if (data.interval) {
        setSelectedInterval(data.interval);
      }
    } catch {
      // silent
    }
  }, []);

  useEffect(() => {
    fetchLeaderboard();
    fetchSchedulerStatus();
    const interval = setInterval(fetchLeaderboard, 30_000);
    const schedulerInterval = setInterval(fetchSchedulerStatus, 15_000);
    return () => {
      clearInterval(interval);
      clearInterval(schedulerInterval);
    };
  }, [fetchLeaderboard, fetchSchedulerStatus]);

  const runAllAgents = async () => {
    setRunningAll(true);
    setStatusMessage(null);
    try {
      const res = await fetch(`${BASE_URL}/api/crypto/trade-all`, {
        method: "POST",
      });
      const data = await res.json();
      if (data.error) {
        setStatusMessage(`Error: ${data.message || data.error}`);
      } else {
        setStatusMessage("All agents cycle complete");
        await fetchLeaderboard();
      }
    } catch {
      setStatusMessage("Network error");
    } finally {
      setRunningAll(false);
    }
  };

  const runSingleAgent = async (pmId: string) => {
    setRunningAgent(pmId);
    setStatusMessage(null);
    try {
      const res = await fetch(
        `${BASE_URL}/api/crypto/agents/${pmId}/trade`,
        { method: "POST" }
      );
      const data = await res.json();
      if (data.error) {
        setStatusMessage(`Error: ${data.message || data.error}`);
      } else {
        setStatusMessage(`${pmId} cycle complete`);
        await fetchLeaderboard();
      }
    } catch {
      setStatusMessage("Network error");
    } finally {
      setRunningAgent(null);
    }
  };

  const toggleAgent = async (agentId: string) => {
    setTogglingAgent(agentId);
    try {
      await fetch(`${BASE_URL}/api/crypto/agents/${agentId}/toggle`, {
        method: "PATCH",
      });
      await fetchLeaderboard();
    } catch {
      setStatusMessage("Failed to toggle agent");
    } finally {
      setTogglingAgent(null);
    }
  };

  const startScheduler = async () => {
    setSchedulerLoading(true);
    try {
      await fetch(
        `${BASE_URL}/api/crypto/scheduler/start?interval=${selectedInterval}`,
        { method: "POST" }
      );
      await fetchSchedulerStatus();
    } catch {
      setStatusMessage("Failed to start scheduler");
    } finally {
      setSchedulerLoading(false);
    }
  };

  const stopScheduler = async () => {
    setSchedulerLoading(true);
    try {
      await fetch(`${BASE_URL}/api/crypto/scheduler/stop`, {
        method: "POST",
      });
      await fetchSchedulerStatus();
    } catch {
      setStatusMessage("Failed to stop scheduler");
    } finally {
      setSchedulerLoading(false);
    }
  };

  const bestAgent =
    agents.length > 0
      ? agents.reduce((best, a) =>
          a.itd_return > best.itd_return ? a : best
        )
      : null;

  const maxAbsReturn =
    agents.length > 0
      ? Math.max(...agents.map((a) => Math.abs(a.itd_return)), 0.01)
      : 1;

  const intervalOptions = [
    { label: "1min", value: 60 },
    { label: "5min", value: 300 },
    { label: "15min", value: 900 },
    { label: "30min", value: 1800 },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#f7931a]">
            {t("crypto.agents_title")}
          </h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("crypto.agents_subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          {/* Scheduler Controls */}
          <div className="flex items-center gap-2 bg-gray-900 border border-[#30363d] rounded-lg px-3 py-2">
            {/* Status indicator */}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  scheduler.running ? "bg-green-400 animate-pulse" : "bg-gray-600"
                }`}
              />
              <span className="text-xs font-mono text-gray-400">
                {scheduler.running
                  ? t("crypto.scheduler_active")
                  : t("crypto.scheduler_inactive")}
              </span>
            </div>

            {/* Interval selector */}
            <select
              value={selectedInterval}
              onChange={(e) => setSelectedInterval(Number(e.target.value))}
              className="bg-gray-800 border border-[#30363d] rounded text-xs text-gray-300
                         px-1.5 py-0.5 outline-none cursor-pointer"
            >
              {intervalOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>

            {/* Start / Stop buttons */}
            {scheduler.running ? (
              <button
                onClick={stopScheduler}
                disabled={schedulerLoading}
                className="px-2.5 py-1 bg-red-500/20 hover:bg-red-500/30 text-red-400
                           text-xs font-bold rounded transition disabled:opacity-50
                           border border-red-500/30"
              >
                {t("crypto.scheduler_stop")}
              </button>
            ) : (
              <button
                onClick={startScheduler}
                disabled={schedulerLoading}
                className="px-2.5 py-1 bg-green-500/20 hover:bg-green-500/30 text-green-400
                           text-xs font-bold rounded transition disabled:opacity-50
                           border border-green-500/30"
              >
                {t("crypto.scheduler_start")}
              </button>
            )}
          </div>

          <button
            onClick={runAllAgents}
            disabled={runningAll}
            className="px-6 py-3 bg-[#f7931a] hover:bg-[#e8860f] disabled:opacity-50
                       text-black font-bold rounded-lg transition text-sm whitespace-nowrap"
          >
            {runningAll
              ? t("crypto.running_all")
              : t("crypto.run_all_agents")}
          </button>
        </div>
      </div>

      {/* Status Message */}
      {statusMessage && (
        <div className="text-sm text-gray-400 bg-gray-800 border border-[#30363d] rounded-lg px-4 py-2 font-mono">
          {statusMessage}
        </div>
      )}

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <span className="text-xs text-gray-500">
            {t("crypto.total_capital")}
          </span>
          <div className="text-lg font-mono text-white mt-1">
            ${totalCapital.toLocaleString()}
          </div>
        </div>
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <span className="text-xs text-gray-500">
            {t("crypto.avg_return")}
          </span>
          <div
            className={`text-lg font-mono mt-1 ${
              avgReturn >= 0 ? "text-green-400" : "text-red-400"
            }`}
          >
            {avgReturn >= 0 ? "+" : ""}
            {avgReturn.toFixed(2)}%
          </div>
        </div>
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
          <span className="text-xs text-gray-500">
            {t("crypto.best_agent")}
          </span>
          <div className="text-lg text-white mt-1 flex items-center gap-2">
            {bestAgent ? (
              <>
                <span>{bestAgent.emoji}</span>
                <span className="font-bold">{bestAgent.name}</span>
                <span
                  className={`text-sm font-mono ${
                    bestAgent.itd_return >= 0
                      ? "text-green-400"
                      : "text-red-400"
                  }`}
                >
                  {bestAgent.itd_return >= 0 ? "+" : ""}
                  {bestAgent.itd_return.toFixed(2)}%
                </span>
              </>
            ) : (
              <span className="text-gray-600">-</span>
            )}
          </div>
        </div>
      </div>

      {/* Performance Comparison Bar Chart */}
      {agents.length > 0 && (
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-6">
          <h2 className="text-sm tracking-widest text-gray-500 mb-4">
            {t("crypto.performance_chart")}
          </h2>
          <div className="space-y-3">
            {[...agents]
              .sort((a, b) => b.itd_return - a.itd_return)
              .map((agent) => {
                const barWidth =
                  (Math.abs(agent.itd_return) / maxAbsReturn) * 100;
                const isPositive = agent.itd_return >= 0;

                return (
                  <div key={agent.id} className="flex items-center gap-3">
                    {/* Agent name */}
                    <div className="flex items-center gap-2 w-36 shrink-0">
                      <span className="text-base">{agent.emoji}</span>
                      <span className="text-xs text-gray-300 truncate">
                        {agent.name}
                      </span>
                    </div>

                    {/* Bar */}
                    <div className="flex-1 h-6 bg-gray-800 rounded-md overflow-hidden relative">
                      <div
                        className={`h-full rounded-md transition-all duration-500 ${
                          isPositive ? "bg-green-500/60" : "bg-red-500/60"
                        }`}
                        style={{ width: `${Math.max(barWidth, 1)}%` }}
                      />
                    </div>

                    {/* Return value */}
                    <span
                      className={`text-xs font-mono w-20 text-right shrink-0 ${
                        isPositive ? "text-green-400" : "text-red-400"
                      }`}
                    >
                      {isPositive ? "+" : ""}
                      {agent.itd_return.toFixed(2)}%
                    </span>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Agent Cards */}
      <div className="space-y-3">
        {loading
          ? Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="bg-gray-900 border border-[#30363d] rounded-xl p-6 animate-pulse h-28"
              />
            ))
          : agents.map((agent, index) => {
              const rank = index + 1;
              const isRunning = runningAgent === agent.id;
              const isToggling = togglingAgent === agent.id;

              return (
                <Link
                  key={agent.id}
                  href={`/crypto/agents/${agent.id}`}
                  className="block"
                >
                  <div
                    className="bg-gray-900 border border-[#30363d] rounded-xl p-5
                               hover:border-[#f7931a]/30 transition cursor-pointer"
                  >
                    <div className="flex flex-col sm:flex-row sm:items-center gap-4">
                      {/* Rank */}
                      <div className="flex items-center gap-4 flex-1 min-w-0">
                        <div
                          className={`w-10 h-10 rounded-full flex items-center justify-center font-bold text-sm shrink-0 ${
                            rank === 1
                              ? "bg-[#f7931a]/20 text-[#f7931a]"
                              : rank === 2
                                ? "bg-gray-600/20 text-gray-400"
                                : rank === 3
                                  ? "bg-amber-700/20 text-amber-600"
                                  : "bg-gray-800 text-gray-500"
                          }`}
                        >
                          #{rank}
                        </div>

                        {/* Name + Strategy */}
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="text-xl">{agent.emoji}</span>
                            <span className="font-bold text-white text-base">
                              {agent.name}
                            </span>
                            <span
                              className={`text-xs px-2 py-0.5 rounded ${
                                agent.is_active
                                  ? "bg-green-500/20 text-green-400"
                                  : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {agent.is_active ? "ACTIVE" : "INACTIVE"}
                            </span>

                            {/* Toggle Switch */}
                            <button
                              onClick={(e) => {
                                e.preventDefault();
                                e.stopPropagation();
                                if (!isToggling) {
                                  toggleAgent(agent.id);
                                }
                              }}
                              disabled={isToggling}
                              className={`relative w-10 h-5 rounded-full transition-colors cursor-pointer
                                          disabled:opacity-50 ${
                                            agent.is_active
                                              ? "bg-green-500"
                                              : "bg-gray-600"
                                          }`}
                              title={
                                agent.is_active
                                  ? t("crypto.toggle_active")
                                  : t("crypto.toggle_inactive")
                              }
                            >
                              <div
                                className={`absolute top-0.5 w-4 h-4 bg-white rounded-full
                                            transition-transform shadow-sm ${
                                              agent.is_active
                                                ? "translate-x-5"
                                                : "translate-x-0.5"
                                            }`}
                              />
                            </button>
                          </div>
                          <p className="text-xs text-gray-500 mt-1 truncate">
                            {t(
                              `crypto.desc_${agent.id}` as TranslationKey
                            )}
                          </p>
                        </div>
                      </div>

                      {/* Stats + Run Button */}
                      <div className="flex items-center gap-6 shrink-0">
                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 tracking-widest block">
                            {t("crypto.capital")}
                          </span>
                          <span className="text-sm font-mono text-white">
                            ${agent.capital.toLocaleString()}
                          </span>
                        </div>
                        <div className="text-right">
                          <span className="text-[10px] text-gray-500 tracking-widest block">
                            {t("crypto.itd_return")}
                          </span>
                          <span
                            className={`text-sm font-mono font-bold ${
                              agent.itd_return >= 0
                                ? "text-green-400"
                                : "text-red-400"
                            }`}
                          >
                            {agent.itd_return >= 0 ? "+" : ""}
                            {agent.itd_return.toFixed(2)}%
                          </span>
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            runSingleAgent(agent.id);
                          }}
                          disabled={isRunning || runningAll}
                          className="px-4 py-2 bg-[#f7931a]/10 hover:bg-[#f7931a]/20
                                     text-[#f7931a] font-bold rounded-lg transition text-xs
                                     disabled:opacity-50 whitespace-nowrap border border-[#f7931a]/30"
                        >
                          {isRunning
                            ? t("crypto.running")
                            : t("crypto.run_agent_cycle")}
                        </button>
                      </div>
                    </div>
                  </div>
                </Link>
              );
            })}
      </div>
    </div>
  );
}
