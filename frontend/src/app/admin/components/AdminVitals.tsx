"use client";

interface VitalsData {
  nav: number;
  today_return: number;
  itd_return: number;
  active_pms: number;
  total_positions: number;
}

function returnColor(v: number) {
  return v >= 0 ? "text-[#00d4aa]" : "text-[#ff6b6b]";
}

export function AdminVitals({ vitals }: { vitals: VitalsData | null }) {
  if (!vitals) return null;

  return (
    <div className="flex items-center gap-6 px-4 py-2 bg-[#161b22] border-b border-[#30363d] text-sm">
      <span className="text-[#8b949e]">NAV</span>
      <span className="font-mono text-cyan-400 font-bold">
        ${vitals.nav.toLocaleString()}
      </span>
      <span className="text-[#8b949e]">Today</span>
      <span className={`font-mono font-bold ${returnColor(vitals.today_return)}`}>
        {vitals.today_return >= 0 ? "+" : ""}
        {vitals.today_return.toFixed(2)}%
      </span>
      <span className="text-[#8b949e]">ITD</span>
      <span className={`font-mono font-bold ${returnColor(vitals.itd_return)}`}>
        {vitals.itd_return >= 0 ? "+" : ""}
        {vitals.itd_return.toFixed(2)}%
      </span>
      <span className="text-[#8b949e]">PMs</span>
      <span className="font-mono text-blue-400">{vitals.active_pms}</span>
      <span className="text-[#8b949e]">Pos</span>
      <span className="font-mono text-yellow-400">{vitals.total_positions}</span>
      <div className="ml-auto flex items-center gap-2">
        <div className="w-2 h-2 rounded-full bg-[#00d4aa] animate-pulse" />
        <span className="text-xs text-[#8b949e]">LIVE</span>
      </div>
    </div>
  );
}
