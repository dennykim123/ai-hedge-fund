"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  TrendingUp,
  Wallet,
  ChevronLeft,
  Globe,
  Home,
} from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const NAV_ITEMS: {
  href: string;
  icon: typeof TrendingUp;
  labelKey: TranslationKey;
}[] = [
  { href: "/crypto", icon: LayoutDashboard, labelKey: "crypto.nav_dashboard" },
  { href: "/crypto/trade", icon: TrendingUp, labelKey: "crypto.nav_trade" },
  { href: "/crypto/portfolio", icon: Wallet, labelKey: "crypto.nav_portfolio" },
];

export function CryptoSidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const { locale, setLocale, t } = useI18n();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#161b22] border-r border-[#30363d] z-30
                   flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
    >
      <div className="flex items-center gap-3 p-4 border-b border-[#30363d]">
        <span className="text-2xl">{"\u20BF"}</span>
        {!collapsed && (
          <span className="font-bold text-[#f7931a] text-sm">
            {t("crypto.title")}
          </span>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey }) => {
          const active = href === "/crypto"
            ? pathname === "/crypto"
            : pathname?.startsWith(href);

          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm
                          ${
                            active
                              ? "bg-[#f7931a]/10 text-[#f7931a] border border-[#f7931a]/20"
                              : "text-[#8b949e] hover:text-white hover:bg-[#1c2128]"
                          }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{t(labelKey)}</span>}
            </Link>
          );
        })}

        <div className="my-4 border-t border-[#30363d] mx-3" />

        <Link
          href="/"
          className="flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm
                     text-[#8b949e] hover:text-white hover:bg-[#1c2128]"
        >
          <Home size={18} className="shrink-0" />
          {!collapsed && <span>{t("crypto.back_home")}</span>}
        </Link>
      </nav>

      <div className="border-t border-[#30363d]">
        <button
          onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
          className="flex items-center gap-3 w-full px-4 py-3
                     text-[#8b949e] hover:text-white transition text-sm"
        >
          <Globe size={16} className="shrink-0" />
          {!collapsed && (
            <span className="font-mono text-xs">
              {locale === "ko" ? "EN" : "\uD55C\uAD6D\uC5B4"}
            </span>
          )}
        </button>
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center justify-center w-full p-4 border-t border-[#30363d]
                     text-[#8b949e] hover:text-white transition"
        >
          <ChevronLeft
            size={18}
            className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
          />
        </button>
      </div>
    </aside>
  );
}
