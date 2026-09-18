"""Focused tests for the initial system API surface."""

from fastapi.testclient import TestClient

from app.main import create_app


def test_liveness_returns_service_version_and_request_id() -> None:
    client = TestClient(create_app())

    response = client.get("/api/v1/health/live")

    assert response.status_code == 200
    assert response.json() == {
        "status": "ok",
        "service": "4by4-forhire-api",
        "version": "0.1.0",
    }
    assert response.headers["x-request-id"].startswith("req_")


def test_readiness_reports_only_implemented_checks() -> None:
    client = TestClient(create_app())

    response = client.get("/api/v1/health/ready")

    assert response.status_code == 200
    assert response.json()["checks"] == {"application": "ok"}


def test_version_returns_public_release_version() -> None:
    client = TestClient(create_app())

    response = client.get("/api/v1/version")

    assert response.status_code == 200
    assert response.json() == {
        "service": "4by4-forhire-api",
        "version": "0.1.0",
    }


def test_safe_request_id_is_preserved() -> None:
    client = TestClient(create_app())

    response = client.get(
        "/api/v1/health/live",
        headers={"X-Request-ID": "client-request_123"},
    )

    assert response.headers["x-request-id"] == "client-request_123"


def test_unsafe_request_id_is_replaced() -> None:
    client = TestClient(create_app())

    response = client.get(
        "/api/v1/health/live",
        headers={"X-Request-ID": "unsafe request id\nvalue"},
    )

    assert response.headers["x-request-id"].startswith("req_")
    assert response.headers["x-request-id"] != "unsafe request id\nvalue"


def test_not_found_uses_stable_error_envelope() -> None:
    client = TestClient(create_app())

    response = client.get("/api/v1/does-not-exist")

    assert response.status_code == 404
    assert response.json() == {
        "error": {
            "code": "HTTP_404",
            "message": "Not Found",
            "request_id": response.headers["x-request-id"],
            "details": {},
        }
    }
