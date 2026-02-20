"""market_data 엔진 유닛 테스트"""

import pandas as pd
import pytest

from app.engines.market_data import (
    PM_WATCHLISTS,
    MOCK_PRICES,
    get_price_history,
    get_current_price,
    get_prices_for_pm,
    get_market_context,
    _mock_price_history,
    _mock_current_price,
)


class TestMockPriceHistory:
    def test_returns_series(self):
        result = _mock_price_history("SPY", 30)
        assert isinstance(result, pd.Series)

    def test_correct_length(self):
        result = _mock_price_history("AAPL", 60)
        assert len(result) == 61  # days + 1 (초기값 포함)

    def test_all_prices_positive(self):
        result = _mock_price_history("NVDA", 20)
        assert (result > 0).all()

    def test_unknown_symbol_uses_default(self):
        result = _mock_price_history("UNKNOWN_XYZ", 10)
        assert isinstance(result, pd.Series)
        assert len(result) == 11

    def test_known_symbol_uses_mock_price(self):
        result = _mock_price_history("BTC-USD", 10)
        # BTC-USD base price is 65000, so values should be in reasonable range
        assert result.mean() > 10_000

    def test_deterministic_per_symbol(self):
        r1 = _mock_price_history("SPY", 30)
        r2 = _mock_price_history("SPY", 30)
        assert list(r1) == list(r2)

    def test_different_symbols_differ(self):
        r1 = _mock_price_history("SPY", 30)
        r2 = _mock_price_history("AAPL", 30)
        assert list(r1) != list(r2)


class TestMockCurrentPrice:
    def test_returns_float(self):
        result = _mock_current_price("SPY")
        assert isinstance(result, float)

    def test_within_2pct_of_base(self):
        base = MOCK_PRICES["SPY"]
        result = _mock_current_price("SPY")
        assert base * 0.98 <= result <= base * 1.02

    def test_unknown_symbol_uses_100_base(self):
        result = _mock_current_price("UNKNOWN_XYZ")
        assert 98.0 <= result <= 102.0


class TestGetPriceHistory:
    def test_returns_series_for_known_symbol(self):
        result = get_price_history("SPY", days=30)
        assert isinstance(result, pd.Series)
        assert len(result) >= 20

    def test_returns_series_for_unknown_symbol(self):
        result = get_price_history("FAKESTOCK", days=30)
        assert isinstance(result, pd.Series)

    def test_default_days_60(self):
        result = get_price_history("AAPL")
        assert len(result) >= 20


class TestGetCurrentPrice:
    def test_returns_float(self):
        price = get_current_price("SPY")
        assert isinstance(price, float)
        assert price > 0

    def test_returns_positive_for_all_mock_symbols(self):
        for symbol in list(MOCK_PRICES.keys())[:5]:
            price = get_current_price(symbol)
            assert price > 0


class TestGetPricesForPm:
    def test_returns_dict(self):
        result = get_prices_for_pm("atlas")
        assert isinstance(result, dict)

    def test_covers_watchlist_symbols(self):
        pm_id = "atlas"
        result = get_prices_for_pm(pm_id)
        for sym in PM_WATCHLISTS[pm_id]:
            assert sym in result

    def test_unknown_pm_returns_spy(self):
        result = get_prices_for_pm("nonexistent_pm")
        assert "SPY" in result

    def test_all_prices_positive(self):
        result = get_prices_for_pm("council")
        for price in result.values():
            assert price > 0


class TestGetMarketContext:
    def test_returns_dict(self):
        ctx = get_market_context()
        assert isinstance(ctx, dict)

    def test_has_required_fields(self):
        ctx = get_market_context()
        assert "spy_price" in ctx
        assert "vix" in ctx
        assert "market_regime" in ctx
        assert "timestamp" in ctx

    def test_regime_is_valid(self):
        ctx = get_market_context()
        assert ctx["market_regime"] in ("risk_on", "neutral", "risk_off")

    def test_vix_positive(self):
        ctx = get_market_context()
        assert ctx["vix"] > 0


class TestPmWatchlists:
    def test_all_11_pms_defined(self):
        assert len(PM_WATCHLISTS) == 11

    def test_each_pm_has_symbols(self):
        for pm_id, symbols in PM_WATCHLISTS.items():
            assert len(symbols) > 0, f"{pm_id} has no symbols"
