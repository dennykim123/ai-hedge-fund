"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import {
  LayoutDashboard,
  Eye,
  Bot,
  Briefcase,
  Shield,
  BarChart2,
  Settings,
  ChevronLeft,
  TrendingUp,
  FlaskConical,
  Compass,
  Globe,
} from "lucide-react";
import { useI18n, type TranslationKey } from "@/lib/i18n";

const NAV_ITEMS: {
  href: string;
  icon: typeof TrendingUp;
  labelKey: TranslationKey;
  dividerAfter?: boolean;
}[] = [
  { href: "/", icon: TrendingUp, labelKey: "nav.home" },
  { href: "/overview", icon: Eye, labelKey: "nav.overview" },
  { href: "/admin", icon: LayoutDashboard, labelKey: "nav.dashboard" },
  { href: "/admin?tab=strategic", icon: Compass, labelKey: "nav.strategic" },
  { href: "/pms", icon: Bot, labelKey: "nav.pms" },
  { href: "/admin?tab=portfolio", icon: Briefcase, labelKey: "nav.portfolio" },
  { href: "/admin?tab=risk", icon: Shield, labelKey: "nav.risk" },
  { href: "/admin?tab=analytics", icon: BarChart2, labelKey: "nav.analytics", dividerAfter: true },
  { href: "/backtest", icon: FlaskConical, labelKey: "nav.backtest" },
  { href: "/admin?tab=system", icon: Settings, labelKey: "nav.system" },
];

export function Sidebar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const currentTab = searchParams.get("tab");
  const [collapsed, setCollapsed] = useState(false);
  const { locale, setLocale, t } = useI18n();

  return (
    <aside
      className={`fixed left-0 top-0 h-full bg-[#161b22] border-r border-[#30363d] z-30
                   flex flex-col transition-all duration-300 ${collapsed ? "w-16" : "w-56"}`}
    >
      <div className="flex items-center gap-3 p-4 border-b border-[#30363d]">
        <span className="text-2xl">🏦</span>
        {!collapsed && (
          <span className="font-bold text-cyan-400 text-sm">AI Hedge Fund</span>
        )}
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2 overflow-y-auto">
        {NAV_ITEMS.map(({ href, icon: Icon, labelKey, dividerAfter }) => {
          const isTabLink = href.includes("?tab=");
          const tabValue = isTabLink
            ? new URLSearchParams(href.split("?")[1]).get("tab")
            : null;

          const active = isTabLink
            ? pathname === "/admin" && currentTab === tabValue
            : href === "/"
              ? pathname === "/"
              : href === "/admin"
                ? pathname === "/admin" && !currentTab
                : pathname?.startsWith(href.split("?")[0]);

          return (
            <div key={href + labelKey}>
              <Link
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm
                            ${
                              active
                                ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                                : "text-[#8b949e] hover:text-white hover:bg-[#1c2128]"
                            }`}
              >
                <Icon size={18} className="shrink-0" />
                {!collapsed && <span>{t(labelKey)}</span>}
              </Link>
              {dividerAfter && (
                <div className="my-2 border-t border-[#30363d] mx-3" />
              )}
            </div>
          );
        })}
      </nav>

      {/* Language Toggle + Collapse */}
      <div className="border-t border-[#30363d]">
        <button
          onClick={() => setLocale(locale === "ko" ? "en" : "ko")}
          className="flex items-center gap-3 w-full px-4 py-3
                     text-[#8b949e] hover:text-white transition text-sm"
        >
          <Globe size={16} className="shrink-0" />
          {!collapsed && (
            <span className="font-mono text-xs">
              {locale === "ko" ? "EN" : "한국어"}
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
