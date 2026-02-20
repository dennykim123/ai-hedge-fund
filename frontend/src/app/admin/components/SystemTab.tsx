"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface SystemData {
  services: Record<string, { status: string; uptime?: string }>;
  signal_freshness: Record<string, string | null>;
}

function StatusBadge({ status }: { status: string }) {
  const color =
    status === "healthy"
      ? "bg-green-900 text-green-300"
      : status === "not_configured"
        ? "bg-yellow-900 text-yellow-300"
        : "bg-red-900 text-red-300";
  return (
    <span className={`text-xs px-2 py-0.5 rounded ${color}`}>{status}</span>
  );
}

export function SystemTab() {
  const [system, setSystem] = useState<SystemData | null>(null);
  const [pipeline, setPipeline] = useState<Record<string, number> | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/system/overview`)
      .then((r) => r.json())
      .then(setSystem);
    fetch(`${BASE_URL}/api/fund/order-pipeline/stats`)
      .then((r) => r.json())
      .then(setPipeline);
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Service Status</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {system &&
            Object.entries(system.services).map(([name, info]) => (
              <div key={name} className="bg-[#1c2128] p-4 rounded-lg">
                <p className="text-xs text-[#8b949e] mb-2 uppercase">{name}</p>
                <StatusBadge status={info.status} />
              </div>
            ))}
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Order Pipeline</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {pipeline &&
            Object.entries(pipeline).map(([key, value]) => (
              <div key={key} className="bg-[#1c2128] p-4 rounded-lg text-center">
                <p className="text-2xl font-mono font-bold text-white">{value}</p>
                <p className="text-xs text-[#8b949e] mt-1 uppercase">
                  {key.replace(/_/g, " ")}
                </p>
              </div>
            ))}
        </div>
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Signal Freshness</h3>
        <div className="grid grid-cols-3 gap-4">
          {system &&
            Object.entries(system.signal_freshness).map(([signal, timestamp]) => (
              <div key={signal} className="bg-[#1c2128] p-4 rounded-lg">
                <p className="text-xs text-[#8b949e] mb-1 uppercase">{signal}</p>
                <p className="text-sm text-white">
                  {timestamp ? new Date(timestamp).toLocaleString() : "Not available"}
                </p>
              </div>
            ))}
        </div>
      </div>
    </div>
  );
}
