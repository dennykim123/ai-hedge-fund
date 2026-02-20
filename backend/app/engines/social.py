"""
소셜 시그널 엔진: Reddit PRAW, NewsAPI, Google Trends 기반 티핑포인트 감지
"""

import numpy as np
import random
from dataclasses import dataclass
from datetime import datetime

# 선택적 의존성
try:
    import praw
    PRAW_AVAILABLE = True
except ImportError:
    PRAW_AVAILABLE = False

try:
    from pytrends.request import TrendReq
    PYTRENDS_AVAILABLE = True
except ImportError:
    PYTRENDS_AVAILABLE = False


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
    BULLISH_KEYWORDS = ["moon", "buy", "long", "bullish", "squeeze", "gamma", "yolo", "calls"]
    BEARISH_KEYWORDS = ["crash", "sell", "short", "bearish", "puts", "dump", "bubble", "overvalued"]

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

    def _simple_sentiment(self, text: str) -> float:
        """단순 키워드 기반 감성 분석"""
        text_lower = text.lower()
        bull_score = sum(1 for w in self.BULLISH_KEYWORDS if w in text_lower)
        bear_score = sum(1 for w in self.BEARISH_KEYWORDS if w in text_lower)
        total = bull_score + bear_score
        if total == 0:
            return 0.0
        return (bull_score - bear_score) / total

    def fetch_reddit_mentions(
        self,
        symbol: str,
        subreddits: list[str] | None = None,
        limit: int = 100,
        reddit_client_id: str = "",
        reddit_secret: str = "",
    ) -> dict:
        """Reddit에서 특정 심볼 언급 수와 감성 분석"""
        if not PRAW_AVAILABLE or not reddit_client_id:
            return self._mock_reddit(symbol)

        try:
            reddit = praw.Reddit(
                client_id=reddit_client_id,
                client_secret=reddit_secret,
                user_agent="AI-HedgeFund/1.0",
            )
            subs = subreddits or ["wallstreetbets", "investing", "stocks"]
            mention_count = 0
            sentiment_sum = 0.0

            for sub_name in subs:
                subreddit = reddit.subreddit(sub_name)
                for post in subreddit.hot(limit=limit):
                    text = f"{post.title} {post.selftext}"
                    if symbol.upper() in text.upper() or f"${symbol.upper()}" in text.upper():
                        mention_count += 1
                        sentiment_sum += self._simple_sentiment(text)

            avg_sentiment = sentiment_sum / mention_count if mention_count > 0 else 0.0
            return {
                "symbol": symbol,
                "mention_count": mention_count,
                "sentiment": round(avg_sentiment, 3),
                "source": "reddit",
                "subreddits": subs,
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            return {**self._mock_reddit(symbol), "error": str(e)}

    def _mock_reddit(self, symbol: str) -> dict:
        """Reddit API 없을 때 Mock 데이터"""
        random.seed(hash(symbol + datetime.now().strftime("%H")))
        count = random.randint(5, 150)
        sentiment = random.uniform(-0.5, 0.8)
        return {
            "symbol": symbol,
            "mention_count": count,
            "sentiment": round(sentiment, 3),
            "source": "reddit_mock",
            "subreddits": ["wallstreetbets", "investing"],
            "timestamp": datetime.now().isoformat(),
        }

    def fetch_google_trends(self, keyword: str, timeframe: str = "now 7-d") -> dict:
        """Google Trends 검색량 데이터"""
        if not PYTRENDS_AVAILABLE:
            return self._mock_trends(keyword)

        try:
            pytrends = TrendReq(hl="en-US", tz=360)
            pytrends.build_payload([keyword], cat=0, timeframe=timeframe, geo="US")
            data = pytrends.interest_over_time()
            if data.empty:
                return self._mock_trends(keyword)

            values = data[keyword].tolist()
            current = values[-1] if values else 50
            avg_prev = np.mean(values[:-1]) if len(values) > 1 else current
            trend = (current - avg_prev) / max(avg_prev, 1) * 100

            return {
                "keyword": keyword,
                "current_interest": int(current),
                "avg_interest": round(float(avg_prev), 1),
                "trend_pct": round(trend, 2),
                "is_trending": trend > 50,
                "source": "google_trends",
                "timestamp": datetime.now().isoformat(),
            }
        except Exception as e:
            return {**self._mock_trends(keyword), "error": str(e)}

    def _mock_trends(self, keyword: str) -> dict:
        """Google Trends 없을 때 Mock 데이터"""
        random.seed(hash(keyword + datetime.now().strftime("%H")))
        current = random.randint(20, 100)
        avg_prev = random.uniform(30, 70)
        trend = (current - avg_prev) / max(avg_prev, 1) * 100
        return {
            "keyword": keyword,
            "current_interest": current,
            "avg_interest": round(avg_prev, 1),
            "trend_pct": round(trend, 2),
            "is_trending": trend > 50,
            "source": "trends_mock",
            "timestamp": datetime.now().isoformat(),
        }

    def get_voxpopuli_signals(self, symbols: list[str] | None = None) -> list[dict]:
        """Vox Populi PM을 위한 소셜 시그널 종합"""
        target_symbols = symbols or ["GME", "AMC", "TSLA", "NVDA", "SPY", "BTC-USD"]
        results = []

        for symbol in target_symbols:
            # Reddit 멘션 수집 (mock 포함)
            reddit_data = self._mock_reddit(symbol)

            # Google Trends (mock 포함)
            trends_data = self._mock_trends(symbol)

            # 히스토리 시뮬레이션 (실제는 DB에서 가져와야 함)
            base = reddit_data["mention_count"]
            history = [base * random.uniform(0.5, 1.5) for _ in range(6)] + [base]

            signal = self.evaluate_tipping_point(
                symbol=symbol,
                mention_history=history,
                sentiment=reddit_data["sentiment"],
                sources=["reddit", "google_trends"],
            )

            signal["reddit_mentions"] = reddit_data["mention_count"]
            signal["trends_interest"] = trends_data["current_interest"]
            signal["trends_trending"] = trends_data["is_trending"]
            results.append(signal)

        # 티핑포인트 감지된 것 우선 정렬
        results.sort(key=lambda x: x["zscore"], reverse=True)
        return results
