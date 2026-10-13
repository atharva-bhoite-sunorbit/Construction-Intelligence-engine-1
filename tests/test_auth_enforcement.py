"""Login is mandatory: no request is silently treated as a default user."""
from datetime import timedelta

import pytest
from fastapi.routing import APIRoute
from fastapi.testclient import TestClient

from backend.app.main import app
from backend.app.utils.security import create_access_token
from tests.conftest import TEST_PASSWORD, auth_headers

client = TestClient(app)

PUBLIC_PATHS = {"/", "/health", "/api/auth/login", "/api/auth/token", "/api/auth/demo-roles", "/api/auth/demo-login"}
PUBLIC_PREFIXES = ("/api/v1/geotechnical",)  # external API: authenticated by API key, not user login


def _protected_routes():
    for route in app.routes:
        if not isinstance(route, APIRoute):
            continue
        if route.path in PUBLIC_PATHS or route.path.startswith(PUBLIC_PREFIXES):
            continue
        for method in route.methods - {"HEAD", "OPTIONS"}:
            yield method, route.path


def _concrete(path: str) -> str:
    import re

    return re.sub(r"\{[^}]+\}", "1", path)


@pytest.mark.parametrize("method,path", sorted(set(_protected_routes())))
def test_every_internal_route_rejects_anonymous_requests(method, path):
    res = client.request(method, _concrete(path))
    assert res.status_code == 401, f"{method} {path} answered {res.status_code} without a token"


def test_public_endpoints_stay_open():
    assert client.get("/health").status_code == 200
    bad = client.post("/api/auth/login", json={"email": "nobody@example.com", "password": "x"})
    assert bad.status_code == 401  # reached the handler (wrong credentials), not blocked by a guard


def test_login_returns_working_token():
    res = client.post("/api/auth/login", json={"email": "pm@construction.ai", "password": TEST_PASSWORD})
    assert res.status_code == 200
    token = res.json()["access_token"]
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "pm@construction.ai"


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        create_access_token({"sub": "ghost@construction.ai", "role": "Admin"}),  # user does not exist
        create_access_token({"sub": "pm@construction.ai"}, expires_delta=timedelta(minutes=-5)),  # expired
    ],
    ids=["garbage", "unknown-user", "expired"],
)
def test_invalid_tokens_are_rejected(token):
    res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert res.status_code == 401


def test_anonymous_request_is_not_the_pm_user():
    assert client.get("/api/projects").status_code == 401


def test_register_requires_admin():
    payload = {"email": "new.user@construction.ai", "password": "pw-123456", "full_name": "New User", "role": "Site Engineer"}
    assert client.post("/api/auth/register", json=payload).status_code == 401
    assert client.post("/api/auth/register", json=payload, headers=auth_headers("eng@construction.ai")).status_code == 403
    ok = client.post("/api/auth/register", json=payload, headers=auth_headers("admin@construction.ai"))
    assert ok.status_code == 200


def test_cors_does_not_allow_arbitrary_origins():
    res = client.options(
        "/api/projects",
        headers={"Origin": "https://evil.example", "Access-Control-Request-Method": "GET"},
    )
    assert res.headers.get("access-control-allow-origin") != "*"
    assert "evil.example" not in res.headers.get("access-control-allow-origin", "")
