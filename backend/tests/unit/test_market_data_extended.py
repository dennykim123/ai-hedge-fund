"""market_data - yfinance 경로 커버 (mock 활용)"""

import pandas as pd
import pytest
from unittest.mock import MagicMock, patch


class TestGetPriceHistoryYfinancePath:
    def test_yfinance_available_returns_history(self):
        mock_hist = MagicMock()
        mock_hist.empty = False
        mock_hist.__getitem__ = MagicMock(return_value=pd.Series([100.0, 101.0, 102.0]))

        mock_ticker = MagicMock()
        mock_ticker.history.return_value = mock_hist

        with patch("app.engines.market_data.YFINANCE_AVAILABLE", True), \
             patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.return_value = mock_ticker
            from app.engines.market_data import get_price_history
            result = get_price_history("SPY", days=30)
            assert result is not None

    def test_yfinance_empty_falls_back_to_mock(self):
        mock_hist = MagicMock()
        mock_hist.empty = True

        mock_ticker = MagicMock()
        mock_ticker.history.return_value = mock_hist

        with patch("app.engines.market_data.YFINANCE_AVAILABLE", True), \
             patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.return_value = mock_ticker
            from app.engines.market_data import get_price_history
            result = get_price_history("SPY", days=30)
            assert isinstance(result, pd.Series)

    def test_yfinance_exception_falls_back_to_mock(self):
        with patch("app.engines.market_data.YFINANCE_AVAILABLE", True), \
             patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.side_effect = OSError("Network error")
            from app.engines.market_data import get_price_history
            result = get_price_history("SPY", days=30)
            assert isinstance(result, pd.Series)


class TestGetCurrentPriceYfinancePath:
    def test_yfinance_returns_valid_price(self):
        mock_info = MagicMock()
        mock_info.last_price = 485.0

        mock_ticker = MagicMock()
        mock_ticker.fast_info = mock_info

        with patch("app.engines.market_data.YFINANCE_AVAILABLE", True), \
             patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.return_value = mock_ticker
            from app.engines.market_data import get_current_price
            result = get_current_price("SPY")
            assert result == 485.0

    def test_yfinance_zero_price_falls_back(self):
        mock_info = MagicMock()
        mock_info.last_price = 0

        mock_ticker = MagicMock()
        mock_ticker.fast_info = mock_info

        with patch("app.engines.market_data.YFINANCE_AVAILABLE", True), \
             patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.return_value = mock_ticker
            from app.engines.market_data import get_current_price
            result = get_current_price("SPY")
            assert result > 0  # mock fallback

    def test_yfinance_none_price_falls_back(self):
        mock_info = MagicMock()
        mock_info.last_price = None

        mock_ticker = MagicMock()
        mock_ticker.fast_info = mock_info

        with patch("app.engines.market_data.YFINANCE_AVAILABLE", True), \
             patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.return_value = mock_ticker
            from app.engines.market_data import get_current_price
            result = get_current_price("SPY")
            assert result > 0

    def test_yfinance_exception_falls_back(self):
        with patch("app.engines.market_data.YFINANCE_AVAILABLE", True), \
             patch("app.engines.market_data.yf") as mock_yf:
            mock_yf.Ticker.side_effect = OSError("API error")
            from app.engines.market_data import get_current_price
            result = get_current_price("SPY")
            assert result > 0
