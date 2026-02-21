"use client";

import { FundStats } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 0,
  }).format(value);
}

function formatReturn(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

function returnColor(value: number): string {
  if (value > 0) return "text-emerald-400";
  if (value < 0) return "text-red-400";
  return "text-gray-400";
}

export function FundStatsGrid({ stats }: { stats: FundStats }) {
  const { t } = useI18n();

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-px bg-gray-800 border border-gray-800 rounded-xl overflow-hidden">
      {[
        { label: t("stats.fund_nav"), value: formatCurrency(stats.nav), color: "text-cyan-400" },
        { label: t("stats.today"), value: formatReturn(stats.today_return), color: returnColor(stats.today_return) },
        { label: t("stats.prior_day"), value: formatReturn(stats.prior_day_return), color: returnColor(stats.prior_day_return) },
        { label: t("stats.itd_return"), value: formatReturn(stats.itd_return), color: returnColor(stats.itd_return) },
        { label: t("stats.active_pms"), value: stats.active_pms.toString(), color: "text-blue-400" },
        { label: t("stats.positions"), value: stats.total_positions.toString(), color: "text-yellow-400" },
      ].map(({ label, value, color }) => (
        <div key={label} className="bg-gray-900 p-6 flex flex-col items-center justify-center">
          <span className={`text-3xl font-mono font-bold ${color}`}>{value}</span>
          <span className="text-xs text-gray-500 mt-2 tracking-widest">{label}</span>
        </div>
      ))}
    </div>
  );
}
