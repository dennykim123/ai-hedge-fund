"use client";

import { useState, useEffect, useCallback } from "react";
import { AdminVitals } from "./components/AdminVitals";
import { DashboardTab } from "./components/DashboardTab";
import { StrategicTab } from "./components/StrategicTab";
import { PMsTab } from "./components/PMsTab";
import { PortfolioTab } from "./components/PortfolioTab";
import { RiskTab } from "./components/RiskTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { SystemTab } from "./components/SystemTab";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const TABS = [
  { id: "dashboard", label: "Dashboard" },
  { id: "strategic", label: "Strategic" },
  { id: "pms", label: "PMs" },
  { id: "portfolio", label: "Portfolio" },
  { id: "risk", label: "Risk" },
  { id: "analytics", label: "Analytics" },
  { id: "system", label: "System" },
];

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState("dashboard");
  const [vitals, setVitals] = useState(null);

  const refreshVitals = useCallback(async () => {
    try {
      const r = await fetch(`${BASE_URL}/api/fund/stats`);
      if (r.ok) setVitals(await r.json());
    } catch {
      // Backend not running
    }
  }, []);

  useEffect(() => {
    refreshVitals();
    const interval = setInterval(refreshVitals, 30_000);
    return () => clearInterval(interval);
  }, [refreshVitals]);

  return (
    <div className="min-h-screen bg-[#0d1117] text-[#e6edf3]">
      <AdminVitals vitals={vitals} />
      <nav className="flex border-b border-[#30363d] px-4">
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setActiveTab(id)}
            className={`px-4 py-3 text-sm font-medium border-b-2 transition ${
              activeTab === id
                ? "border-cyan-400 text-white"
                : "border-transparent text-[#8b949e] hover:text-white"
            }`}
          >
            {label}
          </button>
        ))}
      </nav>
      <main className="p-6">
        {activeTab === "dashboard" && <DashboardTab />}
        {activeTab === "strategic" && <StrategicTab />}
        {activeTab === "pms" && <PMsTab />}
        {activeTab === "portfolio" && <PortfolioTab />}
        {activeTab === "risk" && <RiskTab />}
        {activeTab === "analytics" && <AnalyticsTab />}
        {activeTab === "system" && <SystemTab />}
      </main>
    </div>
  );
}
