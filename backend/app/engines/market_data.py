"""
Market Data Engine: yfinance 기반 실시간/히스토리 가격 데이터 수집
"""

import asyncio
from datetime import datetime, timedelta
from typing import Optional
import pandas as pd

# yfinance 사용 (pip install yfinance)
try:
    import yfinance as yf
    YFINANCE_AVAILABLE = True
except ImportError:  # pragma: no cover
    YFINANCE_AVAILABLE = False  # pragma: no cover

# PM별 관심 종목
PM_WATCHLISTS: dict[str, list[str]] = {
    "atlas": ["SPY", "QQQ", "TLT", "GLD", "UUP"],
    "council": ["AAPL", "MSFT", "GOOGL", "AMZN", "NVDA"],
    "drflow": ["SPY", "AAPL", "TSLA", "NVDA", "META"],
    "insider": ["AAPL", "MSFT", "GOOGL", "META", "AMZN"],
    "maxpayne": ["SPY", "VIX", "SQQQ", "UVXY", "SH"],
    "satoshi":      ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "DOGE-USD"],
    "defi_whale":   ["ETH-USD", "SOL-USD", "BNB-USD", "ADA-USD", "DOGE-USD"],
    "crypto_quant": ["BTC-USD", "ETH-USD", "SOL-USD", "XRP-USD", "BNB-USD"],
    "moon_hunter":  ["SOL-USD", "ADA-USD", "DOGE-USD", "XRP-USD", "BNB-USD"],
    "bear_guard":   ["BTC-USD", "ETH-USD", "SOL-USD", "BNB-USD", "XRP-USD"],
    "quantking": ["SPY", "QQQ", "IWM", "DIA", "VTI"],
    "asiatiger": ["EWJ", "EWY", "FXI", "EWT", "AAXJ"],
    "momentum": ["QQQ", "NVDA", "AAPL", "MSFT", "META"],
    "sentinel": ["VIX", "TLT", "GLD", "UVXY", "SPY"],
    "voxpopuli": ["GME", "AMC", "BBBY", "SPY", "TSLA"],
}

# 대체 mock 가격 (yfinance 없을 때)
MOCK_PRICES: dict[str, float] = {
    "SPY": 485.0, "QQQ": 415.0, "TLT": 95.0, "GLD": 185.0, "UUP": 28.0,
    "AAPL": 175.0, "MSFT": 415.0, "GOOGL": 165.0, "AMZN": 185.0, "NVDA": 850.0,
    "TSLA": 185.0, "META": 515.0, "BTC-USD": 65000.0, "ETH-USD": 3500.0,
    "SOL-USD": 150.0, "BNB-USD": 620.0, "XRP-USD": 0.55, "ADA-USD": 0.45, "DOGE-USD": 0.08,
    "COIN": 185.0, "MSTR": 1500.0,
    "EWJ": 68.0, "EWY": 60.0, "FXI": 25.0, "EWT": 40.0, "AAXJ": 65.0,
    "IWM": 200.0, "DIA": 385.0, "VTI": 240.0,
    "VIX": 15.0, "UVXY": 8.0, "SQQQ": 12.0, "SH": 15.0,
    "GME": 15.0, "AMC": 4.0, "BBBY": 0.5,
}


def get_price_history(symbol: str, days: int = 60) -> Optional[pd.Series]:
    """종목의 가격 히스토리 반환"""
    if not YFINANCE_AVAILABLE:  # pragma: no cover
        return _mock_price_history(symbol, days)  # pragma: no cover

    try:
        ticker = yf.Ticker(symbol)
        end = datetime.now()
        start = end - timedelta(days=days)
        hist = ticker.history(start=start, end=end)
        if hist.empty:
            return _mock_price_history(symbol, days)
        return hist["Close"]
    except (ValueError, KeyError, TypeError, OSError):
        return _mock_price_history(symbol, days)


def get_current_price(symbol: str) -> float:
    """현재가 반환"""
    if not YFINANCE_AVAILABLE:  # pragma: no cover
        return _mock_current_price(symbol)  # pragma: no cover

    try:
        ticker = yf.Ticker(symbol)
        info = ticker.fast_info
        price = info.last_price
        if price and price > 0:
            return float(price)
        return _mock_current_price(symbol)
    except (ValueError, KeyError, TypeError, OSError):
        return _mock_current_price(symbol)


def get_prices_for_pm(pm_id: str) -> dict[str, float]:
    """PM 관심 종목들의 현재가 반환"""
    symbols = PM_WATCHLISTS.get(pm_id, ["SPY"])
    prices = {}
    for sym in symbols:
        prices[sym] = get_current_price(sym)
    return prices


def _mock_price_history(symbol: str, days: int) -> pd.Series:
    """Mock 가격 히스토리 생성 (yfinance 없을 때)"""
    import numpy as np
    base_price = MOCK_PRICES.get(symbol, 100.0)
    # 날짜 기반 시드: 같은 날 같은 종목은 일관성 유지, 다른 날엔 다른 시그널
    day_seed = (hash(symbol) + datetime.now().toordinal()) % 100000
    np.random.seed(day_seed)
    returns = np.random.normal(0.0003, 0.015, days)
    prices = [base_price]
    for r in returns:
        prices.append(prices[-1] * (1 + r))
    idx = pd.date_range(end=datetime.now(), periods=days + 1, freq="D")
    return pd.Series(prices, index=idx)


def _mock_current_price(symbol: str) -> float:
    """Mock 현재가 (yfinance 없을 때)"""
    import random
    base = MOCK_PRICES.get(symbol, 100.0)
    # ±2% 랜덤 변동
    return round(base * (1 + random.uniform(-0.02, 0.02)), 2)


def get_market_context() -> dict:
    """전반적인 시장 컨텍스트 반환"""
    spy_price = get_current_price("SPY")
    vix = get_current_price("VIX")

    return {
        "spy_price": spy_price,
        "vix": vix if vix > 0 else 15.0,
        "market_regime": "risk_off" if vix > 25 else "risk_on" if vix < 18 else "neutral",
        "timestamp": datetime.now().isoformat(),
    }
