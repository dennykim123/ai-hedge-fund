"use client";

import {
  XAxis,
  YAxis,
  Tooltip,
  ReferenceLine,
  ResponsiveContainer,
  Area,
  AreaChart,
} from "recharts";
import { useI18n } from "@/lib/i18n";

interface DataPoint {
  date: string;
  nav: number;
  return_pct: number;
}

export function NAVSparkline({ data }: { data: DataPoint[] }) {
  const { t } = useI18n();
  const isPositive = data.length > 1 && data[data.length - 1].return_pct >= 0;
  const color = isPositive ? "#00d4aa" : "#ff6b6b";

  return (
    <div className="glass-card p-5">
      <p className="text-xs text-[#8b949e] tracking-widest mb-4">
        {t("ov.nav_history")}
      </p>
      {data.length < 2 ? (
        <div className="h-32 flex items-center justify-center text-[#8b949e] text-sm">
          {t("ov.data_collecting")}
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={120}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="navGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={color} stopOpacity={0.3} />
                <stop offset="95%" stopColor={color} stopOpacity={0.0} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="date"
              tick={{ fill: "#8b949e", fontSize: 10 }}
              axisLine={false}
              tickLine={false}
            />
            <YAxis hide domain={["auto", "auto"]} />
            <Tooltip
              contentStyle={{
                background: "#1c2128",
                border: "1px solid #30363d",
                borderRadius: 8,
              }}
              labelStyle={{ color: "#8b949e", fontSize: 11 }}
              formatter={(v: number | undefined) => [
                `$${(v ?? 0).toLocaleString()}`,
                "NAV",
              ]}
            />
            <ReferenceLine
              y={data[0]?.nav}
              stroke="#30363d"
              strokeDasharray="3 3"
            />
            <Area
              type="monotone"
              dataKey="nav"
              stroke={color}
              strokeWidth={2}
              fill="url(#navGradient)"
              dot={false}
            />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </div>
  );
}
