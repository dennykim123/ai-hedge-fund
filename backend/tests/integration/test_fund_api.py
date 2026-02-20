from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_fund_stats():
    response = client.get("/api/fund/stats")
    assert response.status_code == 200
    data = response.json()
    assert "nav" in data
    assert "active_pms" in data
    assert "total_positions" in data
    assert "today_return" in data
    assert "itd_return" in data


def test_get_pms_list():
    response = client.get("/api/fund/pms")
    assert response.status_code == 200
    data = response.json()
    assert len(data) == 11
    # PMs are ordered by id alphabetically
    assert data[0]["id"] == "asiatiger"
