"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import { AdminVitals } from "./components/AdminVitals";
import { DashboardTab } from "./components/DashboardTab";
import { StrategicTab } from "./components/StrategicTab";
import { PMsTab } from "./components/PMsTab";
import { PortfolioTab } from "./components/PortfolioTab";
import { RiskTab } from "./components/RiskTab";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { SystemTab } from "./components/SystemTab";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const VALID_TABS = [
  "dashboard",
  "strategic",
  "pms",
  "portfolio",
  "risk",
  "analytics",
  "system",
];

export default function AdminPage() {
  const searchParams = useSearchParams();
  const tabParam = searchParams.get("tab");
  const activeTab = VALID_TABS.includes(tabParam ?? "") ? tabParam! : "dashboard";
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
