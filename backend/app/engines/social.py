import numpy as np
from dataclasses import dataclass


@dataclass
class SocialSignal:
    symbol: str
    is_tipping_point: bool
    zscore: float
    direction: str  # bullish / bearish / neutral
    conviction: float
    sources: list[str]


class SocialEngine:
    TIPPING_THRESHOLD = 3.0

    def calculate_zscore(self, history: list[float]) -> float:
        if len(history) < 3:
            return 0.0
        arr = np.array(history)
        mean = arr[:-1].mean()
        std = arr[:-1].std()
        if std == 0:
            return 0.0
        return float((arr[-1] - mean) / std)

    def evaluate_tipping_point(
        self,
        symbol: str,
        mention_history: list[float],
        sentiment: float,  # -1.0 ~ 1.0
        sources: list[str] | None = None,
    ) -> dict:
        zscore = self.calculate_zscore(mention_history)
        is_tipping = zscore >= self.TIPPING_THRESHOLD

        if sentiment > 0.3:
            direction = "bullish"
        elif sentiment < -0.3:
            direction = "bearish"
        else:
            direction = "neutral"

        conviction = (
            min(1.0, zscore / 5.0) * abs(sentiment) if is_tipping else 0.0
        )

        return {
            "symbol": symbol,
            "is_tipping_point": is_tipping,
            "zscore": round(zscore, 2),
            "direction": direction,
            "conviction": round(conviction, 3),
            "sources": sources or [],
        }
