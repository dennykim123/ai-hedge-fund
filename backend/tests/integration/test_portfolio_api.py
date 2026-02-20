"""admin portfolio API 통합 테스트"""

from fastapi.testclient import TestClient

from app.main import app
from app.models.position import Position
from app.models.trade import Trade

client = TestClient(app)


class TestTradesEndpoint:
    def test_returns_200(self):
        r = client.get("/api/fund/trades")
        assert r.status_code == 200

    def test_has_trades_key(self):
        data = client.get("/api/fund/trades").json()
        assert "trades" in data

    def test_trade_fields(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Trade(
            pm_id="atlas",
            symbol="AAPL",
            action="BUY",
            quantity=3.0,
            price=175.0,
            conviction_score=0.8,
            reasoning="Test",
        ))
        db.commit()
        db.close()

        data = client.get("/api/fund/trades").json()
        trades = data["trades"]
        assert len(trades) >= 1
        t = trades[0]
        assert "pm_id" in t
        assert "symbol" in t
        assert "action" in t
        assert "value" in t
        assert "sector" in t

    def test_limit_param(self):
        r = client.get("/api/fund/trades?limit=5")
        assert r.status_code == 200
        data = r.json()
        assert len(data["trades"]) <= 5


class TestHeatmapEndpoint:
    def test_returns_200(self):
        r = client.get("/api/fund/heatmap")
        assert r.status_code == 200

    def test_has_sectors_and_nav(self):
        data = client.get("/api/fund/heatmap").json()
        assert "sectors" in data
        assert "total_nav" in data

    def test_with_positions(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Position(pm_id="atlas", symbol="AAPL", quantity=10.0, avg_cost=175.0))
        db.add(Position(pm_id="council", symbol="SPY", quantity=5.0, avg_cost=480.0))
        db.commit()
        db.close()

        data = client.get("/api/fund/heatmap").json()
        sectors = data["sectors"]
        assert len(sectors) >= 1
        s = sectors[0]
        assert "sector" in s
        assert "total_value" in s
        assert "pct" in s


class TestExposureEndpoint:
    def test_returns_200(self):
        r = client.get("/api/fund/exposure")
        assert r.status_code == 200

    def test_has_net_exposure(self):
        data = client.get("/api/fund/exposure").json()
        assert "net_exposure" in data

    def test_net_exposure_fields(self):
        data = client.get("/api/fund/exposure").json()
        net = data["net_exposure"]
        assert "long" in net
        assert "short" in net
        assert "net" in net
        assert "gross" in net

    def test_with_long_position(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Position(pm_id="atlas", symbol="SPY", quantity=10.0, avg_cost=480.0))
        db.commit()
        db.close()

        data = client.get("/api/fund/exposure").json()
        assert data["net_exposure"]["long"] > 0

    def test_pm_exposure_listed(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Position(pm_id="atlas", symbol="MSFT", quantity=5.0, avg_cost=415.0))
        db.commit()
        db.close()

        data = client.get("/api/fund/exposure").json()
        assert "pm_exposure" in data
        pm_ids = [p["pm_id"] for p in data["pm_exposure"]]
        assert "atlas" in pm_ids


class TestPositionsBreakdownExtended:
    def test_breakdown_sector_classification(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Position(pm_id="satoshi", symbol="BTC-USD", quantity=1.0, avg_cost=65000.0))
        db.commit()
        db.close()

        data = client.get("/api/fund/positions/breakdown").json()
        positions = data["positions"]
        btc = next((p for p in positions if p["symbol"] == "BTC-USD"), None)
        assert btc is not None
        assert btc["sector"] == "Crypto"

    def test_pct_of_nav_calculated(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Position(pm_id="atlas", symbol="GLD", quantity=10.0, avg_cost=185.0))
        db.commit()
        db.close()

        data = client.get("/api/fund/positions/breakdown").json()
        positions = data["positions"]
        assert len(positions) >= 1
        for p in positions:
            assert "pct_of_nav" in p


class TestPmPerformanceAdminEndpoint:
    def test_returns_200(self):
        r = client.get("/api/fund/pm-performance")
        assert r.status_code == 200

    def test_all_pms_present(self):
        data = client.get("/api/fund/pm-performance").json()
        assert len(data["pms"]) == 11

    def test_sorted_descending(self):
        data = client.get("/api/fund/pm-performance").json()
        pms = data["pms"]
        for i in range(len(pms) - 1):
            assert pms[i]["itd_return"] >= pms[i + 1]["itd_return"]
