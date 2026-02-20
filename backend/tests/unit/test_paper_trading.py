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


def test_buy_rejected_insufficient_cash():
    # nav~10000(positions 포함), limit=1000, order=99 → limit 통과, cash=90 → 현금 부족
    engine = PaperTradingEngine(initial_capital=10_000.0)
    engine.cash = 90.0
    engine.positions["SPY"] = {"quantity": 100, "avg_cost": 99.1}
    result = engine.execute_buy("AAPL", quantity=1, price=99.0)
    assert result["status"] == "rejected"
    assert "insufficient_cash" in result["reason"]


def test_buy_adds_to_existing_position():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=5, price=100.0)
    engine.execute_buy("AAPL", quantity=5, price=120.0)
    assert engine.positions["AAPL"]["quantity"] == 10
    assert engine.positions["AAPL"]["avg_cost"] == 110.0


def test_sell_no_position_rejected():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    result = engine.execute_sell("AAPL", quantity=5, price=100.0)
    assert result["status"] == "rejected"
    assert result["reason"] == "no_position"


def test_sell_more_than_held_sells_all():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=3, price=100.0)
    result = engine.execute_sell("AAPL", quantity=10, price=110.0)
    assert result["quantity"] == 3
    assert "AAPL" not in engine.positions


def test_sell_removes_position_when_zero():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=5, price=100.0)
    engine.execute_sell("AAPL", quantity=5, price=110.0)
    assert "AAPL" not in engine.positions


def test_portfolio_value_without_prices_uses_avg_cost():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=10, price=150.0)
    value = engine.portfolio_value({})
    assert value == engine.cash + (10 * 150.0)


def test_check_position_limit_with_existing_position():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=5, price=100.0)
    ok = engine._check_position_limit("AAPL", 100.0, {"AAPL": 100.0})
    assert isinstance(ok, bool)


def test_trade_history_recorded():
    engine = PaperTradingEngine(initial_capital=100_000.0)
    engine.execute_buy("AAPL", quantity=5, price=100.0)
    engine.execute_sell("AAPL", quantity=3, price=110.0)
    assert len(engine.trade_history) == 2
    assert engine.trade_history[0]["action"] == "BUY"
    assert engine.trade_history[1]["action"] == "SELL"
