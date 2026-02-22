"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface Position {
  symbol: string;
  quantity: number;
  avg_cost: number;
  market_value: number;
}

interface Trade {
  id: number;
  symbol: string;
  action: string;
  quantity: number;
  price: number;
  value: number;
  conviction_score: number;
  reasoning: string;
  executed_at: string | null;
}

interface PMInfo {
  capital: number;
  initial_capital: number;
  itd_return: number;
}

export default function CryptoPortfolio() {
  const { t } = useI18n();
  const [positions, setPositions] = useState<Position[]>([]);
  const [trades, setTrades] = useState<Trade[]>([]);
  const [pm, setPm] = useState<PMInfo | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const res = await fetch(`${BASE_URL}/api/crypto/portfolio`);
        const data = await res.json();
        setPositions(data.positions || []);
        setTrades(data.trades || []);
        if (data.pm) setPm(data.pm);
      } catch {
        // silent
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const totalValue = positions.reduce((sum, p) => sum + p.market_value, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-[#f7931a]">
          {t("crypto.portfolio_title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("crypto.portfolio_subtitle")}
        </p>
      </div>

      {/* Summary Cards */}
      {pm && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
            <span className="text-xs text-gray-500">{t("crypto.capital")}</span>
            <div className="text-lg font-mono text-white mt-1">
              ${pm.capital.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
            <span className="text-xs text-gray-500">{t("crypto.itd_return")}</span>
            <div className={`text-lg font-mono mt-1 ${pm.itd_return >= 0 ? "text-green-400" : "text-red-400"}`}>
              {pm.itd_return >= 0 ? "+" : ""}{pm.itd_return.toFixed(2)}%
            </div>
          </div>
          <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
            <span className="text-xs text-gray-500">{t("crypto.holdings_value")}</span>
            <div className="text-lg font-mono text-white mt-1">
              ${totalValue.toLocaleString()}
            </div>
          </div>
          <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
            <span className="text-xs text-gray-500">{t("crypto.positions_count")}</span>
            <div className="text-lg font-mono text-white mt-1">
              {positions.length}
            </div>
          </div>
        </div>
      )}

      {/* Positions */}
      <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
        <h2 className="text-sm tracking-widest text-gray-500 mb-3">
          {t("crypto.holdings")}
        </h2>
        {loading ? (
          <div className="animate-pulse space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-gray-800 rounded-lg" />
            ))}
          </div>
        ) : positions.length === 0 ? (
          <p className="text-gray-600 text-sm py-8 text-center">
            {t("crypto.no_positions")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-[#30363d]">
                  <th className="text-left py-2 px-3">{t("crypto.th_symbol")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_quantity")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_avg_cost")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_value")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_allocation")}</th>
                </tr>
              </thead>
              <tbody>
                {positions.map((p) => (
                  <tr key={p.symbol} className="border-b border-[#30363d]/50 hover:bg-gray-800/50">
                    <td className="py-2.5 px-3 font-bold text-white">{p.symbol}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      {p.quantity.toFixed(6)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      ${p.avg_cost.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white">
                      ${p.market_value.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-16 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-[#f7931a] rounded-full"
                            style={{ width: `${totalValue > 0 ? (p.market_value / totalValue * 100) : 0}%` }}
                          />
                        </div>
                        <span className="text-xs text-gray-500 font-mono w-10 text-right">
                          {totalValue > 0 ? (p.market_value / totalValue * 100).toFixed(1) : "0.0"}%
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Trade History */}
      <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4">
        <h2 className="text-sm tracking-widest text-gray-500 mb-3">
          {t("crypto.trade_history")}
        </h2>
        {trades.length === 0 ? (
          <p className="text-gray-600 text-sm py-8 text-center">
            {t("crypto.no_trades")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-500 text-xs border-b border-[#30363d]">
                  <th className="text-left py-2 px-3">{t("crypto.th_time")}</th>
                  <th className="text-left py-2 px-3">{t("crypto.th_action")}</th>
                  <th className="text-left py-2 px-3">{t("crypto.th_symbol")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_quantity")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_price")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_value")}</th>
                  <th className="text-right py-2 px-3">{t("crypto.th_conviction")}</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((trade) => (
                  <tr key={trade.id} className="border-b border-[#30363d]/50 hover:bg-gray-800/50">
                    <td className="py-2.5 px-3 text-gray-500 text-xs font-mono">
                      {trade.executed_at
                        ? new Date(trade.executed_at).toLocaleDateString()
                        : "-"}
                    </td>
                    <td className="py-2.5 px-3">
                      <span className={`text-xs font-bold px-1.5 py-0.5 rounded ${trade.action === "BUY" ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                        {trade.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 font-bold text-white">{trade.symbol}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      {trade.quantity.toFixed(6)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-gray-400">
                      ${trade.price.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono text-white">
                      ${trade.value.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-right">
                      <span className={`text-xs font-mono ${trade.conviction_score >= 0.7 ? "text-green-400" : trade.conviction_score >= 0.4 ? "text-yellow-400" : "text-gray-500"}`}>
                        {(trade.conviction_score * 100).toFixed(0)}%
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
