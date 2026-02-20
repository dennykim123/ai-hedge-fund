import numpy as np
import pandas as pd
from dataclasses import dataclass


@dataclass
class SignalResult:
    symbol: str
    rsi: float
    momentum: float
    volatility: float
    composite_score: float  # -1.0 (strong sell) ~ +1.0 (strong buy)
    signals: dict


class QuantEngine:
    def calculate_rsi(self, prices: pd.Series, period: int = 14) -> float:
        delta = prices.diff()
        gain = delta.clip(lower=0).rolling(period).mean()
        loss = (-delta.clip(upper=0)).rolling(period).mean()
        last_gain = gain.iloc[-1]
        last_loss = loss.iloc[-1]
        if last_loss == 0:
            return 100.0 if last_gain > 0 else 50.0
        rs = last_gain / last_loss
        return float(100 - (100 / (1 + rs)))

    def calculate_momentum_score(self, prices: pd.Series, lookback: int = 252) -> float:
        max_lookback = len(prices) - 1
        lookback = min(lookback, max_lookback)
        if lookback <= 0:
            return 0.0
        start_price = prices.iloc[-lookback - 1]
        end_price = prices.iloc[-1]
        if start_price == 0:
            return 0.0
        return float((end_price - start_price) / start_price)

    def calculate_volatility(self, prices: pd.Series, period: int = 20) -> float:
        returns = prices.pct_change().dropna()
        if len(returns) < period:
            return float(returns.std() * np.sqrt(252))
        return float(returns.iloc[-period:].std() * np.sqrt(252))

    def _rsi_to_signal(self, rsi: float) -> float:
        if rsi < 30:
            return 0.8
        if rsi < 40:
            return 0.4
        if rsi > 70:
            return -0.8
        if rsi > 60:
            return -0.4
        return 0.0

    def _momentum_to_signal(self, momentum: float) -> float:
        return float(np.clip(momentum * 10, -1.0, 1.0))

    def generate_signals(self, prices: pd.Series, symbol: str) -> dict:
        rsi = self.calculate_rsi(prices)
        momentum = self.calculate_momentum_score(prices)
        volatility = self.calculate_volatility(prices)

        rsi_signal = self._rsi_to_signal(rsi)
        momentum_signal = self._momentum_to_signal(momentum)

        composite = rsi_signal * 0.4 + momentum_signal * 0.6

        return {
            "symbol": symbol,
            "rsi": round(rsi, 2),
            "momentum": round(momentum, 4),
            "volatility": round(volatility, 4),
            "composite_score": round(float(np.clip(composite, -1.0, 1.0)), 3),
            "rsi_signal": round(rsi_signal, 3),
            "momentum_signal": round(momentum_signal, 3),
        }
