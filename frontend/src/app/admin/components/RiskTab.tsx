"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function RiskGauge({
  label,
  value,
  max,
  unit = "%",
  warnAt,
  dangerAt,
}: {
  label: string;
  value: number | null;
  max: number;
  unit?: string;
  warnAt: number;
  dangerAt: number;
}) {
  const pct = value != null ? Math.min(100, (value / max) * 100) : 0;
  const color =
    value == null
      ? "#30363d"
      : value >= dangerAt
        ? "#ff6b6b"
        : value >= warnAt
          ? "#f0b429"
          : "#00d4aa";

  return (
    <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
      <p className="text-xs text-[#8b949e] mb-2">{label}</p>
      <p className="text-3xl font-mono font-bold" style={{ color }}>
        {value != null ? `${value.toFixed(1)}${unit}` : "\u2014"}
      </p>
      <div className="mt-3 h-1.5 bg-[#1c2128] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

interface RiskData {
  exposure: { gross_pct: number; net_pct: number };
  margin: { utilization_pct: number };
  vix: number | null;
}

export function RiskTab() {
  const [risk, setRisk] = useState<RiskData | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/risk/overview`)
      .then((r) => r.json())
      .then(setRisk);
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <RiskGauge
          label="GROSS EXPOSURE"
          value={risk?.exposure?.gross_pct ?? null}
          max={300}
          warnAt={150}
          dangerAt={200}
        />
        <RiskGauge
          label="NET EXPOSURE"
          value={risk?.exposure?.net_pct ?? null}
          max={100}
          warnAt={50}
          dangerAt={80}
        />
        <RiskGauge
          label="MARGIN UTIL"
          value={risk?.margin?.utilization_pct ?? null}
          max={100}
          warnAt={50}
          dangerAt={75}
        />
        <RiskGauge
          label="VIX"
          value={risk?.vix ?? null}
          max={60}
          warnAt={20}
          dangerAt={30}
          unit=""
        />
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Risk Decisions</h3>
        <p className="text-[#8b949e] text-sm">No risk decisions recorded yet</p>
      </div>
    </div>
  );
}
