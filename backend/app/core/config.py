"""Typed application configuration."""

from functools import lru_cache

from pydantic import Field, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Environment-backed runtime settings."""

    model_config = SettingsConfigDict(
        env_file=("../.env", ".env"),
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_env: str = "development"
    service_name: str = "4by4-forhire-api"
    api_v1_prefix: str = "/api/v1"
    log_level: str = "INFO"
    docs_enabled: bool = True
    database_url: str
    session_secret: str = Field(min_length=32)
    access_token_ttl_minutes: int = Field(default=15, ge=5, le=60)
    refresh_token_ttl_days: int = Field(default=30, ge=1, le=90)
    otp_ttl_minutes: int = Field(default=10, ge=2, le=15)
    otp_max_attempts: int = Field(default=5, ge=3, le=10)
    smtp_host: str | None = None
    smtp_port: int = Field(default=18025, ge=1, le=65535)
    verification_from_email: str = "no-reply@forhire.local"
    cors_origins: str = Field(
        default=(
            "http://localhost:3000,http://localhost:3001,"
            "http://127.0.0.1:3000,http://127.0.0.1:3001"
        ),
        description="Comma-separated exact browser origins",
    )

    @model_validator(mode="after")
    def reject_local_database_credentials_outside_development(self) -> "Settings":
        """Prevent local defaults from reaching shared environments."""
        if self.app_env in {"staging", "production"} and (
            "localhost" in self.database_url or "127.0.0.1" in self.database_url
        ):
            raise ValueError("Shared environments require a non-local database URL")
        return self

    @property
    def allowed_origins(self) -> list[str]:
        """Return normalized exact CORS origins."""
        return [origin.strip() for origin in self.cors_origins.split(",") if origin.strip()]

    @property
    def secure_cookies(self) -> bool:
        """Require HTTPS cookies outside local development and tests."""
        return self.app_env not in {"development", "test"}


@lru_cache
def get_settings() -> Settings:
    """Return one immutable configuration instance per process."""
    return Settings()
