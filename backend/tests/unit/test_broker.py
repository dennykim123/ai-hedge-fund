import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.engines.broker import TradingMode, AlpacaAdapter, get_broker


def test_paper_mode_uses_paper_url():
    broker = get_broker(TradingMode.PAPER)
    assert "paper-api" in broker.base_url


def test_live_mode_uses_live_url():
    broker = get_broker(TradingMode.LIVE)
    assert "paper-api" not in broker.base_url


def test_default_is_paper_mode():
    broker = get_broker()
    assert "paper-api" in broker.base_url


def test_alpaca_stores_credentials():
    adapter = AlpacaAdapter("key123", "secret456", "https://paper-api.alpaca.markets")
    assert adapter.api_key == "key123"
    assert adapter.secret_key == "secret456"


@pytest.mark.asyncio
async def test_place_order_calls_api():
    adapter = AlpacaAdapter("key", "secret", "https://paper-api.alpaca.markets")
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"id": "order123"}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_http.post = AsyncMock(return_value=mock_resp)

        result = await adapter.place_order("SPY", 10.0, "buy")
        assert result["id"] == "order123"
        url = mock_http.post.call_args[0][0]
        assert "/v2/orders" in url


@pytest.mark.asyncio
async def test_get_positions_calls_api():
    adapter = AlpacaAdapter("key", "secret", "https://paper-api.alpaca.markets")
    mock_resp = MagicMock()
    mock_resp.json.return_value = [{"symbol": "SPY"}]
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_http.get = AsyncMock(return_value=mock_resp)

        result = await adapter.get_positions()
        assert result[0]["symbol"] == "SPY"
        url = mock_http.get.call_args[0][0]
        assert "/v2/positions" in url


@pytest.mark.asyncio
async def test_get_account_calls_api():
    adapter = AlpacaAdapter("key", "secret", "https://paper-api.alpaca.markets")
    mock_resp = MagicMock()
    mock_resp.json.return_value = {"cash": "100000"}
    mock_resp.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_cls:
        mock_http = AsyncMock()
        mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
        mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
        mock_http.get = AsyncMock(return_value=mock_resp)

        result = await adapter.get_account()
        assert result["cash"] == "100000"
        url = mock_http.get.call_args[0][0]
        assert "/v2/account" in url
