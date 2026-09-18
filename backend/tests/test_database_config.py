"""Focused tests for database configuration."""

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
