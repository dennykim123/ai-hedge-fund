"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
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
} from "lucide-react";

const NAV_ITEMS = [
  { href: "/", icon: TrendingUp, label: "Home" },
  { href: "/overview", icon: Eye, label: "Overview" },
  { href: "/admin", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/pms", icon: Bot, label: "AI PMs" },
  { href: "/admin?tab=portfolio", icon: Briefcase, label: "Portfolio" },
  { href: "/admin?tab=risk", icon: Shield, label: "Risk" },
  { href: "/admin?tab=analytics", icon: BarChart2, label: "Analytics" },
  { href: "/admin?tab=system", icon: Settings, label: "System" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);

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

      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || (href !== "/" && pathname?.startsWith(href.split("?")[0]));
          return (
            <Link
              key={href + label}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition text-sm
                          ${
                            active
                              ? "bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                              : "text-[#8b949e] hover:text-white hover:bg-[#1c2128]"
                          }`}
            >
              <Icon size={18} className="shrink-0" />
              {!collapsed && <span>{label}</span>}
            </Link>
          );
        })}
      </nav>

      <button
        onClick={() => setCollapsed(!collapsed)}
        className="flex items-center justify-center p-4 border-t border-[#30363d]
                   text-[#8b949e] hover:text-white transition"
      >
        <ChevronLeft
          size={18}
          className={`transition-transform ${collapsed ? "rotate-180" : ""}`}
        />
      </button>
    </aside>
  );
}
