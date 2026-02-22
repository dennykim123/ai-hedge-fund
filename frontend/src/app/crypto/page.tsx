"use client";

import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

interface CryptoPrice {
  symbol: string;
  coin: string;
  price: number;
  change_24h: number;
}

interface FearGreed {
  score: number;
  rating: string;
  source: string;
}

interface SatoshiPM {
  id: string;
  name: string;
  emoji: string;
  capital: number;
  itd_return: number;
  is_active: boolean;
}

const COIN_ICONS: Record<string, string> = {
  BTC: "\u20BF",
  ETH: "\u039E",
  SOL: "\u25C6",
  BNB: "\u25C7",
  XRP: "\u00D7",
  ADA: "\u25CB",
  DOGE: "\uD83D\uDC15",
};

function getFearGreedColor(score: number): string {
  if (score <= 25) return "#ea3943";
  if (score <= 45) return "#ea8c00";
  if (score <= 55) return "#f5d100";
  if (score <= 75) return "#16c784";
  return "#16c784";
}

function getFearGreedLabel(score: number, rating: string): string {
  return rating || (
    score <= 25 ? "Extreme Fear" :
    score <= 45 ? "Fear" :
    score <= 55 ? "Neutral" :
    score <= 75 ? "Greed" : "Extreme Greed"
  );
}

export default function CryptoDashboard() {
  const { t } = useI18n();
  const [prices, setPrices] = useState<CryptoPrice[]>([]);
  const [fearGreed, setFearGreed] = useState<FearGreed | null>(null);
  const [satoshi, setSatoshi] = useState<SatoshiPM | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchAll = async () => {
    try {
      const [priceRes, fgRes, portRes] = await Promise.all([
        fetch(`${BASE_URL}/api/crypto/prices`),
        fetch(`${BASE_URL}/api/crypto/fear-greed`),
        fetch(`${BASE_URL}/api/crypto/portfolio`),
      ]);
      const priceData = await priceRes.json();
      const fgData = await fgRes.json();
      const portData = await portRes.json();

      setPrices(priceData.prices || []);
      setFearGreed(fgData);
      if (portData.pm) setSatoshi(portData.pm);
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 30_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#f7931a]">
          {t("crypto.dashboard_title")}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {t("crypto.dashboard_subtitle")}
        </p>
      </div>

      {/* Satoshi PM Status Bar */}
      {satoshi && (
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-4 flex items-center gap-6">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{satoshi.emoji}</span>
            <div>
              <span className="font-bold text-white text-sm">{satoshi.name}</span>
              <span className={`ml-2 text-xs px-2 py-0.5 rounded ${satoshi.is_active ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                {satoshi.is_active ? "ACTIVE" : "INACTIVE"}
              </span>
            </div>
          </div>
          <div className="border-l border-[#30363d] pl-6">
            <span className="text-xs text-gray-500">{t("crypto.capital")}</span>
            <span className="block text-white font-mono text-sm">
              ${satoshi.capital.toLocaleString()}
            </span>
          </div>
          <div className="border-l border-[#30363d] pl-6">
            <span className="text-xs text-gray-500">{t("crypto.itd_return")}</span>
            <span className={`block font-mono text-sm ${satoshi.itd_return >= 0 ? "text-green-400" : "text-red-400"}`}>
              {satoshi.itd_return >= 0 ? "+" : ""}{satoshi.itd_return.toFixed(2)}%
            </span>
          </div>
        </div>
      )}

      {/* Price Grid + Fear & Greed */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
        {/* Price Cards */}
        <div className="lg:col-span-3 grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {loading
            ? Array.from({ length: 7 }).map((_, i) => (
                <div key={i} className="bg-gray-900 border border-[#30363d] rounded-xl p-4 animate-pulse h-24" />
              ))
            : prices.map((p) => (
                <div
                  key={p.symbol}
                  className="bg-gray-900 border border-[#30363d] rounded-xl p-4 hover:border-[#f7931a]/30 transition"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-lg">{COIN_ICONS[p.coin] || p.coin[0]}</span>
                    <span className="font-bold text-white text-sm">{p.coin}</span>
                  </div>
                  <div className="font-mono text-lg text-white">
                    ${p.price.toLocaleString(undefined, { minimumFractionDigits: p.price < 10 ? 4 : 2, maximumFractionDigits: p.price < 10 ? 4 : 2 })}
                  </div>
                  <div className={`text-xs font-mono mt-1 ${p.change_24h >= 0 ? "text-green-400" : "text-red-400"}`}>
                    {p.change_24h >= 0 ? "+" : ""}{p.change_24h.toFixed(2)}% 24h
                  </div>
                </div>
              ))}
        </div>

        {/* Fear & Greed */}
        <div className="bg-gray-900 border border-[#30363d] rounded-xl p-6 flex flex-col items-center justify-center">
          <span className="text-xs text-gray-500 tracking-widest mb-3">
            {t("crypto.fear_greed")}
          </span>
          {fearGreed ? (
            <>
              <div
                className="text-5xl font-bold font-mono mb-2"
                style={{ color: getFearGreedColor(fearGreed.score) }}
              >
                {Math.round(fearGreed.score)}
              </div>
              <div
                className="text-sm font-medium"
                style={{ color: getFearGreedColor(fearGreed.score) }}
              >
                {getFearGreedLabel(fearGreed.score, fearGreed.rating)}
              </div>
              {/* Simple gauge bar */}
              <div className="w-full mt-4 h-2 bg-gray-800 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-700"
                  style={{
                    width: `${fearGreed.score}%`,
                    background: `linear-gradient(90deg, #ea3943, #ea8c00, #f5d100, #16c784)`,
                  }}
                />
              </div>
              <div className="flex justify-between w-full mt-1 text-[10px] text-gray-600">
                <span>Fear</span>
                <span>Greed</span>
              </div>
            </>
          ) : (
            <div className="text-gray-600 text-sm">Loading...</div>
          )}
        </div>
      </div>
    </div>
  );
}
