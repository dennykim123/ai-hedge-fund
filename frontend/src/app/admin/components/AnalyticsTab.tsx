"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface AlphaEntry {
  pm_id: string;
  name: string;
  emoji: string;
  provider: string;
  total_return_pct: number;
  alpha_pct: number;
  sharpe: number;
  sortino: number;
  mdd: number;
}

export function AnalyticsTab() {
  const [alpha, setAlpha] = useState<AlphaEntry[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/analytics/alpha`)
      .then((r) => r.json())
      .then((d) => setAlpha(d.leaderboard || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Alpha Leaderboard</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-[#8b949e] text-xs">
                <th className="text-left pb-2">PM</th>
                <th className="text-right pb-2">RETURN</th>
                <th className="text-right pb-2">ALPHA</th>
                <th className="text-right pb-2 text-cyan-600">SHARPE</th>
                <th className="text-right pb-2 text-cyan-600">SORTINO</th>
                <th className="text-right pb-2 text-cyan-600">MDD</th>
              </tr>
            </thead>
            <tbody>
              {alpha.map((pm) => (
                <tr key={pm.pm_id} className="border-t border-[#30363d]">
                  <td className="py-2">
                    <span className="mr-2">{pm.emoji}</span>
                    {pm.name}
                    <span className="ml-2 text-xs text-[#8b949e]">{pm.provider}</span>
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${pm.total_return_pct >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
                  >
                    {pm.total_return_pct >= 0 ? "+" : ""}
                    {pm.total_return_pct.toFixed(2)}%
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${pm.alpha_pct >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
                  >
                    {pm.alpha_pct >= 0 ? "+" : ""}
                    {pm.alpha_pct.toFixed(2)}%
                  </td>
                  <td className="py-2 text-right font-mono text-[#8b949e]">
                    {pm.sharpe ? pm.sharpe.toFixed(2) : "\u2014"}
                  </td>
                  <td className="py-2 text-right font-mono text-[#8b949e]">
                    {pm.sortino ? pm.sortino.toFixed(2) : "\u2014"}
                  </td>
                  <td
                    className={`py-2 text-right font-mono ${pm.mdd < 0 ? "text-[#ff6b6b]" : "text-[#8b949e]"}`}
                  >
                    {pm.mdd ? `${(pm.mdd * 100).toFixed(1)}%` : "\u2014"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
