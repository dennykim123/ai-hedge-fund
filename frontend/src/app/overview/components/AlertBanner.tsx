import { AlertTriangle, CheckCircle, Info } from "lucide-react";

export type AlertLevel = "ok" | "warn" | "danger";

interface Alert {
  level: AlertLevel;
  message: string;
}

const LEVEL_CONFIG = {
  ok: { color: "#00d4aa", bg: "rgba(0,212,170,0.08)", border: "rgba(0,212,170,0.2)", Icon: CheckCircle },
  warn: { color: "#f0b429", bg: "rgba(240,180,41,0.08)", border: "rgba(240,180,41,0.2)", Icon: Info },
  danger: { color: "#ff6b6b", bg: "rgba(255,107,107,0.08)", border: "rgba(255,107,107,0.2)", Icon: AlertTriangle },
};

export function AlertBanner({ alerts }: { alerts: Alert[] }) {
  if (alerts.length === 0) return null;
  const topLevel =
    alerts.find((a) => a.level === "danger")?.level ??
    alerts.find((a) => a.level === "warn")?.level ??
    "ok";
  const { color, bg, border, Icon } = LEVEL_CONFIG[topLevel];

  return (
    <div
      className="rounded-xl px-4 py-3 flex items-center gap-3 mb-4"
      style={{ background: bg, border: `1px solid ${border}` }}
    >
      <Icon size={16} color={color} />
      <div className="flex gap-4 flex-wrap">
        {alerts.map((a, i) => (
          <span
            key={i}
            className="text-sm"
            style={{ color: LEVEL_CONFIG[a.level].color }}
          >
            {a.message}
          </span>
        ))}
      </div>
    </div>
  );
}
