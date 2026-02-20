from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_intelligence_brief():
    r = client.get("/api/fund/intelligence/brief")
    assert r.status_code == 200
    assert "brief" in r.json()


def test_activity_feed():
    r = client.get("/api/fund/activity-feed?limit=10")
    assert r.status_code == 200
    assert "items" in r.json()


def test_risk_overview():
    r = client.get("/api/fund/risk/overview")
    assert r.status_code == 200
    data = r.json()
    assert "exposure" in data
    assert "gross_pct" in data["exposure"]


def test_analytics_alpha_has_upgrade_fields():
    r = client.get("/api/fund/analytics/alpha")
    assert r.status_code == 200
    data = r.json()
    if data["leaderboard"]:
        pm = data["leaderboard"][0]
        assert "sharpe" in pm
        assert "sortino" in pm
        assert "mdd" in pm


def test_strategic_overview():
    r = client.get("/api/fund/strategic/overview")
    assert r.status_code == 200
    assert "pms" in r.json()


def test_system_overview():
    r = client.get("/api/fund/system/overview")
    assert r.status_code == 200
    assert "services" in r.json()


def test_positions_breakdown():
    r = client.get("/api/fund/positions/breakdown")
    assert r.status_code == 200
    assert "positions" in r.json()


def test_analytics_provider():
    r = client.get("/api/fund/analytics/provider")
    assert r.status_code == 200
    assert "providers" in r.json()


def test_social_freshness():
    r = client.get("/api/fund/social/freshness")
    assert r.status_code == 200
    assert "reddit" in r.json()
