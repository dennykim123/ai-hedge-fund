from app.engines.broker import TradingMode, get_broker


def test_paper_mode_uses_paper_url():
    broker = get_broker(TradingMode.PAPER)
    assert "paper-api" in broker.base_url


def test_live_mode_uses_live_url():
    broker = get_broker(TradingMode.LIVE)
    assert "paper-api" not in broker.base_url
