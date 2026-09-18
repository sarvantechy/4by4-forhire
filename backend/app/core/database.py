"""PostgreSQL engine and session configuration."""

from collections.abc import Iterator
from functools import lru_cache

from fastapi import Request
from sqlalchemy import Engine, create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.core.config import Settings


class Base(DeclarativeBase):
    """Declarative base for all domain models."""


def create_database_engine(settings: Settings) -> Engine:
    """Create the runtime PostgreSQL engine without opening a connection."""
    return create_engine(settings.database_url, pool_pre_ping=True)


def create_session_factory(engine: Engine) -> sessionmaker[Session]:
    """Create sessions with explicit transaction ownership in services."""
    return sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)


def session_scope(session_factory: sessionmaker[Session]) -> Iterator[Session]:
    """Yield one session and always close it after request handling."""
    with session_factory() as session:
        yield session


@lru_cache
def get_engine(database_url: str) -> Engine:
    """Return one engine for a configured database URL."""
    return create_engine(database_url, pool_pre_ping=True)


def get_db(request: Request) -> Iterator[Session]:
    """Provide one request-scoped database session."""
    settings = request.app.state.settings
    factory = create_session_factory(get_engine(settings.database_url))
    yield from session_scope(factory)
