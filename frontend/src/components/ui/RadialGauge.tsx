interface Props {
  value: number | null;
  max: number;
  label: string;
  unit?: string;
  warnAt?: number;
  dangerAt?: number;
  size?: number;
}

export function RadialGauge({
  value,
  max,
  label,
  unit = "%",
  warnAt = max * 0.6,
  dangerAt = max * 0.85,
  size = 120,
}: Props) {
  const radius = 45;
  const circumference = Math.PI * radius;
  const pct = value != null ? Math.min(1, value / max) : 0;
  const offset = circumference * (1 - pct);

  const color =
    value == null
      ? "#30363d"
      : value >= dangerAt
        ? "#ff6b6b"
        : value >= warnAt
          ? "#f0b429"
          : "#00d4aa";

  return (
    <div className="glass-card p-5 flex flex-col items-center">
      <svg width={size} height={size / 2 + 20} viewBox="0 0 100 60">
        <path
          d="M 5 55 A 45 45 0 0 1 95 55"
          fill="none"
          stroke="#1c2128"
          strokeWidth="8"
          strokeLinecap="round"
        />
        <path
          d="M 5 55 A 45 45 0 0 1 95 55"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          style={{
            transition: "stroke-dashoffset 0.6s ease, stroke 0.3s ease",
          }}
        />
        <text
          x="50"
          y="52"
          textAnchor="middle"
          fill={color}
          fontSize="14"
          fontFamily="JetBrains Mono"
          fontWeight="700"
        >
          {value != null ? `${value.toFixed(1)}${unit}` : "\u2014"}
        </text>
      </svg>
      <p className="text-xs text-[#8b949e] mt-1 tracking-widest">{label}</p>
    </div>
  );
}
