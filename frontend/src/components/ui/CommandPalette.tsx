"use client";

import { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";

const COMMANDS = [
  { label: "Overview", href: "/overview", icon: "👁" },
  { label: "Admin Dashboard", href: "/admin", icon: "📊" },
  { label: "AI Portfolio Managers", href: "/pms", icon: "🤖" },
  { label: "Risk Monitor", href: "/admin?tab=risk", icon: "🛡️" },
  { label: "Analytics", href: "/admin?tab=analytics", icon: "📈" },
  { label: "System Status", href: "/admin?tab=system", icon: "⚙️" },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, []);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            className="fixed inset-0 bg-black/60 z-50"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
          <motion.div
            className="fixed top-1/4 left-1/2 -translate-x-1/2 w-full max-w-lg z-50"
            initial={{ opacity: 0, scale: 0.95, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: -10 }}
            transition={{ duration: 0.15 }}
          >
            <Command
              className="glass-card overflow-hidden shadow-2xl"
              style={{
                background: "#161b22",
                border: "1px solid #30363d",
              }}
            >
              <Command.Input
                placeholder="Navigate pages..."
                className="w-full px-4 py-4 bg-transparent text-white placeholder-[#8b949e]
                           border-b border-[#30363d] outline-none text-sm"
              />
              <Command.List className="max-h-64 overflow-y-auto p-2">
                <Command.Empty className="py-8 text-center text-[#8b949e] text-sm">
                  No results
                </Command.Empty>
                {COMMANDS.map(({ label, href, icon }) => (
                  <Command.Item
                    key={href}
                    value={label}
                    onSelect={() => {
                      router.push(href);
                      setOpen(false);
                    }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-lg cursor-pointer
                               text-sm text-[#e6edf3] aria-selected:bg-[#1c2128] transition"
                  >
                    <span>{icon}</span>
                    <span>{label}</span>
                  </Command.Item>
                ))}
              </Command.List>
            </Command>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
