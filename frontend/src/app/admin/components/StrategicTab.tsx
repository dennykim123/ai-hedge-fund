"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export function StrategicTab() {
  const [overview, setOverview] = useState<{
    regime: string;
    pms: Array<{ id: string; name: string; emoji: string; strategy: string; goal: string }>;
  } | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/strategic/overview`)
      .then((r) => r.json())
      .then(setOverview);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Market Regime</h3>
        <div className="flex items-center gap-3">
          <span className="text-2xl px-3 py-1 bg-[#1c2128] rounded-lg">
            {overview?.regime === "normal" ? "📊" : "⚠️"}
          </span>
          <div>
            <p className="font-bold text-white capitalize">{overview?.regime || "—"}</p>
            <p className="text-sm text-[#8b949e]">Current market regime detection</p>
          </div>
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">PM Strategy Goals</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {overview?.pms?.map((pm) => (
            <div key={pm.id} className="flex items-center gap-3 p-3 bg-[#1c2128] rounded-lg">
              <span className="text-2xl">{pm.emoji}</span>
              <div>
                <p className="text-sm font-medium text-white">{pm.name}</p>
                <p className="text-xs text-[#8b949e]">{pm.strategy}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
