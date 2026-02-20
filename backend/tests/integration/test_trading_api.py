"""trading API 통합 테스트"""

from fastapi.testclient import TestClient

from app.main import app
from app.models.nav_history import NAVHistory
from app.models.position import Position
from app.models.trade import Trade
from app.models.signal import Signal

client = TestClient(app)


def _get_db():
    """테스트 DB 세션 가져오기 (conftest override 사용)"""
    from tests.conftest import TestSession
    return TestSession()


class TestNavHistoryEndpoint:
    def test_returns_200(self):
        r = client.get("/api/trading/nav/history")
        assert r.status_code == 200

    def test_has_history_and_count(self):
        r = client.get("/api/trading/nav/history")
        data = r.json()
        assert "history" in data
        assert "count" in data

    def test_count_matches_history_length(self):
        r = client.get("/api/trading/nav/history")
        data = r.json()
        assert data["count"] == len(data["history"])

    def test_limit_param(self):
        # NAV 레코드 없으면 빈 리스트
        r = client.get("/api/trading/nav/history?limit=5")
        assert r.status_code == 200
        data = r.json()
        assert len(data["history"]) <= 5

    def test_history_with_data_has_cumulative_return(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(NAVHistory(nav=1_000_000.0, daily_return=0.0))
        db.add(NAVHistory(nav=1_010_000.0, daily_return=0.01))
        db.commit()
        db.close()

        r = client.get("/api/trading/nav/history")
        data = r.json()
        if data["history"]:
            assert "cumulative_return" in data["history"][0]


class TestNavSummaryEndpoint:
    def test_returns_200(self):
        r = client.get("/api/trading/nav/summary")
        assert r.status_code == 200

    def test_has_required_fields_empty_db(self):
        r = client.get("/api/trading/nav/summary")
        data = r.json()
        assert "current_nav" in data

    def test_has_all_fields_with_data(self):
        from tests.conftest import TestSession
        db = TestSession()
        for i in range(5):
            db.add(NAVHistory(nav=1_000_000.0 + i * 1000, daily_return=0.001))
        db.commit()
        db.close()

        r = client.get("/api/trading/nav/summary")
        data = r.json()
        assert "current_nav" in data
        assert "total_return_pct" in data
        assert "sharpe_ratio" in data
        assert "max_drawdown_pct" in data


class TestCycleRunEndpoint:
    def test_async_run_returns_started(self):
        r = client.post("/api/trading/cycle/run")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "started"

    def test_sync_run_returns_completed(self):
        r = client.post("/api/trading/cycle/run-sync")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "completed"
        assert "results" in data
        assert "nav" in data


class TestSignalsEndpoint:
    def test_returns_200(self):
        r = client.get("/api/trading/signals/recent")
        assert r.status_code == 200

    def test_has_signals_key(self):
        data = client.get("/api/trading/signals/recent").json()
        assert "signals" in data

    def test_signals_with_data(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Signal(
            pm_id="atlas",
            symbol="SPY",
            signal_type="composite",
            value=0.5,
            metadata_={"rsi": 45},
        ))
        db.commit()
        db.close()

        data = client.get("/api/trading/signals/recent").json()
        assert len(data["signals"]) >= 1
        s = data["signals"][0]
        assert "pm_id" in s
        assert "symbol" in s
        assert "value" in s

    def test_limit_param(self):
        r = client.get("/api/trading/signals/recent?limit=5")
        assert r.status_code == 200
        data = r.json()
        assert len(data["signals"]) <= 5


class TestPositionsEndpoint:
    def test_returns_200(self):
        r = client.get("/api/trading/positions/all")
        assert r.status_code == 200

    def test_has_positions_and_count(self):
        data = client.get("/api/trading/positions/all").json()
        assert "positions" in data
        assert "total_count" in data

    def test_with_position_data(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Position(pm_id="atlas", symbol="SPY", quantity=10.0, avg_cost=480.0))
        db.commit()
        db.close()

        data = client.get("/api/trading/positions/all").json()
        assert data["total_count"] >= 1
        pos = data["positions"][0]
        assert "symbol" in pos
        assert "quantity" in pos
        assert "market_value" in pos


class TestTradesEndpoint:
    def test_returns_200(self):
        r = client.get("/api/trading/trades/recent")
        assert r.status_code == 200

    def test_has_trades_key(self):
        data = client.get("/api/trading/trades/recent").json()
        assert "trades" in data

    def test_with_trade_data(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Trade(
            pm_id="atlas",
            symbol="SPY",
            action="BUY",
            quantity=5.0,
            price=480.0,
            conviction_score=0.7,
            reasoning="Test trade",
        ))
        db.commit()
        db.close()

        data = client.get("/api/trading/trades/recent").json()
        assert len(data["trades"]) >= 1
        t = data["trades"][0]
        assert "action" in t
        assert "value" in t


class TestRiskConcentrationEndpoint:
    def test_returns_200(self):
        r = client.get("/api/trading/risk/concentration")
        assert r.status_code == 200

    def test_has_required_fields(self):
        data = client.get("/api/trading/risk/concentration").json()
        assert "total_nav" in data
        assert "symbol_exposure" in data
        assert "radar" in data

    def test_radar_has_metrics(self):
        data = client.get("/api/trading/risk/concentration").json()
        radar = data["radar"]
        assert "concentration" in radar
        assert "volatility" in radar
        assert "liquidity" in radar

    def test_with_positions_and_nav_covers_variance_path(self):
        # 214-215, 220-221, 231-233 라인: 포지션 + NAV returns 있을 때
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Position(pm_id="atlas", symbol="SPY", quantity=10.0, avg_cost=480.0))
        db.add(Position(pm_id="atlas", symbol="AAPL", quantity=5.0, avg_cost=175.0))
        for i in range(5):
            db.add(NAVHistory(nav=1_000_000.0 + i * 1000, daily_return=0.001 * (i + 1)))
        db.commit()
        db.close()

        data = client.get("/api/trading/risk/concentration").json()
        assert len(data["symbol_exposure"]) >= 1
        assert data["radar"]["volatility"] >= 0


class TestNavSummaryWithVariedData:
    def test_sharpe_ratio_computed_with_returns(self):
        # 68번 라인: std > 0 → sharpe 계산
        from tests.conftest import TestSession
        db = TestSession()
        for i, ret in enumerate([0.001, 0.005, -0.002, 0.003, 0.008, -0.001]):
            db.add(NAVHistory(nav=1_000_000.0 + i * 1000, daily_return=ret))
        db.commit()
        db.close()

        data = client.get("/api/trading/nav/summary").json()
        assert "sharpe_ratio" in data

    def test_mdd_computed_with_drawdown(self):
        # 80번 라인: dd > max_dd 업데이트
        from tests.conftest import TestSession
        db = TestSession()
        navs = [1_000_000, 1_100_000, 1_050_000, 950_000, 1_000_000]
        for i, nav in enumerate(navs):
            db.add(NAVHistory(nav=float(nav), daily_return=0.001 if i > 0 else 0.0))
        db.commit()
        db.close()

        data = client.get("/api/trading/nav/summary").json()
        assert data["max_drawdown_pct"] > 0
