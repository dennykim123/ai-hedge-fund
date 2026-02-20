import numpy as np
from dataclasses import dataclass

RISK_FREE_RATE = 0.05  # 5% annual (current US rate)
TRADING_DAYS = 252


@dataclass
class PerformanceMetrics:
    sharpe: float
    sortino: float
    mdd: float
    alpha: float
    beta: float
    calmar: float
    annualized_return: float
    annualized_volatility: float


class PerformanceEngine:
    def sharpe_ratio(
        self, daily_returns: list[float], risk_free: float = RISK_FREE_RATE
    ) -> float:
        r = np.array(daily_returns)
        excess = r - risk_free / TRADING_DAYS
        if r.std() == 0:
            return 0.0
        return float(excess.mean() / r.std() * np.sqrt(TRADING_DAYS))

    def sortino_ratio(
        self, daily_returns: list[float], risk_free: float = RISK_FREE_RATE
    ) -> float:
        r = np.array(daily_returns)
        excess = r.mean() - risk_free / TRADING_DAYS
        downside = r[r < 0].std() if len(r[r < 0]) > 0 else 1e-10
        return float(excess / downside * np.sqrt(TRADING_DAYS))

    def max_drawdown(self, daily_returns: list[float]) -> float:
        r = np.array(daily_returns)
        cumulative = np.cumprod(1 + r)
        rolling_max = np.maximum.accumulate(cumulative)
        drawdowns = (cumulative - rolling_max) / rolling_max
        return float(drawdowns.min())

    def beta(self, fund_returns: list[float], bench_returns: list[float]) -> float:
        f = np.array(fund_returns)
        b = np.array(bench_returns)
        n = min(len(f), len(b))
        cov = np.cov(f[:n], b[:n])
        bench_var = np.var(b[:n])
        return float(cov[0, 1] / bench_var) if bench_var > 0 else 1.0

    def alpha(
        self,
        fund_returns: list[float],
        bench_returns: list[float],
        risk_free: float = RISK_FREE_RATE,
    ) -> float:
        ann_fund = np.mean(fund_returns) * TRADING_DAYS
        ann_bench = np.mean(bench_returns) * TRADING_DAYS
        b = self.beta(fund_returns, bench_returns)
        return float(ann_fund - (risk_free + b * (ann_bench - risk_free)))

    def calmar_ratio(self, daily_returns: list[float]) -> float:
        ann_return = np.mean(daily_returns) * TRADING_DAYS
        mdd = self.max_drawdown(daily_returns)
        return float(ann_return / abs(mdd)) if mdd != 0 else 0.0

    def compute_all(
        self, fund_returns: list[float], bench_returns: list[float]
    ) -> dict:
        return {
            "sharpe": round(self.sharpe_ratio(fund_returns), 3),
            "sortino": round(self.sortino_ratio(fund_returns), 3),
            "mdd": round(self.max_drawdown(fund_returns), 4),
            "alpha": round(self.alpha(fund_returns, bench_returns), 4),
            "beta": round(self.beta(fund_returns, bench_returns), 3),
            "calmar": round(self.calmar_ratio(fund_returns), 3),
            "annualized_return": round(
                float(np.mean(fund_returns)) * TRADING_DAYS, 4
            ),
            "annualized_volatility": round(
                float(np.std(fund_returns)) * np.sqrt(TRADING_DAYS), 4
            ),
        }
