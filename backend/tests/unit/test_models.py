from app.models.pm import PM
from app.models.position import Position
from app.models.trade import Trade


def test_pm_model_fields():
    pm = PM(
        id="atlas",
        name="Atlas",
        emoji="\U0001f30d",
        strategy="Macro Regime",
        llm_provider="claude",
        is_active=True,
        initial_capital=100_000.0,
    )
    assert pm.id == "atlas"
    assert pm.initial_capital == 100_000.0


def test_position_model_fields():
    pos = Position(
        pm_id="atlas",
        symbol="AAPL",
        quantity=10,
        avg_cost=150.0,
        asset_type="stock",
    )
    assert pos.symbol == "AAPL"
    assert pos.quantity == 10


def test_trade_model_fields():
    trade = Trade(
        pm_id="atlas",
        symbol="AAPL",
        action="BUY",
        quantity=10,
        price=150.0,
    )
    assert trade.action == "BUY"
    assert trade.price == 150.0
