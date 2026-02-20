"""SocialEngine 추가 유닛 테스트"""

from app.engines.social import SocialEngine


class TestSimpleSentiment:
    def setup_method(self):
        self.engine = SocialEngine()

    def test_bullish_text(self):
        result = self.engine._simple_sentiment("buy the dip, moon soon, bullish calls")
        assert result > 0

    def test_bearish_text(self):
        result = self.engine._simple_sentiment("crash incoming, sell now, bearish puts")
        assert result < 0

    def test_neutral_text(self):
        result = self.engine._simple_sentiment("the weather is nice today")
        assert result == 0.0

    def test_mixed_text(self):
        result = self.engine._simple_sentiment("buy but also bearish puts")
        # bull=1 (buy), bear=2 (bearish, puts) → (1-2)/3 < 0
        assert isinstance(result, float)

    def test_case_insensitive(self):
        result_lower = self.engine._simple_sentiment("moon buy bullish")
        result_upper = self.engine._simple_sentiment("MOON BUY BULLISH")
        assert result_lower == result_upper


class TestMockReddit:
    def setup_method(self):
        self.engine = SocialEngine()

    def test_returns_dict(self):
        result = self.engine._mock_reddit("SPY")
        assert isinstance(result, dict)

    def test_has_required_fields(self):
        result = self.engine._mock_reddit("AAPL")
        assert "symbol" in result
        assert "mention_count" in result
        assert "sentiment" in result
        assert "source" in result
        assert "timestamp" in result

    def test_source_is_reddit_mock(self):
        result = self.engine._mock_reddit("TSLA")
        assert result["source"] == "reddit_mock"

    def test_mention_count_in_range(self):
        result = self.engine._mock_reddit("GME")
        assert 5 <= result["mention_count"] <= 150

    def test_sentiment_in_range(self):
        result = self.engine._mock_reddit("SPY")
        assert -0.5 <= result["sentiment"] <= 0.8


class TestMockTrends:
    def setup_method(self):
        self.engine = SocialEngine()

    def test_returns_dict(self):
        result = self.engine._mock_trends("Bitcoin")
        assert isinstance(result, dict)

    def test_has_required_fields(self):
        result = self.engine._mock_trends("NVDA")
        assert "keyword" in result
        assert "current_interest" in result
        assert "avg_interest" in result
        assert "trend_pct" in result
        assert "is_trending" in result
        assert "source" in result

    def test_source_is_trends_mock(self):
        result = self.engine._mock_trends("Tesla")
        assert result["source"] == "trends_mock"

    def test_is_trending_is_bool(self):
        result = self.engine._mock_trends("SPY")
        assert isinstance(result["is_trending"], bool)

    def test_current_interest_in_range(self):
        result = self.engine._mock_trends("AAPL")
        assert 20 <= result["current_interest"] <= 100


class TestFetchRedditMentions:
    def setup_method(self):
        self.engine = SocialEngine()

    def test_no_creds_returns_mock(self):
        result = self.engine.fetch_reddit_mentions("SPY", reddit_client_id="")
        assert result["source"] == "reddit_mock"

    def test_returns_valid_structure(self):
        result = self.engine.fetch_reddit_mentions("TSLA")
        assert "symbol" in result
        assert "mention_count" in result


class TestFetchGoogleTrends:
    def setup_method(self):
        self.engine = SocialEngine()

    def test_no_pytrends_returns_mock(self):
        result = self.engine.fetch_google_trends("Bitcoin")
        assert "source" in result
        # pytrends 없으면 mock 반환
        assert result["source"] in ("trends_mock", "google_trends")

    def test_returns_valid_structure(self):
        result = self.engine.fetch_google_trends("Tesla")
        assert "keyword" in result
        assert "trend_pct" in result


class TestGetVoxpopuliSignals:
    def setup_method(self):
        self.engine = SocialEngine()

    def test_returns_list(self):
        result = self.engine.get_voxpopuli_signals()
        assert isinstance(result, list)

    def test_default_symbols_covered(self):
        result = self.engine.get_voxpopuli_signals()
        assert len(result) == 6  # 기본 6개 심볼

    def test_custom_symbols(self):
        result = self.engine.get_voxpopuli_signals(["GME", "AMC"])
        assert len(result) == 2

    def test_sorted_by_zscore_descending(self):
        result = self.engine.get_voxpopuli_signals()
        for i in range(len(result) - 1):
            assert result[i]["zscore"] >= result[i + 1]["zscore"]

    def test_each_signal_has_extra_fields(self):
        result = self.engine.get_voxpopuli_signals(["GME"])
        assert len(result) == 1
        s = result[0]
        assert "reddit_mentions" in s
        assert "trends_interest" in s
        assert "trends_trending" in s
