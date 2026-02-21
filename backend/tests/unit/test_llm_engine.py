from unittest.mock import AsyncMock, MagicMock, patch
import json

import pytest

from app.engines.llm import LLMEngine, SYSTEM_PROMPTS


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


def test_system_prompts_cover_all_pms():
    expected = ["atlas", "council", "drflow", "insider", "maxpayne",
                "satoshi", "quantking", "asiatiger", "momentum", "sentinel", "voxpopuli"]
    for pm_id in expected:
        assert pm_id in SYSTEM_PROMPTS


def test_client_property_none_without_api_key():
    engine = LLMEngine()
    # API 키 없으면 client는 None
    with patch("app.engines.llm.settings") as mock_settings:
        mock_settings.anthropic_api_key = ""
        engine._claude_client = None  # 리셋
        assert engine.claude_client is None


def test_client_property_creates_anthropic_with_key():
    engine = LLMEngine()
    mock_anthropic = MagicMock()
    with patch("app.engines.llm.settings") as mock_settings, \
         patch("anthropic.Anthropic", return_value=mock_anthropic) as mock_cls:
        mock_settings.anthropic_api_key = "test_key_123"
        engine._claude_client = None  # 리셋
        client = engine.claude_client
        mock_cls.assert_called_once_with(api_key="test_key_123")


@pytest.mark.asyncio
async def test_call_claude_parses_json():
    engine = LLMEngine()
    expected = {"action": "BUY", "conviction": 0.8, "reasoning": "test", "position_size": 0.05}

    mock_msg = MagicMock()
    mock_msg.content = [MagicMock(text=json.dumps(expected))]
    mock_client = MagicMock()
    mock_client.messages.create.return_value = mock_msg
    engine._claude_client = mock_client

    result = await engine._call_claude("atlas", "test prompt")
    assert result["action"] == "BUY"
    assert result["conviction"] == 0.8
