from app.engines.paper_trading import PaperTradingEngine


def test_buy_order_reduces_cash():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=10, price=150.0)
    assert engine.cash == 100_000.0 - (10 * 150.0)
    assert "AAPL" in engine.positions


def test_sell_order_increases_cash():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=10, price=150.0)
    engine.execute_sell("AAPL", quantity=5, price=160.0)
    assert engine.cash == 100_000.0 - (10 * 150.0) + (5 * 160.0)
    assert engine.positions["AAPL"]["quantity"] == 5


def test_portfolio_value():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=10, price=150.0)
    value = engine.portfolio_value({"AAPL": 160.0})
    assert value == engine.cash + (10 * 160.0)


def test_position_limit_enforced():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    result = engine.execute_buy("AAPL", quantity=100, price=101.0)
    assert result["status"] == "rejected"
    assert "position_limit" in result["reason"]
