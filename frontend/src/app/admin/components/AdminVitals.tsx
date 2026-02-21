"use client";

import { FlashNumber } from "@/components/ui/FlashNumber";
import { useI18n } from "@/lib/i18n";

interface VitalsData {
  nav: number;
  today_return: number;
  itd_return: number;
  active_pms: number;
  total_positions: number;
}

export function AdminVitals({ vitals }: { vitals: VitalsData | null }) {
  const { t } = useI18n();
  if (!vitals) return null;

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-[#161b22] border-b border-[#30363d] text-sm">
      <span className="text-[#8b949e]">{t("vitals.nav")}</span>
      <FlashNumber
        value={vitals.nav}
        format={(v) => `$${v.toLocaleString()}`}
        className="font-mono text-cyan-400 font-bold"
      />
      <span className="text-[#8b949e]">{t("vitals.today")}</span>
      <FlashNumber
        value={vitals.today_return}
        format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
        className={`font-mono font-bold ${vitals.today_return >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
      />
      <span className="text-[#8b949e]">{t("vitals.itd")}</span>
      <FlashNumber
        value={vitals.itd_return}
        format={(v) => `${v >= 0 ? "+" : ""}${v.toFixed(2)}%`}
        className={`font-mono font-bold ${vitals.itd_return >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]"}`}
      />
      <span className="text-[#8b949e]">{t("vitals.pms")}</span>
      <FlashNumber
        value={vitals.active_pms}
        format={String}
        className="font-mono text-blue-400"
      />
      <span className="text-[#8b949e]">{t("vitals.pos")}</span>
      <FlashNumber
        value={vitals.total_positions}
        format={String}
        className="font-mono text-yellow-400"
      />
      <div className="ml-auto flex items-center gap-2">
        <div className="live-dot" />
        <span className="text-xs text-[#8b949e] tracking-widest">
          {t("vitals.live")}
        </span>
      </div>
    </div>
  );
}
