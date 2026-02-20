"use client";

import { useEffect, useState } from "react";
import { PMSummary } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function returnColor(v: number) {
  return v >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]";
}

export function PMsTab() {
  const [pms, setPMs] = useState<PMSummary[]>([]);
  const [selectedPM, setSelectedPM] = useState<string | null>(null);
  const [detail, setDetail] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/pms`)
      .then((r) => r.json())
      .then(setPMs);
  }, []);

  const openPM = async (pmId: string) => {
    const d = await fetch(`${BASE_URL}/api/pm/${pmId}`).then((r) => r.json());
    setDetail(d);
    setSelectedPM(pmId);
  };

  return (
    <div className="space-y-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">PM Leaderboard</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#8b949e] text-xs">
              <th className="text-left pb-2">PM</th>
              <th className="text-left pb-2">STRATEGY</th>
              <th className="text-left pb-2">PROVIDER</th>
              <th className="text-right pb-2">CAPITAL</th>
              <th className="text-right pb-2">RETURN</th>
            </tr>
          </thead>
          <tbody>
            {pms.map((pm) => (
              <tr
                key={pm.id}
                className="border-t border-[#30363d] cursor-pointer hover:bg-[#1c2128] transition"
                onClick={() => openPM(pm.id)}
              >
                <td className="py-3">
                  <span className="mr-2">{pm.emoji}</span>
                  {pm.name}
                </td>
                <td className="py-3 text-[#8b949e]">{pm.strategy}</td>
                <td className="py-3">
                  <span className="text-xs bg-[#1c2128] px-2 py-0.5 rounded text-[#8b949e]">
                    {pm.llm_provider}
                  </span>
                </td>
                <td className="py-3 text-right font-mono">
                  ${pm.current_capital.toLocaleString()}
                </td>
                <td className={`py-3 text-right font-mono font-bold ${returnColor(pm.itd_return)}`}>
                  {pm.itd_return >= 0 ? "+" : ""}
                  {pm.itd_return.toFixed(2)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selectedPM && detail && (
        <div className="fixed inset-0 bg-black/60 z-40 flex justify-end" onClick={() => setSelectedPM(null)}>
          <div
            className="w-full max-w-xl bg-[#161b22] border-l border-[#30363d] h-full overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-[#30363d]">
              <h2 className="text-lg font-bold">
                {String(detail.emoji)} {String(detail.name)}
              </h2>
              <button onClick={() => setSelectedPM(null)} className="text-[#8b949e] hover:text-white">
                &times;
              </button>
            </div>
            <div className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#1c2128] p-4 rounded-lg">
                  <p className="text-xs text-[#8b949e]">STRATEGY</p>
                  <p className="font-medium">{String(detail.strategy)}</p>
                </div>
                <div className="bg-[#1c2128] p-4 rounded-lg">
                  <p className="text-xs text-[#8b949e]">PROVIDER</p>
                  <p className="font-medium">{String(detail.llm_provider)}</p>
                </div>
                <div className="bg-[#1c2128] p-4 rounded-lg">
                  <p className="text-xs text-[#8b949e]">CAPITAL</p>
                  <p className="font-mono">${Number(detail.current_capital).toLocaleString()}</p>
                </div>
                <div className="bg-[#1c2128] p-4 rounded-lg">
                  <p className="text-xs text-[#8b949e]">ITD RETURN</p>
                  <p className={`font-mono font-bold ${returnColor(Number(detail.itd_return))}`}>
                    {Number(detail.itd_return) >= 0 ? "+" : ""}
                    {Number(detail.itd_return).toFixed(2)}%
                  </p>
                </div>
              </div>
              <div className="bg-[#1c2128] p-4 rounded-lg">
                <p className="text-xs text-[#8b949e] mb-2">POSITIONS ({Number(detail.position_count)})</p>
                {Array.isArray(detail.positions) && detail.positions.length > 0 ? (
                  <div className="space-y-1">
                    {(detail.positions as Array<Record<string, unknown>>).map((p, i) => (
                      <div key={i} className="flex justify-between text-sm">
                        <span className="font-mono">{String(p.symbol)}</span>
                        <span className="text-[#8b949e]">{Number(p.quantity)} @ ${Number(p.avg_cost).toFixed(2)}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-[#8b949e]">No positions</p>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
