from abc import ABC, abstractmethod
from enum import Enum


class TradingMode(Enum):
    PAPER = "paper"
    LIVE = "live"


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


class AlpacaAdapter(BrokerAdapter):
    def __init__(self, api_key: str, secret_key: str, base_url: str):
        self.api_key = api_key
        self.secret_key = secret_key
        self.base_url = base_url

    async def place_order(
        self, symbol: str, qty: float, side: str, order_type: str = "market"
    ) -> dict:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.post(
                f"{self.base_url}/v2/orders",
                headers={
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.secret_key,
                },
                json={
                    "symbol": symbol,
                    "qty": qty,
                    "side": side,
                    "type": order_type,
                    "time_in_force": "day",
                },
            )
            response.raise_for_status()
            return response.json()

    async def get_positions(self) -> list[dict]:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v2/positions",
                headers={
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.secret_key,
                },
            )
            response.raise_for_status()
            return response.json()

    async def get_account(self) -> dict:
        import httpx

        async with httpx.AsyncClient() as client:
            response = await client.get(
                f"{self.base_url}/v2/account",
                headers={
                    "APCA-API-KEY-ID": self.api_key,
                    "APCA-API-SECRET-KEY": self.secret_key,
                },
            )
            response.raise_for_status()
            return response.json()


def get_broker(mode: TradingMode = TradingMode.PAPER) -> BrokerAdapter:
    from app.config import settings

    base_url = (
        "https://paper-api.alpaca.markets"
        if mode == TradingMode.PAPER
        else "https://api.alpaca.markets"
    )
    return AlpacaAdapter(settings.alpaca_api_key, settings.alpaca_secret_key, base_url)
