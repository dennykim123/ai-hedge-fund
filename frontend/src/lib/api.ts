const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000";

export interface FundStats {
  nav: number;
  today_return: number;
  prior_day_return: number;
  itd_return: number;
  active_pms: number;
  total_positions: number;
}

export interface PMSummary {
  id: string;
  name: string;
  emoji: string;
  strategy: string;
  llm_provider: string;
  current_capital: number;
  itd_return: number;
}

export async function getFundStats(): Promise<FundStats> {
  const res = await fetch(`${BASE_URL}/api/fund/stats`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch fund stats");
  return res.json();
}

export async function getPMs(): Promise<PMSummary[]> {
  const res = await fetch(`${BASE_URL}/api/fund/pms`, { cache: "no-store" });
  if (!res.ok) throw new Error("Failed to fetch PMs");
  return res.json();
}
