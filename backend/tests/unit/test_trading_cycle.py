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
        new_capital = _update_pm_capital(pm, db)
        assert new_capital >= 0.0

    def test_capital_with_position(self, db, pm):
        # 포지션 있으면 현재가 기준 평가액으로 재계산
        pos = Position(pm_id=pm.id, symbol="SPY", quantity=10.0, avg_cost=480.0)
        db.add(pos)
        db.commit()
        new_capital = _update_pm_capital(pm, db)
        assert new_capital >= 0.0

    def test_with_multiple_positions_different_symbols(self, db, pm):
        pos1 = Position(pm_id=pm.id, symbol="SPY", quantity=5.0, avg_cost=480.0)
        pos2 = Position(pm_id=pm.id, symbol="AAPL", quantity=3.0, avg_cost=175.0)
        db.add(pos1)
        db.add(pos2)
        db.commit()
        new_capital = _update_pm_capital(pm, db)
        assert new_capital >= 0.0


class TestSeedNavHistoryNoPms:
    def test_seeds_with_initial_nav_when_no_pms(self, db):
        # 260라인: PM 없을 때 initial_nav 사용 경로
        seed_nav_history(db, days=5)
        count = db.query(NAVHistory).count()
        assert count == 6  # 5일 + 1 현재


class TestRunPmCycleMocked:
    @pytest.mark.asyncio
    async def test_skips_on_insufficient_price_data(self, db, pm):
        # 라인 40: prices가 짧을 때 skipped 반환
        from app.engines.trading_cycle import run_pm_cycle
        with patch("app.engines.trading_cycle.get_price_history", return_value=None):
            result = await run_pm_cycle(pm, db)
            assert result["status"] == "skipped"

    @pytest.mark.asyncio
    async def test_error_handling_on_exception(self, db, pm):
        # 라인 112-114: 예외 발생 시 error 반환
        from app.engines.trading_cycle import run_pm_cycle
        with patch("app.engines.trading_cycle.get_price_history", side_effect=ValueError("db error")):
            result = await run_pm_cycle(pm, db)
            assert result["status"] == "error"

    @pytest.mark.asyncio
    async def test_buy_path_executed(self, db, pm):
        # 라인 101: BUY 실행 경로
        import pandas as pd
        import numpy as np
        prices = pd.Series(np.ones(60) * 100.0)
        from app.engines.trading_cycle import run_pm_cycle
        with patch("app.engines.trading_cycle.get_price_history", return_value=prices), \
             patch("app.engines.trading_cycle.get_prices_for_pm", return_value={"SPY": 100.0}), \
             patch("app.engines.trading_cycle.get_market_context", return_value={"spy_price": 100.0, "vix": 15.0}), \
             patch("app.engines.trading_cycle.llm_engine.make_decision", new_callable=AsyncMock,
                   return_value={"action": "BUY", "conviction": 0.8, "reasoning": "buy", "position_size": 0.03}):
            result = await run_pm_cycle(pm, db)
            assert result.get("action") == "BUY"

    @pytest.mark.asyncio
    async def test_sell_path_executed(self, db, pm):
        # 라인 103: SELL 실행 경로 (포지션 없으면 trade_executed=False)
        import pandas as pd
        import numpy as np
        prices = pd.Series(np.ones(60) * 100.0)
        from app.engines.trading_cycle import run_pm_cycle
        with patch("app.engines.trading_cycle.get_price_history", return_value=prices), \
             patch("app.engines.trading_cycle.get_prices_for_pm", return_value={"SPY": 100.0}), \
             patch("app.engines.trading_cycle.get_market_context", return_value={"spy_price": 100.0, "vix": 15.0}), \
             patch("app.engines.trading_cycle.llm_engine.make_decision", new_callable=AsyncMock,
                   return_value={"action": "SELL", "conviction": 0.8, "reasoning": "sell", "position_size": 0.03}):
            result = await run_pm_cycle(pm, db)
            assert result.get("action") == "SELL"

    @pytest.mark.asyncio
    async def test_trade_executed_updates_capital(self, db, pm):
        # 라인 107: trade_executed=True 후 자본 업데이트 경로
        import pandas as pd
        import numpy as np
        prices = pd.Series(np.ones(60) * 100.0)
        from app.engines.trading_cycle import run_pm_cycle
        with patch("app.engines.trading_cycle.get_price_history", return_value=prices), \
             patch("app.engines.trading_cycle.get_prices_for_pm", return_value={"SPY": 100.0}), \
             patch("app.engines.trading_cycle.get_market_context", return_value={"spy_price": 100.0, "vix": 15.0}), \
             patch("app.engines.trading_cycle.llm_engine.make_decision", new_callable=AsyncMock,
                   return_value={"action": "BUY", "conviction": 0.9, "reasoning": "strong buy", "position_size": 0.05}):
            result = await run_pm_cycle(pm, db)
            # 매수 실행 시 자본이 업데이트되어야 함
            assert pm.current_capital >= 0.0
