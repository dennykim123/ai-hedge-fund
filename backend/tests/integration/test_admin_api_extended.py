"""admin API 추가 통합 테스트 - 미커버 엔드포인트 전체"""

from fastapi.testclient import TestClient
from app.main import app
from app.models.nav_history import NAVHistory
from app.models.trade import Trade

client = TestClient(app)


class TestAnalyticsEndpoints:
    def test_conviction_returns_200(self):
        r = client.get("/api/fund/analytics/conviction")
        assert r.status_code == 200

    def test_conviction_has_buckets(self):
        data = client.get("/api/fund/analytics/conviction").json()
        assert "buckets" in data
        assert len(data["buckets"]) == 5

    def test_conviction_bucket_fields(self):
        data = client.get("/api/fund/analytics/conviction").json()
        b = data["buckets"][0]
        assert "range" in b
        assert "total" in b
        assert "accuracy" in b

    def test_positions_analytics_returns_200(self):
        r = client.get("/api/fund/analytics/positions")
        assert r.status_code == 200

    def test_positions_analytics_has_key(self):
        data = client.get("/api/fund/analytics/positions").json()
        assert "pm_positions" in data

    def test_tools_returns_200(self):
        r = client.get("/api/fund/analytics/tools")
        assert r.status_code == 200

    def test_tools_has_key(self):
        data = client.get("/api/fund/analytics/tools").json()
        assert "tools" in data

    def test_performance_returns_200(self):
        r = client.get("/api/fund/analytics/performance")
        assert r.status_code == 200

    def test_performance_has_fields(self):
        data = client.get("/api/fund/analytics/performance").json()
        assert "fund_sharpe" in data
        assert "fund_sortino" in data
        assert "fund_mdd" in data

    def test_backtest_returns_200(self):
        r = client.get("/api/fund/analytics/backtest")
        assert r.status_code == 200

    def test_backtest_has_key(self):
        data = client.get("/api/fund/analytics/backtest").json()
        assert "backtest_results" in data


class TestStrategicEndpoints:
    def test_thesis_health_returns_200(self):
        r = client.get("/api/fund/strategic/thesis-health")
        assert r.status_code == 200

    def test_thesis_health_has_fields(self):
        data = client.get("/api/fund/strategic/thesis-health").json()
        assert "active" in data
        assert "flagged" in data
        assert "invalidated" in data
        assert "theses" in data

    def test_thesis_status_values_valid(self):
        data = client.get("/api/fund/strategic/thesis-health").json()
        valid = {"active", "flagged", "invalidated"}
        for t in data["theses"]:
            assert t["status"] in valid

    def test_rebalance_status_returns_200(self):
        r = client.get("/api/fund/strategic/rebalance-status")
        assert r.status_code == 200

    def test_rebalance_status_fields(self):
        data = client.get("/api/fund/strategic/rebalance-status").json()
        assert "in_progress" in data
        assert "last_rebalance" in data
        assert "progress_pct" in data

    def test_rebalance_status_with_nav(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(NAVHistory(nav=1_000_000.0, daily_return=0.001))
        db.commit()
        db.close()

        data = client.get("/api/fund/strategic/rebalance-status").json()
        assert data["last_rebalance"] is not None

    def test_social_signals_returns_200(self):
        r = client.get("/api/fund/strategic/social-signals")
        assert r.status_code == 200

    def test_social_signals_has_fields(self):
        data = client.get("/api/fund/strategic/social-signals").json()
        assert "signals" in data
        assert "tipping_points" in data
        assert "timestamp" in data

    def test_strategic_overview_with_nav(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(NAVHistory(nav=1_010_000.0, daily_return=0.002))
        db.commit()
        db.close()

        data = client.get("/api/fund/strategic/overview").json()
        assert data["regime"] in ("bull", "bear", "neutral")
        assert 0.0 <= data["regime_confidence"] <= 1.0


class TestRiskEndpoints:
    def test_risk_decisions_returns_200(self):
        r = client.get("/api/fund/risk/decisions")
        assert r.status_code == 200

    def test_risk_decisions_has_key(self):
        data = client.get("/api/fund/risk/decisions").json()
        assert "decisions" in data

    def test_risk_negotiations_returns_200(self):
        r = client.get("/api/fund/risk/negotiations")
        assert r.status_code == 200

    def test_risk_negotiations_has_key(self):
        data = client.get("/api/fund/risk/negotiations").json()
        assert "negotiations" in data


class TestSystemEndpoints:
    def test_order_pipeline_returns_200(self):
        r = client.get("/api/fund/order-pipeline/stats")
        assert r.status_code == 200

    def test_order_pipeline_fields(self):
        data = client.get("/api/fund/order-pipeline/stats").json()
        assert "pending" in data
        assert "executing" in data
        assert "completed_24h" in data
        assert "rejected_24h" in data

    def test_soq_status_returns_200(self):
        r = client.get("/api/fund/soq/status")
        assert r.status_code == 200

    def test_soq_status_fields(self):
        data = client.get("/api/fund/soq/status").json()
        assert "queue_depth" in data
        assert "avg_latency_ms" in data
        assert "orders_today" in data

    def test_executions_recent_returns_200(self):
        r = client.get("/api/fund/executions/recent")
        assert r.status_code == 200

    def test_executions_with_data(self):
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

        data = client.get("/api/fund/executions/recent").json()
        assert len(data["executions"]) >= 1
        e = data["executions"][0]
        assert "id" in e
        assert "symbol" in e
        assert "action" in e


class TestDashboardActivityFeedWithData:
    def test_activity_feed_with_trade(self):
        from tests.conftest import TestSession
        db = TestSession()
        db.add(Trade(
            pm_id="council",
            symbol="AAPL",
            action="SELL",
            quantity=3.0,
            price=175.0,
            conviction_score=0.6,
            reasoning="Sell signal",
        ))
        db.commit()
        db.close()

        data = client.get("/api/fund/activity-feed").json()
        assert len(data["items"]) >= 1
        item = data["items"][0]
        assert "summary" in item
        assert "details" in item
        assert "type" in item
