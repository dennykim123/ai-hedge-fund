"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "../ui/CommandPalette";
import { I18nProvider } from "@/lib/i18n";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <I18nProvider>{children}</I18nProvider>;
  }

  return (
    <I18nProvider>
      <Sidebar />
      <main className="ml-56 p-6 min-h-screen">{children}</main>
      <CommandPalette />
    </I18nProvider>
  );
}
