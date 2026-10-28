from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_root():
    response = client.get("/")
    assert response.status_code == 200
    data = response.json()
    assert data["message"] == "Wind Forecast API"


def test_health():
    response = client.get("/api/v1/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "wind-forecast-api"}


def test_health_db_fails_without_db():
    """DB health check returns 500 when no database is reachable."""
    response = client.get("/api/v1/health/db")
    assert response.status_code == 500
