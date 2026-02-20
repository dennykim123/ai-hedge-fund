import { TrendingUp, Minus, AlertTriangle } from "lucide-react";

type HealthStatus = "EXCELLENT" | "GOOD" | "CAUTION" | "DANGER";

function getHealth(itdReturn: number, mdd: number, sharpe: number): HealthStatus {
  if (mdd < -0.15 || itdReturn < -0.10) return "DANGER";
  if (mdd < -0.08 || itdReturn < -0.03) return "CAUTION";
  if (itdReturn > 0.05 && sharpe > 1.0) return "EXCELLENT";
  return "GOOD";
}

const HEALTH_CONFIG = {
  EXCELLENT: { color: "#00d4aa", bg: "rgba(0,212,170,0.1)", border: "rgba(0,212,170,0.3)", Icon: TrendingUp, label: "EXCELLENT" },
  GOOD: { color: "#22d3ee", bg: "rgba(34,211,238,0.1)", border: "rgba(34,211,238,0.3)", Icon: TrendingUp, label: "GOOD" },
  CAUTION: { color: "#f0b429", bg: "rgba(240,180,41,0.1)", border: "rgba(240,180,41,0.3)", Icon: Minus, label: "CAUTION" },
  DANGER: { color: "#ff6b6b", bg: "rgba(255,107,107,0.1)", border: "rgba(255,107,107,0.3)", Icon: AlertTriangle, label: "DANGER" },
};

interface Props {
  itdReturn: number;
  mdd: number;
  sharpe: number;
}

export function FundHealthBadge({ itdReturn, mdd, sharpe }: Props) {
  const status = getHealth(itdReturn, mdd, sharpe);
  const { color, bg, border, Icon, label } = HEALTH_CONFIG[status];

  return (
    <div
      className="glass-card p-6 flex flex-col items-center justify-center gap-3"
      style={{ background: bg, borderColor: border }}
    >
      <Icon size={40} color={color} />
      <div className="text-center">
        <p className="text-xs text-[#8b949e] tracking-widest mb-1">FUND HEALTH</p>
        <p className="text-2xl font-bold" style={{ color }}>{label}</p>
      </div>
      <div className="text-xs text-[#8b949e] space-y-1 w-full">
        <div className="flex justify-between">
          <span>ITD Return</span>
          <span style={{ color }}>{itdReturn >= 0 ? "+" : ""}{(itdReturn * 100).toFixed(2)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Max Drawdown</span>
          <span style={{ color: mdd < -0.08 ? "#ff6b6b" : "#8b949e" }}>{(mdd * 100).toFixed(1)}%</span>
        </div>
        <div className="flex justify-between">
          <span>Sharpe</span>
          <span style={{ color: sharpe > 1.5 ? "#00d4aa" : "#8b949e" }}>{sharpe.toFixed(2)}</span>
        </div>
      </div>
    </div>
  );
}
