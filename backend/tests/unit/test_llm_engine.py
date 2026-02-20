from unittest.mock import AsyncMock, patch

import pytest

from app.engines.llm import LLMEngine


@pytest.mark.asyncio
async def test_llm_returns_decision():
    engine = LLMEngine()
    signals = {
        "symbol": "AAPL",
        "rsi": 28.5,
        "momentum": 0.12,
        "composite_score": 0.75,
    }
    with patch.object(engine, "_call_claude", new_callable=AsyncMock) as mock:
        mock.return_value = {
            "action": "BUY",
            "conviction": 0.82,
            "reasoning": "RSI oversold + strong momentum",
            "position_size": 0.08,
        }
        result = await engine.make_decision("atlas", "AAPL", signals, {})
    assert result["action"] in ("BUY", "SELL", "HOLD")
    assert 0.0 <= result["conviction"] <= 1.0
    assert "reasoning" in result


@pytest.mark.asyncio
async def test_low_conviction_becomes_hold():
    engine = LLMEngine()
    signals = {"symbol": "AAPL", "rsi": 50.0, "momentum": 0.0, "composite_score": 0.1}
    with patch.object(engine, "_call_claude", new_callable=AsyncMock) as mock:
        mock.return_value = {
            "action": "BUY",
            "conviction": 0.3,
            "reasoning": "Weak signal",
            "position_size": 0.02,
        }
        result = await engine.make_decision("atlas", "AAPL", signals, {})
    assert result["action"] == "HOLD"
