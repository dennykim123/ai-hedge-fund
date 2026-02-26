"""
Broker Adapter Layer
- BrokerAdapter: 추상 인터페이스
- PaperAdapter: API 키 없을 때 로컬 시뮬레이션 (폴백)
- KISAdapter: 한국투자증권 REST API (국내/해외 주식)
- BybitAdapter: Bybit REST API (암호화폐 현물/선물)
- get_broker_for_pm(): PM의 broker_type에 따라 적절한 어댑터 반환
"""

from abc import ABC, abstractmethod
from enum import Enum

from app.config import settings


class TradingMode(Enum):
    PAPER = "paper"
    LIVE = "live"


# ---------------------------------------------------------------------------
# 추상 인터페이스
# ---------------------------------------------------------------------------

class BrokerAdapter(ABC):
    @abstractmethod
    async def place_order(
        self, symbol: str, qty: float, side: str, order_type: str = "market"
    ) -> dict:
        pass  # pragma: no cover

    @abstractmethod
    async def get_positions(self) -> list[dict]:
        pass  # pragma: no cover

    @abstractmethod
    async def get_account(self) -> dict:
        pass  # pragma: no cover

    def is_live(self) -> bool:  # pragma: no cover
        return False


# ---------------------------------------------------------------------------
# Paper (폴백 — API 키 없을 때)
# ---------------------------------------------------------------------------

class PaperAdapter(BrokerAdapter):
    """실제 API 호출 없이 즉시 체결 시뮬레이션"""

    SIMULATED_FEE_RATE = 0.001  # 0.1% (Bybit 기본 수수료율 시뮬레이션)

    async def place_order(
        self, symbol: str, qty: float, side: str, order_type: str = "market"
    ) -> dict:
        return {
            "status": "filled",
            "broker": "paper",
            "symbol": symbol,
            "qty": qty,
            "side": side,
            "filled_qty": qty,
            "filled_avg_price": None,  # trading_cycle이 현재가 사용
            "fee": None,  # trading_cycle에서 가격 기반 계산
            "fee_rate": self.SIMULATED_FEE_RATE,
        }

    async def get_positions(self) -> list[dict]:
        return []

    async def get_account(self) -> dict:
        return {"broker": "paper", "status": "ok"}


# ---------------------------------------------------------------------------
# KIS — 한국투자증권
# ---------------------------------------------------------------------------

class KISAdapter(BrokerAdapter):
    """
    한국투자증권 Open API (REST)
    모의투자: https://openapivts.koreainvestment.com:29443
    실거래:   https://openapi.koreainvestment.com:9443

    사전 준비:
      1. KIS Developers (https://apiportal.koreainvestment.com) 가입
      2. 앱키/시크릿 발급
      3. .env에 KIS_APP_KEY, KIS_APP_SECRET, KIS_ACCOUNT_NO 설정
    """

    MOCK_URL = "https://openapivts.koreainvestment.com:29443"
    LIVE_URL = "https://openapi.koreainvestment.com:9443"

    # KIS 종목코드 매핑 (yfinance 심볼 → KIS 심볼)
    SYMBOL_MAP: dict[str, tuple[str, str]] = {
        # (KIS 종목코드, 거래소코드)
        "SPY":  ("SPY",  "AMEX"),
        "QQQ":  ("QQQ",  "NASD"),
        "AAPL": ("AAPL", "NASD"),
        "MSFT": ("MSFT", "NASD"),
        "NVDA": ("NVDA", "NASD"),
        "TSLA": ("TSLA", "NASD"),
        "META": ("META", "NASD"),
        "GOOGL":("GOOGL","NASD"),
        "AMZN": ("AMZN", "NASD"),
        "TLT":  ("TLT",  "NASD"),
        "GLD":  ("GLD",  "NYSE"),
        "IWM":  ("IWM",  "AMEX"),
        "VTI":  ("VTI",  "NYSE"),
        "DIA":  ("DIA",  "AMEX"),
        "EWJ":  ("EWJ",  "AMEX"),
        "EWY":  ("EWY",  "NYSE"),
        "FXI":  ("FXI",  "NYSE"),
        "EWT":  ("EWT",  "NYSE"),
        "AAXJ": ("AAXJ", "NASD"),
        "SH":   ("SH",   "NYSE"),
        "UVXY": ("UVXY", "CBOE"),
        "SQQQ": ("SQQQ", "NASD"),
    }

    def __init__(self, app_key: str, app_secret: str, account_no: str, mock: bool = True):
        self._app_key = app_key
        self._app_secret = app_secret
        self._account_no = account_no          # "50123456-01" 형식
        self._mock = mock
        self._base_url = self.MOCK_URL if mock else self.LIVE_URL
        self._access_token: str | None = None

    def is_live(self) -> bool:
        return not self._mock

    async def _get_token(self) -> str:
        """OAuth 액세스 토큰 발급 (1일 유효)"""
        if self._access_token:
            return self._access_token
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self._base_url}/oauth2/tokenP",
                json={
                    "grant_type": "client_credentials",
                    "appkey": self._app_key,
                    "appsecret": self._app_secret,
                },
            )
            r.raise_for_status()
            self._access_token = r.json()["access_token"]
        return self._access_token

    def _headers(self, token: str, tr_id: str) -> dict:
        acct_parts = self._account_no.split("-")
        return {
            "authorization": f"Bearer {token}",
            "appkey": self._app_key,
            "appsecret": self._app_secret,
            "tr_id": tr_id,
            "custtype": "P",
        }

    async def place_order(
        self, symbol: str, qty: float, side: str, order_type: str = "market"
    ) -> dict:
        """
        해외주식 매수/매도 주문
        KIS tr_id:
          모의) 매수: VTTT1002U  매도: VTTT1006U
          실거래) 매수: TTTT1002U  매도: TTTT1006U
        """
        import httpx

        kis_symbol, excd = self.SYMBOL_MAP.get(symbol, (symbol, "NASD"))
        token = await self._get_token()

        if side.upper() == "BUY":
            tr_id = "VTTT1002U" if self._mock else "TTTT1002U"
        else:
            tr_id = "VTTT1006U" if self._mock else "TTTT1006U"

        acct_no, acct_suffix = (self._account_no.split("-") + ["01"])[:2]

        body = {
            "CANO": acct_no,
            "ACNT_PRDT_CD": acct_suffix,
            "OVRS_EXCG_CD": excd,
            "PDNO": kis_symbol,
            "ORD_DVSN": "00",          # 00=지정가, 01=시장가 (해외는 00 필수)
            "ORD_QTY": str(int(qty)),
            "OVRS_ORD_UNPR": "0",      # 시장가 주문 시 0
            "ORD_SVR_DVSN_CD": "0",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{self._base_url}/uapi/overseas-stock/v1/trading/order",
                headers=self._headers(token, tr_id),
                json=body,
            )
            r.raise_for_status()
            data = r.json()

        rt_cd = data.get("rt_cd", "1")
        if rt_cd != "0":
            return {
                "status": "rejected",
                "broker": "kis",
                "reason": data.get("msg1", "unknown"),
                "raw": data,
            }

        return {
            "status": "filled",
            "broker": "kis",
            "symbol": symbol,
            "qty": qty,
            "side": side,
            "order_id": data.get("output", {}).get("ODNO", ""),
            "filled_qty": qty,
            "filled_avg_price": None,
        }

    async def get_positions(self) -> list[dict]:
        """해외주식 잔고 조회"""
        import httpx

        token = await self._get_token()
        tr_id = "VTTS3012R" if self._mock else "TTTS3012R"
        acct_no, acct_suffix = (self._account_no.split("-") + ["01"])[:2]

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{self._base_url}/uapi/overseas-stock/v1/trading/inquire-balance",
                headers=self._headers(token, tr_id),
                params={
                    "CANO": acct_no,
                    "ACNT_PRDT_CD": acct_suffix,
                    "OVRS_EXCG_CD": "NASD",
                    "TR_CRCY_CD": "USD",
                    "CTX_AREA_FK200": "",
                    "CTX_AREA_NK200": "",
                },
            )
            r.raise_for_status()
            data = r.json()

        positions = []
        for item in data.get("output1", []):
            qty = float(item.get("OVRS_CBLC_QTY", 0))
            if qty > 0:
                positions.append({
                    "symbol": item.get("PDNO"),
                    "qty": qty,
                    "avg_cost": float(item.get("PCHS_AVG_PRIC", 0)),
                    "market_value": float(item.get("EVLU_AMT", 0)),
                })
        return positions

    async def get_account(self) -> dict:
        """계좌 잔고 조회"""
        import httpx

        token = await self._get_token()
        tr_id = "VTTS3012R" if self._mock else "TTTS3012R"
        acct_no, acct_suffix = (self._account_no.split("-") + ["01"])[:2]

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{self._base_url}/uapi/overseas-stock/v1/trading/inquire-balance",
                headers=self._headers(token, tr_id),
                params={
                    "CANO": acct_no,
                    "ACNT_PRDT_CD": acct_suffix,
                    "OVRS_EXCG_CD": "NASD",
                    "TR_CRCY_CD": "USD",
                    "CTX_AREA_FK200": "",
                    "CTX_AREA_NK200": "",
                },
            )
            r.raise_for_status()
            data = r.json()

        output2 = data.get("output2", {})
        return {
            "broker": "kis",
            "mock": self._mock,
            "total_eval_amount": float(output2.get("tot_evlu_pfls_amt", 0)),
            "total_profit_loss": float(output2.get("ovrs_tot_pfls", 0)),
        }


# ---------------------------------------------------------------------------
# Bybit — 암호화폐
# ---------------------------------------------------------------------------

class BybitAdapter(BrokerAdapter):
    """
    Bybit REST API v5 (현물 + 선물)
    테스트넷: https://api-testnet.bybit.com
    실거래:   https://api.bybit.com

    사전 준비:
      1. bybit.com 회원가입 → API 관리 → API 키 생성
      2. .env에 BYBIT_API_KEY, BYBIT_API_SECRET 설정
      3. 테스트넷: https://testnet.bybit.com 에서 별도 키 발급
    """

    LIVE_URL = "https://api.bybit.com"
    TEST_URL = "https://api-testnet.bybit.com"

    # yfinance 심볼 → Bybit 심볼 변환 (실제 Bybit 현물 페어만)
    SYMBOL_MAP: dict[str, str] = {
        "BTC-USD":  "BTCUSDT",
        "ETH-USD":  "ETHUSDT",
        "SOL-USD":  "SOLUSDT",
        "BNB-USD":  "BNBUSDT",
        "XRP-USD":  "XRPUSDT",
        "ADA-USD":  "ADAUSDT",
        "DOGE-USD": "DOGEUSDT",
    }

    def __init__(self, api_key: str, api_secret: str, testnet: bool = True):
        self._api_key = api_key
        self._api_secret = api_secret
        self._testnet = testnet
        self._base_url = self.TEST_URL if testnet else self.LIVE_URL

    def is_live(self) -> bool:
        return not self._testnet

    def _sign(self, params: str, timestamp: str) -> str:
        import hmac, hashlib
        recv_window = "5000"
        msg = timestamp + self._api_key + recv_window + params
        return hmac.new(
            self._api_secret.encode(), msg.encode(), hashlib.sha256
        ).hexdigest()

    def _auth_headers(self, params: str = "") -> dict:
        import time
        timestamp = str(int(time.time() * 1000))
        return {
            "X-BAPI-API-KEY": self._api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": self._sign(params, timestamp),
            "X-BAPI-RECV-WINDOW": "5000",
            "Content-Type": "application/json",
        }

    async def place_order(
        self, symbol: str, qty: float, side: str, order_type: str = "market"
    ) -> dict:
        """
        Bybit v5 현물 주문
        category: spot (현물), linear (USDT 무기한 선물)
        """
        import httpx, json, time

        bybit_symbol = self.SYMBOL_MAP.get(symbol, symbol.replace("-", ""))
        bybit_side = "Buy" if side.upper() == "BUY" else "Sell"

        body = {
            "category": "spot",
            "symbol": bybit_symbol,
            "side": bybit_side,
            "orderType": "Market",
            "qty": str(round(qty, 6)),
            "timeInForce": "IOC",
        }
        body_str = json.dumps(body)
        timestamp = str(int(time.time() * 1000))
        headers = {
            "X-BAPI-API-KEY": self._api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": self._sign(body_str, timestamp),
            "X-BAPI-RECV-WINDOW": "5000",
            "Content-Type": "application/json",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.post(
                f"{self._base_url}/v5/order/create",
                headers=headers,
                content=body_str,
            )
            r.raise_for_status()
            data = r.json()

        ret_code = data.get("retCode", -1)
        if ret_code != 0:
            return {
                "status": "rejected",
                "broker": "bybit",
                "reason": data.get("retMsg", "unknown"),
                "raw": data,
            }

        order_info = data.get("result", {})
        order_id = order_info.get("orderId", "")

        # 실제 체결 가격 + 수수료 조회
        filled_price = None
        fee = None
        if order_id:
            try:
                fill_info = await self._get_fill_info(order_id, bybit_symbol)
                filled_price = fill_info.get("price")
                fee = fill_info.get("fee")
            except Exception as e:
                import logging
                logging.getLogger(__name__).warning("Fill info query failed: %s", e)

        return {
            "status": "filled",
            "broker": "bybit",
            "symbol": symbol,
            "bybit_symbol": bybit_symbol,
            "qty": qty,
            "side": side,
            "order_id": order_id,
            "filled_qty": qty,
            "filled_avg_price": filled_price,
            "fee": fee,
        }

    async def _get_fill_info(self, order_id: str, bybit_symbol: str) -> dict:
        """주문 체결 가격 + 수수료 조회 (v5/order/realtime)"""
        import httpx, time

        params = f"category=spot&orderId={order_id}"
        timestamp = str(int(time.time() * 1000))
        headers = {
            "X-BAPI-API-KEY": self._api_key,
            "X-BAPI-TIMESTAMP": timestamp,
            "X-BAPI-SIGN": self._sign(params, timestamp),
            "X-BAPI-RECV-WINDOW": "5000",
        }

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{self._base_url}/v5/order/realtime",
                headers=headers,
                params={"category": "spot", "orderId": order_id},
            )
            r.raise_for_status()
            data = r.json()

        result: dict[str, float | None] = {"price": None, "fee": None}
        orders = data.get("result", {}).get("list", [])
        if orders:
            order = orders[0]
            avg_price = order.get("avgPrice", "0")
            price = float(avg_price) if avg_price else None
            if price and price > 0:
                result["price"] = price
            cum_fee = order.get("cumExecFee", "0")
            fee = float(cum_fee) if cum_fee else None
            if fee is not None:
                result["fee"] = abs(fee)
        return result

    async def get_positions(self) -> list[dict]:
        """현물 잔고 조회"""
        import httpx, json

        params = "accountType=UNIFIED"
        headers = self._auth_headers(params)

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{self._base_url}/v5/account/wallet-balance",
                headers=headers,
                params={"accountType": "UNIFIED"},
            )
            r.raise_for_status()
            data = r.json()

        positions = []
        for account in data.get("result", {}).get("list", []):
            for coin in account.get("coin", []):
                qty = float(coin.get("walletBalance", 0))
                if qty > 0.0001 and coin.get("coin") != "USDT":
                    positions.append({
                        "symbol": coin["coin"] + "-USD",
                        "qty": qty,
                        "avg_cost": float(coin.get("avgPrice", 0)),
                        "market_value": float(coin.get("usdValue", 0)),
                    })
        return positions

    async def get_account(self) -> dict:
        """UNIFIED 계좌 잔고 (상세)"""
        import httpx

        params = "accountType=UNIFIED"
        headers = self._auth_headers(params)

        async with httpx.AsyncClient(timeout=10.0) as client:
            r = await client.get(
                f"{self._base_url}/v5/account/wallet-balance",
                headers=headers,
                params={"accountType": "UNIFIED"},
            )
            r.raise_for_status()
            data = r.json()

        account_list = data.get("result", {}).get("list", [])
        if not account_list:
            return {"broker": "bybit", "testnet": self._testnet, "total_equity_usd": 0, "coins": []}

        acct = account_list[0]
        total_equity = float(acct.get("totalEquity", 0))
        available = float(acct.get("totalAvailableBalance", 0))

        coins = []
        for coin in acct.get("coin", []):
            eq = float(coin.get("equity", 0))
            if eq > 0.0001:
                coins.append({
                    "coin": coin["coin"],
                    "equity": round(eq, 6),
                    "usd_value": round(float(coin.get("usdValue", 0)), 2),
                })

        return {
            "broker": "bybit",
            "testnet": self._testnet,
            "total_equity_usd": round(total_equity, 2),
            "available_balance_usd": round(available, 2),
            "coins": coins,
        }


# ---------------------------------------------------------------------------
# 기존 Alpaca (하위 호환)
# ---------------------------------------------------------------------------

class AlpacaAdapter(BrokerAdapter):
    def __init__(self, api_key: str, secret_key: str, base_url: str):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = base_url

    def is_live(self) -> bool:
        return "paper" not in self.base_url

    async def place_order(
        self, symbol: str, qty: float, side: str, order_type: str = "market"
    ) -> dict:
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.post(
                f"{self.base_url}/v2/orders",
                headers={
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.secret_key,
                },
                json={"symbol": symbol, "qty": qty, "side": side,
                      "type": order_type, "time_in_force": "day"},
            )
            r.raise_for_status()
            return {"status": "filled", "broker": "alpaca", **r.json()}

    async def get_positions(self) -> list[dict]:
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/v2/positions",
                headers={
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.secret_key,
                },
            )
            r.raise_for_status()
            return r.json()

    async def get_account(self) -> dict:
        import httpx
        async with httpx.AsyncClient() as client:
            r = await client.get(
                f"{self.base_url}/v2/account",
                headers={
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.secret_key,
                },
            )
            r.raise_for_status()
            return r.json()


# ---------------------------------------------------------------------------
# 팩토리 — PM broker_type에 따라 적절한 어댑터 반환
# ---------------------------------------------------------------------------

def get_broker_for_pm(broker_type: str) -> BrokerAdapter:
    """
    PM의 broker_type에 따라 어댑터 반환.
    API 키가 없으면 자동으로 PaperAdapter 폴백.
    """
    if broker_type == "kis":
        if settings.kis_app_key and settings.kis_app_secret and settings.kis_account_no:
            return KISAdapter(
                app_key=settings.kis_app_key,
                app_secret=settings.kis_app_secret,
                account_no=settings.kis_account_no,
                mock=settings.kis_mock,
            )
        return PaperAdapter()

    if broker_type == "bybit":
        if settings.bybit_api_key and settings.bybit_api_secret:
            return BybitAdapter(
                api_key=settings.bybit_api_key,
                api_secret=settings.bybit_api_secret,
                testnet=settings.bybit_testnet,
            )
        return PaperAdapter()

    # alpaca (레거시) 또는 paper
    if broker_type == "alpaca" and settings.alpaca_api_key:
        return AlpacaAdapter(
            settings.alpaca_api_key,
            settings.alpaca_secret_key,
            settings.alpaca_base_url,
        )

    return PaperAdapter()


# 하위 호환
def get_broker(mode: TradingMode = TradingMode.PAPER) -> BrokerAdapter:
    base_url = (
        "https://paper-api.alpaca.markets"
        if mode == TradingMode.PAPER
        else "https://api.alpaca.markets"
    )
    if not settings.alpaca_api_key:
        return PaperAdapter()
    return AlpacaAdapter(settings.alpaca_api_key, settings.alpaca_secret_key, base_url)
