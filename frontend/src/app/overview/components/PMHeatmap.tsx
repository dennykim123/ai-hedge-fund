import { PMSummary } from "@/lib/api";

function returnToColor(ret: number): string {
  if (ret > 5) return "rgba(0,212,170,0.9)";
  if (ret > 2) return "rgba(0,212,170,0.6)";
  if (ret > 0) return "rgba(0,212,170,0.3)";
  if (ret > -2) return "rgba(255,107,107,0.3)";
  if (ret > -5) return "rgba(255,107,107,0.6)";
  return "rgba(255,107,107,0.9)";
}

function returnToTextColor(ret: number): string {
  return ret >= 0 ? "#00d4aa" : "#ff6b6b";
}

export function PMHeatmap({ pms }: { pms: PMSummary[] }) {
  return (
    <div className="glass-card p-5">
      <p className="text-xs text-[#8b949e] tracking-widest mb-4">PM PERFORMANCE HEATMAP</p>
      <div className="grid grid-cols-4 lg:grid-cols-6 gap-2">
        {pms.map((pm) => (
          <div
            key={pm.id}
            className="rounded-xl p-3 flex flex-col items-center gap-1 transition-transform hover:scale-105 cursor-pointer"
            style={{ background: returnToColor(pm.itd_return) }}
          >
            <span className="text-2xl">{pm.emoji}</span>
            <span className="text-xs font-medium text-white truncate w-full text-center">
              {pm.name}
            </span>
            <span
              className="text-sm font-mono font-bold"
              style={{ color: returnToTextColor(pm.itd_return) }}
            >
              {pm.itd_return >= 0 ? "+" : ""}{pm.itd_return.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
      <div className="flex items-center gap-2 mt-4 justify-center">
        {[
          { color: "rgba(255,107,107,0.9)", label: "< -5%" },
          { color: "rgba(255,107,107,0.3)", label: "0%" },
          { color: "rgba(0,212,170,0.3)", label: "+2%" },
          { color: "rgba(0,212,170,0.9)", label: "> +5%" },
        ].map(({ color, label }) => (
          <div key={label} className="flex items-center gap-1">
            <div className="w-4 h-4 rounded" style={{ background: color }} />
            <span className="text-xs text-[#8b949e]">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
