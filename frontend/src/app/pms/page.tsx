"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PMSummary } from "@/lib/api";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

function returnColor(value: number) {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-gray-400";
}

export default function PMsPage() {
  const [pms, setPMs] = useState<PMSummary[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/pms`)
      .then((r) => r.json())
      .then(setPMs)
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white p-8">
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center gap-4 mb-8">
          <Link href="/" className="text-gray-500 hover:text-white text-sm">
            &larr; Home
          </Link>
          <h1 className="text-3xl font-bold text-cyan-400">AI Portfolio Managers</h1>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {pms.map((pm) => (
            <Link key={pm.id} href={`/pms/${pm.id}`}>
              <div className="bg-gray-900 border border-gray-800 hover:border-cyan-800 rounded-xl p-6 transition cursor-pointer">
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-4xl">{pm.emoji}</span>
                  <div>
                    <h2 className="font-bold text-white">{pm.name}</h2>
                    <p className="text-sm text-gray-500">{pm.strategy}</p>
                  </div>
                  <span className="ml-auto text-xs bg-gray-800 px-2 py-1 rounded text-gray-400">
                    {pm.llm_provider}
                  </span>
                </div>
                <div className="flex justify-between">
                  <div>
                    <p className="text-xs text-gray-500">CAPITAL</p>
                    <p className="font-mono text-white">
                      ${pm.current_capital.toLocaleString()}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500">ITD RETURN</p>
                    <p
                      className={`font-mono font-bold ${returnColor(pm.itd_return)}`}
                    >
                      {pm.itd_return >= 0 ? "+" : ""}
                      {pm.itd_return.toFixed(2)}%
                    </p>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </main>
  );
}
