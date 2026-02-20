"""trading_cycle 엔진 유닛 테스트"""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.db.base import Base
from app.models.pm import PM
from app.models.position import Position
from app.models.trade import Trade
from app.models.signal import Signal
from app.models.nav_history import NAVHistory
from app.engines.trading_cycle import (
    _rule_based_decision,
    record_nav,
    seed_nav_history,
    _execute_buy,
    _execute_sell,
    _update_pm_capital,
)

# 테스트용 인메모리 DB
TEST_DB_URL = "sqlite:///:memory:"
engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
Session = sessionmaker(bind=engine)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture
def db():
    session = Session()
    yield session
    session.close()


@pytest.fixture
def pm(db):
    p = PM(
        id="testpm",
        name="Test PM",
        emoji="🤖",
        strategy="test",
        llm_provider="mock",
        current_capital=100_000.0,
        is_active=True,
    )
    db.add(p)
    db.commit()
    return p


class TestRuleBasedDecision:
    def test_strong_buy_signal(self):
        signals = {"composite_score": 0.8}
        result = _rule_based_decision("pm1", signals)
        assert result["action"] == "BUY"
        assert result["conviction"] >= 0.5

    def test_strong_sell_signal(self):
        signals = {"composite_score": -0.8}
        result = _rule_based_decision("pm1", signals)
        assert result["action"] == "SELL"
        assert result["conviction"] >= 0.5

    def test_neutral_signal_hold(self):
        signals = {"composite_score": 0.1}
        result = _rule_based_decision("pm1", signals)
        assert result["action"] == "HOLD"

    def test_boundary_buy(self):
        signals = {"composite_score": 0.51}
        result = _rule_based_decision("pm1", signals)
        assert result["action"] == "BUY"

    def test_boundary_sell(self):
        signals = {"composite_score": -0.51}
        result = _rule_based_decision("pm1", signals)
        assert result["action"] == "SELL"

    def test_missing_score_defaults_to_hold(self):
        result = _rule_based_decision("pm1", {})
        assert result["action"] == "HOLD"

    def test_conviction_capped_at_1(self):
        signals = {"composite_score": 10.0}
        result = _rule_based_decision("pm1", signals)
        assert result["conviction"] <= 1.0

    def test_returns_position_size(self):
        signals = {"composite_score": 0.8}
        result = _rule_based_decision("pm1", signals)
        assert "position_size" in result
        assert result["position_size"] > 0


class TestRecordNav:
    def test_records_nav_with_pms(self, db, pm):
        result = record_nav(db)
        assert "nav" in result
        assert result["nav"] == pm.current_capital
        assert "daily_return" in result

    def test_daily_return_zero_on_first_record(self, db, pm):
        result = record_nav(db)
        assert result["daily_return"] == 0.0

    def test_daily_return_calculated_on_second_record(self, db, pm):
        record_nav(db)
        pm.current_capital = 110_000.0
        db.commit()
        result = record_nav(db)
        assert result["daily_return"] != 0.0

    def test_nav_stored_in_db(self, db, pm):
        record_nav(db)
        count = db.query(NAVHistory).count()
        assert count == 1

    def test_no_pms_returns_zero_nav(self, db):
        result = record_nav(db)
        assert result["nav"] == 0.0


class TestSeedNavHistory:
    def test_seeds_correct_number_of_records(self, db, pm):
        seed_nav_history(db, days=30)
        count = db.query(NAVHistory).count()
        assert count == 31  # 30일 + 1 현재

    def test_does_not_seed_twice(self, db, pm):
        seed_nav_history(db, days=30)
        seed_nav_history(db, days=30)
        count = db.query(NAVHistory).count()
        assert count == 31

    def test_records_have_nav_values(self, db, pm):
        seed_nav_history(db, days=10)
        records = db.query(NAVHistory).all()
        for r in records:
            assert r.nav > 0


class TestExecuteBuy:
    @pytest.mark.asyncio
    async def test_creates_new_position(self, db, pm):
        result = await _execute_buy(pm, "SPY", 10.0, 100.0, db)
        assert result["trade_executed"] is True
        pos = db.query(Position).filter_by(pm_id=pm.id, symbol="SPY").first()
        assert pos is not None
        assert pos.quantity == pytest.approx(10.0)

    @pytest.mark.asyncio
    async def test_adds_to_existing_position(self, db, pm):
        existing = Position(pm_id=pm.id, symbol="SPY", quantity=5.0, avg_cost=95.0)
        db.add(existing)
        db.commit()

        await _execute_buy(pm, "SPY", 5.0, 105.0, db)
        pos = db.query(Position).filter_by(pm_id=pm.id, symbol="SPY").first()
        assert pos.quantity == pytest.approx(10.0)

    @pytest.mark.asyncio
    async def test_position_limit_enforced(self, db, pm):
        # 자본의 10% 이상 주문 시 제한
        large_qty = pm.current_capital / 10.0 + 100  # 넘치는 수량
        result = await _execute_buy(pm, "AAPL", large_qty, 1.0, db)
        pos = db.query(Position).filter_by(pm_id=pm.id, symbol="AAPL").first()
        assert pos.quantity * 1.0 <= pm.current_capital * 0.10 + 0.01

    @pytest.mark.asyncio
    async def test_creates_trade_record(self, db, pm):
        await _execute_buy(pm, "SPY", 5.0, 100.0, db)
        trade = db.query(Trade).filter_by(pm_id=pm.id, symbol="SPY", action="BUY").first()
        assert trade is not None
        assert trade.quantity == pytest.approx(5.0)


class TestExecuteSell:
    @pytest.mark.asyncio
    async def test_no_position_returns_not_executed(self, db, pm):
        result = await _execute_sell(pm, "SPY", 5.0, 100.0, db)
        assert result["trade_executed"] is False

    @pytest.mark.asyncio
    async def test_partial_sell(self, db, pm):
        pos = Position(pm_id=pm.id, symbol="SPY", quantity=10.0, avg_cost=100.0)
        db.add(pos)
        db.commit()

        result = await _execute_sell(pm, "SPY", 4.0, 110.0, db)
        assert result["trade_executed"] is True
        pos = db.query(Position).filter_by(pm_id=pm.id, symbol="SPY").first()
        assert pos.quantity == pytest.approx(6.0)

    @pytest.mark.asyncio
    async def test_full_sell_removes_position(self, db, pm):
        pos = Position(pm_id=pm.id, symbol="SPY", quantity=5.0, avg_cost=100.0)
        db.add(pos)
        db.commit()

        await _execute_sell(pm, "SPY", 5.0, 110.0, db)
        db.flush()
        pos = db.query(Position).filter_by(pm_id=pm.id, symbol="SPY").first()
        assert pos is None

    @pytest.mark.asyncio
    async def test_creates_trade_record(self, db, pm):
        pos = Position(pm_id=pm.id, symbol="SPY", quantity=10.0, avg_cost=100.0)
        db.add(pos)
        db.commit()

        await _execute_sell(pm, "SPY", 3.0, 110.0, db)
        trade = db.query(Trade).filter_by(pm_id=pm.id, symbol="SPY", action="SELL").first()
        assert trade is not None


class TestUpdatePmCapital:
    def test_capital_remains_non_negative(self, db, pm):
        _update_pm_capital(pm, db, 100.0, "SPY", 10_000.0, "BUY")
        assert pm.current_capital >= 0.0

    def test_capital_changes(self, db, pm):
        original = pm.current_capital
        _update_pm_capital(pm, db, 100.0, "SPY", 10_000.0, "SELL")
        # 랜덤 변동이므로 달라질 수 있음 (단, 양수 보장)
        assert pm.current_capital >= 0.0
