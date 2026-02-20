import numpy as np
import pandas as pd

from app.engines.quant import QuantEngine


def make_prices(n=50, trend="up"):
    if trend == "up":
        return pd.Series([100 + i * 0.5 for i in range(n)])
    elif trend == "down":
        return pd.Series([100 - i * 0.5 for i in range(n)])
    return pd.Series([100 + np.sin(i) for i in range(n)])


def test_rsi_oversold():
    engine = QuantEngine()
    prices = make_prices(50, "down")
    rsi = engine.calculate_rsi(prices, period=14)
    assert rsi < 35, f"Downtrend RSI should be oversold, got {rsi}"


def test_rsi_overbought():
    engine = QuantEngine()
    prices = make_prices(50, "up")
    rsi = engine.calculate_rsi(prices, period=14)
    assert rsi > 65, f"Uptrend RSI should be overbought, got {rsi}"


def test_momentum_score_positive():
    engine = QuantEngine()
    prices = make_prices(252, "up")
    score = engine.calculate_momentum_score(prices, lookback=252)
    assert score > 0


def test_generate_signals_returns_dict():
    engine = QuantEngine()
    prices = make_prices(60)
    signals = engine.generate_signals(prices, symbol="AAPL")
    assert "rsi" in signals
    assert "momentum" in signals
    assert "composite_score" in signals
    assert -1.0 <= signals["composite_score"] <= 1.0


def test_momentum_score_zero_lookback():
    # quant.py 32번: lookback<=0 → 0.0
    engine = QuantEngine()
    prices = pd.Series([100.0])  # 1개 가격, lookback 불가
    score = engine.calculate_momentum_score(prices, lookback=252)
    assert score == 0.0


def test_momentum_score_zero_start_price():
    # quant.py 36번: start_price==0 → 0.0
    engine = QuantEngine()
    prices = pd.Series([0.0] + [100.0] * 10)
    score = engine.calculate_momentum_score(prices, lookback=10)
    assert score == 0.0


def test_volatility_short_series():
    # quant.py 42번: len(returns) < period → std of all returns
    engine = QuantEngine()
    prices = make_prices(5, "up")  # 5개, period=20보다 짧음
    vol = engine.calculate_volatility(prices, period=20)
    assert vol >= 0.0


def test_rsi_to_signal_above_60():
    # quant.py 49번: rsi > 60 → -0.4
    engine = QuantEngine()
    result = engine._rsi_to_signal(65.0)
    assert result == -0.4
