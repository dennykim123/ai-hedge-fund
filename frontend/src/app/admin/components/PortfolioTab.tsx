"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Trade {
  id: number;
  pm_id: string;
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  conviction: number;
  executed_at: string | null;
}

export function PortfolioTab() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [positions, setPositions] = useState<Array<Record<string, unknown>>>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/trades?limit=30`)
      .then((r) => r.json())
      .then((d) => setTrades(d.trades || []));
    fetch(`${BASE_URL}/api/fund/positions/breakdown`)
      .then((r) => r.json())
      .then((d) => setPositions(d.positions || []));
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Active Positions</h3>
        {positions.length === 0 ? (
          <p className="text-[#8b949e] text-sm">No positions yet</p>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {positions.map((p, i) => (
              <div key={i} className="bg-[#1c2128] p-3 rounded-lg">
                <p className="font-mono font-bold text-white">{String(p.symbol)}</p>
                <p className="text-xs text-[#8b949e]">Qty: {Number(p.total_quantity)}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h3 className="font-bold mb-4">Recent Trades</h3>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-[#8b949e] text-xs">
              <th className="text-left pb-2">TIME</th>
              <th className="text-left pb-2">PM</th>
              <th className="text-left pb-2">ACTION</th>
              <th className="text-left pb-2">SYMBOL</th>
              <th className="text-right pb-2">QTY</th>
              <th className="text-right pb-2">PRICE</th>
            </tr>
          </thead>
          <tbody>
            {trades.map((t) => (
              <tr key={t.id} className="border-t border-[#30363d]">
                <td className="py-2 text-[#8b949e]">
                  {t.executed_at ? new Date(t.executed_at).toLocaleTimeString() : "—"}
                </td>
                <td className="py-2">{t.pm_id}</td>
                <td className="py-2">
                  <span
                    className={`text-xs px-2 py-0.5 rounded ${t.action === "BUY" ? "bg-green-900 text-green-300" : "bg-red-900 text-red-300"}`}
                  >
                    {t.action}
                  </span>
                </td>
                <td className="py-2 font-mono">{t.symbol}</td>
                <td className="py-2 text-right font-mono">{t.quantity}</td>
                <td className="py-2 text-right font-mono">${t.price.toFixed(2)}</td>
              </tr>
            ))}
            {trades.length === 0 && (
              <tr>
                <td colSpan={6} className="py-4 text-center text-[#8b949e]">
                  No trades yet
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
