"""Typed application configuration."""

from datetime import UTC, datetime, timedelta
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
    privacy_contact_email: str = "support@4by4softwares.com"
    skip_identity_verification: bool = False
    verification_bypass_expires_at: datetime | None = None
    s3_endpoint_url: str | None = None
    s3_region: str = "ap-south-2"
    s3_bucket: str = "forhire-local"
    s3_access_key_id: str | None = None
    s3_secret_access_key: str | None = None
    cors_origins: str = Field(
        default=(
            "http://localhost:3000,http://localhost:3001,"
            "http://127.0.0.1:3000,http://127.0.0.1:3001"
        ),
        description="Comma-separated exact browser origins",
    )
    demo_mobile_number: str | None = Field(
        default="+919999999999",
        description=(
            "Mobile number of the demo/seed login. Seed-flagged listings are only "
            "visible to this account. Set to null to disable seed-data visibility "
            "entirely once the demo account is retired."
        ),
    )
    allow_loopback_database: bool = Field(
        default=False,
        description=(
            "Explicit opt-in required to run a shared environment against a "
            "loopback-bound database URL (e.g. a dedicated Postgres container on "
            "the same host). Defaults to False so accidental dev-default URLs are "
            "still rejected outside development."
        ),
    )
    store_limit_per_user: int = Field(
        default=5,
        ge=1,
        le=50,
        description="Maximum number of active or paused stores a single user may own.",
    )

    @model_validator(mode="after")
    def reject_local_database_credentials_outside_development(self) -> "Settings":
        """Prevent local defaults from reaching shared environments, unless explicitly permitted."""
        if (
            self.app_env in {"staging", "production"}
            and not self.allow_loopback_database
            and ("localhost" in self.database_url or "127.0.0.1" in self.database_url)
        ):
            raise ValueError(
                "Shared environments require a non-local database URL, or explicit "
                "allow_loopback_database=true when intentionally running Postgres on the same host."
            )
        return self

    @model_validator(mode="after")
    def reject_verification_bypass_outside_development(self) -> "Settings":
        """Require an explicit, short-lived expiry for a shared-environment bypass."""
        if not self.skip_identity_verification or self.app_env in {"development", "test"}:
            return self
        expiry = self.verification_bypass_expires_at
        if expiry is None:
            raise ValueError("Shared-environment verification bypass requires an expiry")
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        if expiry <= now:
            raise ValueError("Verification bypass expiry must be in the future")
        if expiry > now + timedelta(days=120):
            raise ValueError("Verification bypass cannot be enabled for more than 120 days")
        return self

    @property
    def verification_bypass_active(self) -> bool:
        if not self.skip_identity_verification:
            return False
        if self.app_env in {"development", "test"}:
            return True
        expiry = self.verification_bypass_expires_at
        if expiry is None:
            return False
        if expiry.tzinfo is None:
            expiry = expiry.replace(tzinfo=UTC)
        return expiry > datetime.now(UTC)

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
