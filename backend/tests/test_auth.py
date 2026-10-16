from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
import pytest
from fastapi import Depends, FastAPI
from fastapi.testclient import TestClient
from pydantic import SecretStr

from backend.auth import ALGORITHM, require_auth, router
from backend.config import settings

ACCESS_CODE = "open-sesame"
JWT_SECRET = "test-secret-that-is-at-least-32-bytes-long"

# Standalone app so the tests don't depend on the database engine in backend.main.
app = FastAPI()
app.include_router(router)


@app.get("/protected")
def protected(_: Annotated[None, Depends(require_auth)]):
    return {"ok": True}


client = TestClient(app)


@pytest.fixture(autouse=True)
def jwt_secret(monkeypatch):
    monkeypatch.setattr(settings, "jwt_secret", SecretStr(JWT_SECRET))


@pytest.fixture
def gate_on(monkeypatch):
    monkeypatch.setattr(settings, "access_code", SecretStr(ACCESS_CODE))


@pytest.fixture(params=[None, SecretStr("")], ids=["unset", "empty"])
def gate_off(request, monkeypatch):
    monkeypatch.setattr(settings, "access_code", request.param)


def login(code: str):
    return client.post("/auth/login", json={"access_code": code})


def auth_header(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_status_reports_gate_on(gate_on):
    assert client.get("/auth/status").json() == {"auth_required": True}


def test_status_reports_gate_off(gate_off):
    assert client.get("/auth/status").json() == {"auth_required": False}


def test_login_with_correct_code_returns_token(gate_on):
    response = login(ACCESS_CODE)

    assert response.status_code == 200
    body = response.json()
    assert body["token_type"] == "bearer"
    assert body["expires_in"] == settings.access_token_expire_minutes * 60
    jwt.decode(body["access_token"], JWT_SECRET, algorithms=[ALGORITHM])


def test_login_with_wrong_code_is_rejected(gate_on):
    response = login("wrong")

    assert response.status_code == 401
    assert response.json() == {"detail": "Invalid access code."}


def test_login_without_code_is_invalid(gate_on):
    assert client.post("/auth/login", json={}).status_code == 422


def test_login_accepts_any_code_when_gate_off(gate_off):
    assert login("anything").status_code == 200


def test_protected_route_accepts_issued_token(gate_on):
    token = login(ACCESS_CODE).json()["access_token"]

    assert client.get("/protected", headers=auth_header(token)).status_code == 200


def test_protected_route_rejects_missing_token(gate_on):
    response = client.get("/protected")

    assert response.status_code == 401
    assert response.headers["WWW-Authenticate"] == "Bearer"


@pytest.mark.parametrize(
    "token",
    [
        "not-a-jwt",
        jwt.encode(
            {"exp": datetime.now(UTC) + timedelta(hours=1)},
            "a-different-secret-also-32-bytes-long",
            algorithm=ALGORITHM,
        ),
        jwt.encode(
            {"exp": datetime.now(UTC) - timedelta(seconds=1)},
            JWT_SECRET,
            algorithm=ALGORITHM,
        ),
    ],
    ids=["malformed", "wrong-signature", "expired"],
)
def test_protected_route_rejects_bad_token(gate_on, token):
    assert client.get("/protected", headers=auth_header(token)).status_code == 401


def test_protected_route_is_open_when_gate_off(gate_off):
    assert client.get("/protected").status_code == 200
