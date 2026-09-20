"""Focused tests for database configuration."""

from datetime import UTC, datetime, timedelta

import pytest
from pydantic import ValidationError

from app.core.config import Settings
from app.core.database import create_database_engine


def test_database_engine_uses_postgresql_and_pre_ping() -> None:
    settings = Settings(database_url="postgresql+psycopg://localhost/forhire_test", _env_file=None)

    engine = create_database_engine(settings)

    assert engine.url.drivername == "postgresql+psycopg"
    assert engine.pool._pre_ping is True
    engine.dispose()


def test_production_rejects_local_database_credentials() -> None:
    with pytest.raises(ValidationError, match="non-local database URL"):
        Settings(
            app_env="production",
            database_url="postgresql+psycopg://localhost/forhire_test",
            _env_file=None,
        )


def test_production_verification_bypass_requires_short_lived_expiry() -> None:
    with pytest.raises(ValidationError, match="requires an expiry"):
        Settings(
            app_env="production",
            database_url="postgresql+psycopg://db.example/forhire",
            skip_identity_verification=True,
            _env_file=None,
        )

    settings = Settings(
        app_env="production",
        database_url="postgresql+psycopg://db.example/forhire",
        skip_identity_verification=True,
        verification_bypass_expires_at=datetime.now(UTC) + timedelta(days=30),
        _env_file=None,
    )
    assert settings.verification_bypass_active is True


def test_expired_production_verification_bypass_is_rejected() -> None:
    with pytest.raises(ValidationError, match="must be in the future"):
        Settings(
            app_env="production",
            database_url="postgresql+psycopg://db.example/forhire",
            skip_identity_verification=True,
            verification_bypass_expires_at=datetime.now(UTC) - timedelta(minutes=1),
            _env_file=None,
        )
