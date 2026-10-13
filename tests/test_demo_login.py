"""Demo mode: one-tap sign-in by role, with the server choosing the account. Off in production."""
import pytest
from fastapi.testclient import TestClient

from backend.app.main import app

client = TestClient(app)


def test_roles_are_listed_without_any_email_or_password():
    res = client.get("/api/auth/demo-roles")
    assert res.status_code == 200
    roles = res.json()
    assert {r["key"] for r in roles} == {"site-engineer-a", "site-engineer-b", "project-manager", "director", "admin"}
    for r in roles:
        assert set(r) == {"key", "label", "description"}   # nothing secret leaves the server


@pytest.mark.parametrize("key,role", [
    ("site-engineer-a", "Site Engineer"), ("project-manager", "Project Manager"),
    ("director", "Top Management"), ("admin", "Admin"),
])
def test_tapping_a_role_logs_you_in_as_that_role(key, role):
    res = client.post("/api/auth/demo-login", json={"key": key})
    assert res.status_code == 200, res.text
    body = res.json()
    assert body["user"]["role"] == role
    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {body['access_token']}"})
    assert me.status_code == 200 and me.json()["role"] == role


def test_unknown_role_is_404():
    assert client.post("/api/auth/demo-login", json={"key": "superuser"}).status_code == 404


def test_demo_mode_can_be_switched_off(monkeypatch):
    monkeypatch.setenv("DEMO_MODE", "false")
    assert client.get("/api/auth/demo-roles").json() == []
    assert client.post("/api/auth/demo-login", json={"key": "admin"}).status_code == 404


def test_demo_mode_is_never_available_in_production(monkeypatch):
    from backend.app.api import auth as auth_module

    monkeypatch.setattr(auth_module, "APP_ENV", "production")
    for value in (None, "true", "1", "yes"):          # even if someone sets DEMO_MODE=true
        if value is None:
            monkeypatch.delenv("DEMO_MODE", raising=False)
        else:
            monkeypatch.setenv("DEMO_MODE", value)
        assert auth_module.demo_mode_enabled() is False
        assert client.get("/api/auth/demo-roles").json() == []
        assert client.post("/api/auth/demo-login", json={"key": "admin"}).status_code == 404
