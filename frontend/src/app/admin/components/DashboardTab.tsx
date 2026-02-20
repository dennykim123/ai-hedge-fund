"use client";

import { useEffect, useState } from "react";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const FEED_TYPE_COLORS: Record<string, string> = {
  trade: "bg-blue-900 text-blue-300",
  research: "bg-purple-900 text-purple-300",
  risk_decision: "bg-red-900 text-red-300",
  negotiation: "bg-yellow-900 text-yellow-300",
};

interface FeedItem {
  emoji: string;
  type: string;
  summary: string;
  time: string | null;
}

interface IntelBrief {
  market_read: string;
  quality_score: number;
  hot_tickers: string[];
}

export function DashboardTab() {
  const [intel, setIntel] = useState<IntelBrief | null>(null);
  const [feed, setFeed] = useState<FeedItem[]>([]);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/intelligence/brief`)
      .then((r) => r.json())
      .then((d) => setIntel(d.brief));
    fetch(`${BASE_URL}/api/fund/activity-feed?limit=30`)
      .then((r) => r.json())
      .then((d) => setFeed(d.items || []));
  }, []);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <div className="flex items-center gap-2 mb-4">
          <span className="text-lg">🧠</span>
          <h2 className="font-bold">Market Intelligence</h2>
          {intel?.quality_score ? (
            <span className="ml-auto text-xs bg-[#1c2128] px-2 py-1 rounded text-[#8b949e]">
              {intel.quality_score}/100
            </span>
          ) : null}
        </div>
        <p className="text-sm text-[#8b949e] leading-relaxed mb-4">
          {intel?.market_read || "Loading..."}
        </p>
        {intel?.hot_tickers && intel.hot_tickers.length > 0 && (
          <div className="flex gap-2 flex-wrap">
            {intel.hot_tickers.map((t) => (
              <span
                key={t}
                className="text-xs bg-cyan-900 text-cyan-300 px-2 py-1 rounded"
              >
                {t}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="bg-[#161b22] border border-[#30363d] rounded-xl p-5">
        <h2 className="font-bold mb-4">Activity Feed</h2>
        <div className="space-y-2 max-h-[500px] overflow-y-auto">
          {feed.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-3 py-2 border-b border-[#30363d] last:border-0"
            >
              <span>{item.emoji}</span>
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs px-1.5 py-0.5 rounded mr-2 ${FEED_TYPE_COLORS[item.type] || "bg-gray-800 text-gray-400"}`}
                >
                  {item.type}
                </span>
                <span className="text-sm text-[#e6edf3]">{item.summary}</span>
              </div>
              <span className="text-xs text-[#8b949e] shrink-0">
                {item.time ? new Date(item.time).toLocaleTimeString() : ""}
              </span>
            </div>
          ))}
          {feed.length === 0 && (
            <p className="text-[#8b949e] text-sm">No activity yet</p>
          )}
        </div>
      </div>
    </div>
  );
}
