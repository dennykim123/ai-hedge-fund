"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { FundStats } from "@/lib/api";
import { FundStatsGrid } from "@/components/FundStats";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

const FEATURE_KEYS: Array<{
  emoji: string;
  titleKey: TranslationKey;
  descKey: TranslationKey;
}> = [
  {
    emoji: "\uD83E\uDDE0",
    titleKey: "home.feat1_title",
    descKey: "home.feat1_desc",
  },
  {
    emoji: "\uD83D\uDCE1",
    titleKey: "home.feat2_title",
    descKey: "home.feat2_desc",
  },
  {
    emoji: "\uD83D\uDCF1",
    titleKey: "home.feat3_title",
    descKey: "home.feat3_desc",
  },
  {
    emoji: "\uD83D\uDEE1\uFE0F",
    titleKey: "home.feat4_title",
    descKey: "home.feat4_desc",
  },
];

const PMS = [
  { emoji: "\uD83C\uDF0D", name: "Atlas", strategy: "Macro Regime" },
  {
    emoji: "\uD83C\uDFDB\uFE0F",
    name: "The Council",
    strategy: "Multi-Persona",
  },
  { emoji: "\uD83D\uDD2C", name: "Dr. Flow", strategy: "Event-Driven" },
  { emoji: "\uD83D\uDD75\uFE0F", name: "Insider", strategy: "Smart Money" },
  { emoji: "\uD83D\uDC80", name: "Max Payne", strategy: "Contrarian" },
  { emoji: "\u20BF", name: "Satoshi", strategy: "Crypto" },
  { emoji: "\uD83D\uDCCA", name: "Quant King", strategy: "Pure Quant" },
  { emoji: "\uD83C\uDF0F", name: "Asia Tiger", strategy: "Asia Markets" },
  { emoji: "\u26A1", name: "Momentum", strategy: "Trend Following" },
  { emoji: "\uD83D\uDEE1\uFE0F", name: "Sentinel", strategy: "Risk Hedge" },
  { emoji: "\uD83D\uDCF1", name: "Vox Populi", strategy: "Social Signals" },
];

const PROVIDERS = [
  { name: "Claude", color: "bg-orange-500" },
  { name: "GPT-4o", color: "bg-green-500" },
  { name: "Gemini", color: "bg-blue-500" },
  { name: "Grok", color: "bg-purple-500" },
  { name: "DeepSeek", color: "bg-cyan-500" },
];

export default function Home() {
  const { t } = useI18n();
  const [stats, setStats] = useState<FundStats | null>(null);

  useEffect(() => {
    fetch(`${BASE_URL}/api/fund/stats`)
      .then((r) => r.json())
      .then(setStats)
      .catch(() => {});
  }, []);

  return (
    <main className="min-h-screen bg-gray-950 text-white">
      {/* Hero */}
      <section className="flex flex-col items-center justify-center px-4 py-24 text-center">
        <h1 className="text-6xl font-bold text-cyan-400 mb-4">
          {t("home.title")}
        </h1>
        <p className="text-xl text-gray-400 mb-10">{t("home.subtitle")}</p>
        <div className="flex gap-4 flex-wrap justify-center">
          <Link
            href="/crypto"
            className="px-8 py-3 bg-[#f7931a] hover:bg-[#e8860f] text-black font-bold rounded-lg transition text-lg"
          >
            {t("home.crypto_cta")}
          </Link>
          <Link
            href="/admin"
            className="px-8 py-3 bg-cyan-500 hover:bg-cyan-400 text-black font-bold rounded-lg transition"
          >
            {t("home.dashboard")}
          </Link>
          <Link
            href="/pms"
            className="px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-lg transition"
          >
            {t("home.ai_pms")}
          </Link>
          <Link
            href="/overview"
            className="px-8 py-3 border border-gray-700 hover:border-gray-500 rounded-lg transition"
          >
            {t("home.overview")}
          </Link>
        </div>
      </section>

      {/* Stats */}
      {stats && (
        <section className="max-w-7xl mx-auto px-4 mb-16">
          <FundStatsGrid stats={stats} />
        </section>
      )}

      {/* Features */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <h2 className="text-center text-sm tracking-widest text-gray-500 mb-8">
          {t("home.how_it_works")}
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {FEATURE_KEYS.map(({ emoji, titleKey, descKey }) => (
            <div
              key={titleKey}
              className="bg-gray-900 border border-gray-800 rounded-xl p-6"
            >
              <span className="text-3xl mb-4 block">{emoji}</span>
              <h3 className="font-bold text-white mb-2">{t(titleKey)}</h3>
              <p className="text-sm text-gray-400">{t(descKey)}</p>
            </div>
          ))}
        </div>
      </section>

      {/* AI PMs */}
      <section className="max-w-7xl mx-auto px-4 mb-16">
        <h2 className="text-center text-sm tracking-widest text-gray-500 mb-8">
          {t("home.personalities")}
        </h2>
        <div className="grid grid-cols-3 md:grid-cols-6 lg:grid-cols-11 gap-3 mb-6">
          {PMS.map(({ emoji, name, strategy }) => (
            <div
              key={name}
              className="bg-gray-900 border border-gray-800 rounded-xl p-3 text-center"
            >
              <span className="text-2xl block mb-1">{emoji}</span>
              <span className="text-xs font-medium text-white block">
                {name}
              </span>
              <span className="text-xs text-gray-500">{strategy}</span>
            </div>
          ))}
        </div>
        <div className="flex justify-center gap-3 flex-wrap">
          {PROVIDERS.map(({ name, color }) => (
            <span
              key={name}
              className={`${color} text-black text-xs font-bold px-4 py-1.5 rounded-full`}
            >
              {name}
            </span>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="text-center text-gray-600 text-sm py-8 border-t border-gray-900">
        {t("home.footer")}
      </footer>
    </main>
  );
}
