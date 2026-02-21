import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.engines.broker import (
    TradingMode, AlpacaAdapter, KISAdapter, BybitAdapter,
    PaperAdapter, get_broker, get_broker_for_pm,
)


# ── PaperAdapter ─────────────────────────────────────────────────────────────

class TestPaperAdapter:
    @pytest.mark.asyncio
    async def test_place_order_returns_filled(self):
        adapter = PaperAdapter()
        result = await adapter.place_order("SPY", 10.0, "BUY")
        assert result["status"] == "filled"
        assert result["broker"] == "paper"
        assert result["filled_qty"] == 10.0

    @pytest.mark.asyncio
    async def test_place_order_sell(self):
        adapter = PaperAdapter()
        result = await adapter.place_order("BTC-USD", 0.1, "SELL")
        assert result["status"] == "filled"

    @pytest.mark.asyncio
    async def test_get_positions_empty(self):
        adapter = PaperAdapter()
        assert await adapter.get_positions() == []

    @pytest.mark.asyncio
    async def test_get_account(self):
        adapter = PaperAdapter()
        account = await adapter.get_account()
        assert account["broker"] == "paper"

    def test_is_live_false(self):
        assert PaperAdapter().is_live() is False


# ── AlpacaAdapter ────────────────────────────────────────────────────────────

class TestAlpacaAdapter:
    def test_stores_credentials(self):
        adapter = AlpacaAdapter("key123", "secret456", "https://paper-api.alpaca.markets")
        assert adapter.api_key == "key123"
        assert adapter.secret_key == "secret456"

    def test_is_live_paper(self):
        adapter = AlpacaAdapter("k", "s", "https://paper-api.alpaca.markets")
        assert adapter.is_live() is False

    def test_is_live_live(self):
        adapter = AlpacaAdapter("k", "s", "https://api.alpaca.markets")
        assert adapter.is_live() is True

    @pytest.mark.asyncio
    async def test_place_order_calls_api(self):
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
    async def test_get_positions_calls_api(self):
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

    @pytest.mark.asyncio
    async def test_get_account_calls_api(self):
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


# ── KISAdapter ───────────────────────────────────────────────────────────────

class TestKISAdapter:
    def _adapter(self, mock=True):
        return KISAdapter("appkey", "appsecret", "50123456-01", mock=mock)

    def test_mock_uses_mock_url(self):
        adapter = self._adapter(mock=True)
        assert "openapivts" in adapter._base_url

    def test_live_uses_live_url(self):
        adapter = self._adapter(mock=False)
        assert "openapivts" not in adapter._base_url
        assert "openapi.koreainvestment" in adapter._base_url

    def test_is_live_mock(self):
        assert self._adapter(mock=True).is_live() is False

    def test_is_live_live(self):
        assert self._adapter(mock=False).is_live() is True

    def test_symbol_map_contains_common_stocks(self):
        assert "SPY" in KISAdapter.SYMBOL_MAP
        assert "AAPL" in KISAdapter.SYMBOL_MAP
        assert "NVDA" in KISAdapter.SYMBOL_MAP

    @pytest.mark.asyncio
    async def test_place_order_buy_success(self):
        adapter = self._adapter()
        adapter._access_token = "fake_token"

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "rt_cd": "0",
            "msg1": "주문완료",
            "output": {"ODNO": "0000123456"},
        }
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.post = AsyncMock(return_value=mock_resp)

            result = await adapter.place_order("SPY", 5.0, "BUY")
            assert result["status"] == "filled"
            assert result["broker"] == "kis"
            assert result["order_id"] == "0000123456"

    @pytest.mark.asyncio
    async def test_place_order_rejected(self):
        adapter = self._adapter()
        adapter._access_token = "fake_token"

        mock_resp = MagicMock()
        mock_resp.json.return_value = {"rt_cd": "1", "msg1": "잔고부족"}
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.post = AsyncMock(return_value=mock_resp)

            result = await adapter.place_order("SPY", 5.0, "BUY")
            assert result["status"] == "rejected"
            assert "잔고부족" in result["reason"]

    @pytest.mark.asyncio
    async def test_get_token_caches(self):
        adapter = self._adapter()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"access_token": "tok123"}
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.post = AsyncMock(return_value=mock_resp)

            token1 = await adapter._get_token()
            token2 = await adapter._get_token()  # 캐시에서

        assert token1 == token2 == "tok123"
        assert mock_http.post.call_count == 1  # 한 번만 호출

    @pytest.mark.asyncio
    async def test_get_positions(self):
        adapter = self._adapter()
        adapter._access_token = "fake_token"

        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "output1": [
                {"PDNO": "AAPL", "OVRS_CBLC_QTY": "10", "PCHS_AVG_PRIC": "175.0", "EVLU_AMT": "1800"},
            ],
            "output2": {},
        }
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.get = AsyncMock(return_value=mock_resp)

            positions = await adapter.get_positions()
            assert len(positions) == 1
            assert positions[0]["symbol"] == "AAPL"
            assert positions[0]["qty"] == 10.0


# ── BybitAdapter ─────────────────────────────────────────────────────────────

class TestBybitAdapter:
    def _adapter(self, testnet=True):
        return BybitAdapter("api_key", "api_secret", testnet=testnet)

    def test_testnet_uses_testnet_url(self):
        adapter = self._adapter(testnet=True)
        assert "testnet" in adapter._base_url

    def test_live_uses_live_url(self):
        adapter = self._adapter(testnet=False)
        assert "testnet" not in adapter._base_url

    def test_is_live_testnet(self):
        assert self._adapter(testnet=True).is_live() is False

    def test_is_live_live(self):
        assert self._adapter(testnet=False).is_live() is True

    def test_symbol_map_btc(self):
        assert BybitAdapter.SYMBOL_MAP["BTC-USD"] == "BTCUSDT"
        assert BybitAdapter.SYMBOL_MAP["ETH-USD"] == "ETHUSDT"
        assert BybitAdapter.SYMBOL_MAP["SOL-USD"] == "SOLUSDT"

    def test_sign_deterministic(self):
        adapter = self._adapter()
        sig1 = adapter._sign("params=test", "1700000000000")
        sig2 = adapter._sign("params=test", "1700000000000")
        assert sig1 == sig2

    @pytest.mark.asyncio
    async def test_place_order_success(self):
        adapter = self._adapter()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {
            "retCode": 0,
            "result": {"orderId": "bybit-order-123"},
        }
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.post = AsyncMock(return_value=mock_resp)

            result = await adapter.place_order("BTC-USD", 0.001, "BUY")
            assert result["status"] == "filled"
            assert result["broker"] == "bybit"
            assert result["order_id"] == "bybit-order-123"

    @pytest.mark.asyncio
    async def test_place_order_rejected(self):
        adapter = self._adapter()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"retCode": 10001, "retMsg": "insufficient balance"}
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.post = AsyncMock(return_value=mock_resp)

            result = await adapter.place_order("ETH-USD", 1.0, "BUY")
            assert result["status"] == "rejected"
            assert "insufficient" in result["reason"]

    @pytest.mark.asyncio
    async def test_place_order_uses_symbol_map(self):
        adapter = self._adapter()
        mock_resp = MagicMock()
        mock_resp.json.return_value = {"retCode": 0, "result": {"orderId": "x"}}
        mock_resp.raise_for_status = MagicMock()

        with patch("httpx.AsyncClient") as mock_cls:
            mock_http = AsyncMock()
            mock_cls.return_value.__aenter__ = AsyncMock(return_value=mock_http)
            mock_cls.return_value.__aexit__ = AsyncMock(return_value=False)
            mock_http.post = AsyncMock(return_value=mock_resp)

            await adapter.place_order("SOL-USD", 1.0, "BUY")
            call_kwargs = mock_http.post.call_args
            import json
            body = json.loads(call_kwargs.kwargs.get("content", "{}"))
            assert body["symbol"] == "SOLUSDT"


# ── 팩토리 ───────────────────────────────────────────────────────────────────

class TestGetBrokerForPm:
    def test_no_keys_returns_paper(self):
        with patch("app.engines.broker.settings") as mock_settings:
            mock_settings.kis_app_key = ""
            mock_settings.bybit_api_key = ""
            mock_settings.alpaca_api_key = ""
            assert isinstance(get_broker_for_pm("kis"), PaperAdapter)
            assert isinstance(get_broker_for_pm("bybit"), PaperAdapter)
            assert isinstance(get_broker_for_pm("paper"), PaperAdapter)

    def test_kis_with_keys_returns_kis(self):
        with patch("app.engines.broker.settings") as mock_settings:
            mock_settings.kis_app_key = "key"
            mock_settings.kis_app_secret = "secret"
            mock_settings.kis_account_no = "12345678-01"
            mock_settings.kis_mock = True
            assert isinstance(get_broker_for_pm("kis"), KISAdapter)

    def test_bybit_with_keys_returns_bybit(self):
        with patch("app.engines.broker.settings") as mock_settings:
            mock_settings.bybit_api_key = "key"
            mock_settings.bybit_api_secret = "secret"
            mock_settings.bybit_testnet = True
            assert isinstance(get_broker_for_pm("bybit"), BybitAdapter)

    def test_unknown_type_returns_paper(self):
        with patch("app.engines.broker.settings") as mock_settings:
            mock_settings.alpaca_api_key = ""
            assert isinstance(get_broker_for_pm("unknown"), PaperAdapter)


class TestGetBrokerLegacy:
    def test_returns_paper_adapter_without_keys(self):
        with patch("app.engines.broker.settings") as mock_settings:
            mock_settings.alpaca_api_key = ""
            broker = get_broker(TradingMode.PAPER)
            assert isinstance(broker, PaperAdapter)

    def test_returns_alpaca_with_keys(self):
        with patch("app.engines.broker.settings") as mock_settings:
            mock_settings.alpaca_api_key = "key"
            mock_settings.alpaca_secret_key = "secret"
            mock_settings.alpaca_base_url = "https://paper-api.alpaca.markets"
            broker = get_broker(TradingMode.PAPER)
            assert isinstance(broker, AlpacaAdapter)
