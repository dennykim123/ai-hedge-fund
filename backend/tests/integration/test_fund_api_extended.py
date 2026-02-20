"""fund API 추가 통합 테스트 (NAV history, pm-performance 등)"""

from fastapi.testclient import TestClient

from app.main import app
from app.models.nav_history import NAVHistory
from app.models.trade import Trade

client = TestClient(app)


class TestNavHistoryFundEndpoint:
    def test_returns_200(self):
        r = client.get("/api/fund/nav/history")
        assert r.status_code == 200

    def test_has_history_and_count(self):
        data = client.get("/api/fund/nav/history").json()
        assert "history" in data
        assert "count" in data

    def test_count_matches_history(self):
        data = client.get("/api/fund/nav/history").json()
        assert data["count"] == len(data["history"])

    def test_history_item_fields(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(NAVHistory(nav=1_000_000.0, daily_return=0.005))
        db.commit()
        db.close()

        data = client.get("/api/fund/nav/history").json()
        if data["history"]:
            item = data["history"][0]
            assert "date" in item
            assert "nav" in item
            assert "daily_return_pct" in item
            assert "cumulative_return_pct" in item

    def test_limit_param(self):
        r = client.get("/api/fund/nav/history?limit=10")
        assert r.status_code == 200
        data = r.json()
        assert len(data["history"]) <= 10


class TestPmPerformanceEndpoint:
    def test_returns_200(self):
        r = client.get("/api/fund/pm-performance")
        assert r.status_code == 200

    def test_has_pms_key(self):
        data = client.get("/api/fund/pm-performance").json()
        assert "pms" in data

    def test_pms_sorted_by_itd_return(self):
        data = client.get("/api/fund/pm-performance").json()
        pms = data["pms"]
        if len(pms) >= 2:
            for i in range(len(pms) - 1):
                assert pms[i]["itd_return"] >= pms[i + 1]["itd_return"]

    def test_pm_has_required_fields(self):
        data = client.get("/api/fund/pm-performance").json()
        pms = data["pms"]
        if pms:
            pm = pms[0]
            assert "id" in pm
            assert "name" in pm
            assert "current_capital" in pm
            assert "itd_return" in pm
            assert "trade_count" in pm

    def test_trade_count_with_trades(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Trade(
            pm_id="atlas",
            symbol="SPY",
            action="BUY",
            quantity=5.0,
            price=480.0,
            conviction_score=0.7,
            reasoning="Test",
        ))
        db.commit()
        db.close()

        data = client.get("/api/fund/pm-performance").json()
        atlas = next((p for p in data["pms"] if p["id"] == "atlas"), None)
        assert atlas is not None
        assert atlas["trade_count"] >= 1


class TestFundStatsWithNavData:
    def test_today_return_with_nav_record(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(NAVHistory(nav=1_000_000.0, daily_return=0.01))
        db.commit()
        db.close()

        data = client.get("/api/fund/stats").json()
        assert "today_return" in data
        assert "prior_day_return" in data

    def test_two_nav_records_sets_prior_day(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(NAVHistory(nav=990_000.0, daily_return=-0.01))
        db.add(NAVHistory(nav=1_000_000.0, daily_return=0.01))
        db.commit()
        db.close()

        data = client.get("/api/fund/stats").json()
        assert data["prior_day_return"] != 0.0
