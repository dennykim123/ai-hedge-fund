from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_get_pm_detail():
    response = client.get("/api/pm/atlas")
    assert response.status_code == 200
    data = response.json()
    assert data["id"] == "atlas"
    assert data["name"] == "Atlas"
    assert "itd_return" in data
    assert "current_capital" in data


def test_get_pm_not_found():
    response = client.get("/api/pm/nonexistent")
    assert response.status_code == 404
