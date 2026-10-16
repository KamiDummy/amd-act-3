import secrets
from pathlib import Path

from pydantic import Field, SecretStr, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env")

    database_url: str

    # Shared passcode for entering the app. Unset or empty disables the login gate.
    access_code: SecretStr | None = None
    # Signs session tokens. Random per process when unset, so a restart signs everyone out.
    jwt_secret: SecretStr = Field(
        default_factory=lambda: SecretStr(secrets.token_urlsafe(32))
    )
    access_token_expire_minutes: int = 12 * 60

    cors_origins: list[str] = ["http://localhost:5173"]

    # Where uploaded PDFs are saved, relative to the directory the backend runs from.
    storage_dir: Path = Path("storage")

    # AMD Token Factory, an OpenAI-compatible LLM API. Unset key disables LLM features.
    token_factory_api_key: SecretStr | None = None
    token_factory_base_url: str = "https://developer.amd.com.cn/radeon/api/v1"
    token_factory_model: str = "Gemma-4-31B-IT"

    @field_validator("jwt_secret", mode="before")
    @classmethod
    def generate_secret_if_empty(cls, value: object) -> object:
        # "JWT_SECRET=" in .env arrives as "", which must not become the signing key.
        return value or secrets.token_urlsafe(32)

    @property
    def auth_enabled(self) -> bool:
        return bool(self.access_code and self.access_code.get_secret_value())

    @property
    def llm_enabled(self) -> bool:
        return bool(
            self.token_factory_api_key and self.token_factory_api_key.get_secret_value()
        )


settings = Settings()  # type: ignore Loaded from .env
