"""SocialEngine - praw/pytrends 실제 경로 mock 테스트"""

import sys
import pytest
from unittest.mock import MagicMock, patch


def _make_mock_praw(mock_reddit_instance):
    """praw 모듈 mock 생성"""
    mock_praw = MagicMock()
    mock_praw.Reddit.return_value = mock_reddit_instance
    return mock_praw


class TestFetchRedditMentionsWithPraw:
    def _engine_with_praw(self, mock_reddit):
        mock_praw = _make_mock_praw(mock_reddit)
        sys.modules["praw"] = mock_praw
        # 모듈 재로드 대신 엔진에 직접 패치
        import app.engines.social as social_mod
        old_flag = social_mod.PRAW_AVAILABLE
        old_praw = getattr(social_mod, "praw", None)
        social_mod.PRAW_AVAILABLE = True
        social_mod.praw = mock_praw
        engine = social_mod.SocialEngine()
        return engine, social_mod, old_flag, old_praw

    def _restore(self, social_mod, old_flag, old_praw):
        social_mod.PRAW_AVAILABLE = old_flag
        if old_praw is not None:
            social_mod.praw = old_praw

    def test_praw_calls_reddit_api(self):
        mock_post = MagicMock()
        mock_post.title = "GME to the moon! buy buy buy"
        mock_post.selftext = "bullish calls"
        mock_subreddit = MagicMock()
        mock_subreddit.hot.return_value = [mock_post]
        mock_reddit = MagicMock()
        mock_reddit.subreddit.return_value = mock_subreddit

        engine, social_mod, old_flag, old_praw = self._engine_with_praw(mock_reddit)
        try:
            result = engine.fetch_reddit_mentions(
                "GME",
                reddit_client_id="test_id",
                reddit_secret="test_secret",
            )
            assert "mention_count" in result
            assert "sentiment" in result
            assert result["source"] == "reddit"
        finally:
            self._restore(social_mod, old_flag, old_praw)

    def test_praw_exception_returns_mock_with_error(self):
        mock_reddit = MagicMock()
        mock_praw = MagicMock()
        mock_praw.Reddit.side_effect = Exception("Auth error")

        import app.engines.social as social_mod
        old_flag = social_mod.PRAW_AVAILABLE
        old_praw = getattr(social_mod, "praw", None)
        social_mod.PRAW_AVAILABLE = True
        social_mod.praw = mock_praw
        engine = social_mod.SocialEngine()

        try:
            result = engine.fetch_reddit_mentions(
                "SPY",
                reddit_client_id="test_id",
                reddit_secret="test_secret",
            )
            assert "mention_count" in result
            assert "error" in result
        finally:
            self._restore(social_mod, old_flag, old_praw)

    def test_praw_no_symbol_match_returns_zero(self):
        mock_post = MagicMock()
        mock_post.title = "totally unrelated content"
        mock_post.selftext = ""
        mock_subreddit = MagicMock()
        mock_subreddit.hot.return_value = [mock_post]
        mock_reddit = MagicMock()
        mock_reddit.subreddit.return_value = mock_subreddit

        engine, social_mod, old_flag, old_praw = self._engine_with_praw(mock_reddit)
        try:
            result = engine.fetch_reddit_mentions(
                "XYZNOTFOUND",
                reddit_client_id="id",
                reddit_secret="secret",
            )
            assert result["mention_count"] == 0
            assert result["sentiment"] == 0.0
        finally:
            self._restore(social_mod, old_flag, old_praw)

    def test_praw_custom_subreddits(self):
        mock_subreddit = MagicMock()
        mock_subreddit.hot.return_value = []
        mock_reddit = MagicMock()
        mock_reddit.subreddit.return_value = mock_subreddit

        engine, social_mod, old_flag, old_praw = self._engine_with_praw(mock_reddit)
        try:
            result = engine.fetch_reddit_mentions(
                "SPY",
                subreddits=["stocks"],
                reddit_client_id="id",
                reddit_secret="secret",
            )
            assert result["subreddits"] == ["stocks"]
        finally:
            self._restore(social_mod, old_flag, old_praw)


class TestFetchGoogleTrendsWithPytrends:
    def _engine_with_pytrends(self, mock_instance):
        mock_trend_cls = MagicMock(return_value=mock_instance)
        mock_pytrends_mod = MagicMock()
        mock_pytrends_mod.request.TrendReq = mock_trend_cls

        import app.engines.social as social_mod
        old_flag = social_mod.PYTRENDS_AVAILABLE
        old_trendreq = getattr(social_mod, "TrendReq", None)
        social_mod.PYTRENDS_AVAILABLE = True
        social_mod.TrendReq = mock_trend_cls
        engine = social_mod.SocialEngine()
        return engine, social_mod, old_flag, old_trendreq

    def _restore(self, social_mod, old_flag, old_trendreq):
        social_mod.PYTRENDS_AVAILABLE = old_flag
        if old_trendreq is not None:
            social_mod.TrendReq = old_trendreq
        elif hasattr(social_mod, "TrendReq"):
            del social_mod.TrendReq

    def test_pytrends_returns_data(self):
        import pandas as pd
        mock_data = pd.DataFrame({"Bitcoin": [40, 50, 60, 70, 80]})
        mock_instance = MagicMock()
        mock_instance.interest_over_time.return_value = mock_data

        engine, social_mod, old_flag, old_trendreq = self._engine_with_pytrends(mock_instance)
        try:
            result = engine.fetch_google_trends("Bitcoin")
            assert result["source"] == "google_trends"
            assert result["current_interest"] == 80
            assert "trend_pct" in result
        finally:
            self._restore(social_mod, old_flag, old_trendreq)

    def test_pytrends_empty_falls_back(self):
        import pandas as pd
        mock_data = pd.DataFrame()
        mock_instance = MagicMock()
        mock_instance.interest_over_time.return_value = mock_data

        engine, social_mod, old_flag, old_trendreq = self._engine_with_pytrends(mock_instance)
        try:
            result = engine.fetch_google_trends("Tesla")
            assert "source" in result
        finally:
            self._restore(social_mod, old_flag, old_trendreq)

    def test_pytrends_exception_returns_error(self):
        mock_instance = MagicMock()
        mock_instance.interest_over_time.side_effect = Exception("Rate limit")

        engine, social_mod, old_flag, old_trendreq = self._engine_with_pytrends(mock_instance)
        try:
            result = engine.fetch_google_trends("NVDA")
            assert "error" in result
        finally:
            self._restore(social_mod, old_flag, old_trendreq)

    def test_pytrends_trending_logic(self):
        import pandas as pd
        mock_data = pd.DataFrame({"Tesla": [20, 20, 20, 20, 100]})
        mock_instance = MagicMock()
        mock_instance.interest_over_time.return_value = mock_data

        engine, social_mod, old_flag, old_trendreq = self._engine_with_pytrends(mock_instance)
        try:
            result = engine.fetch_google_trends("Tesla")
            assert result["is_trending"] == True  # noqa: E712 (numpy bool 호환)
        finally:
            self._restore(social_mod, old_flag, old_trendreq)
