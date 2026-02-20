"use client";

import { usePathname } from "next/navigation";
import { Sidebar } from "./Sidebar";
import { CommandPalette } from "../ui/CommandPalette";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isLanding = pathname === "/";

  if (isLanding) {
    return <>{children}</>;
  }

  return (
    <>
      <Sidebar />
      <main className="ml-56 p-6 min-h-screen">{children}</main>
      <CommandPalette />
    </>
  );
}
