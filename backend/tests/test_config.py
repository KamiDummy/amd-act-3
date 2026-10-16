from backend.config import Settings


def test_empty_jwt_secret_is_replaced_with_random_one(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "")

    secret = Settings(_env_file=None).jwt_secret.get_secret_value()  # type: ignore

    assert len(secret) >= 32


def test_jwt_secret_from_env_is_kept(monkeypatch):
    monkeypatch.setenv("JWT_SECRET", "configured-secret")

    secret = Settings(_env_file=None).jwt_secret.get_secret_value()  # type: ignore

    assert secret == "configured-secret"
