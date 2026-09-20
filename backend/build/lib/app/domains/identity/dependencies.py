"""Authenticated actor resolution."""

import hashlib
import hmac
from dataclasses import dataclass
from datetime import UTC, datetime
from uuid import UUID

import jwt
from fastapi import Depends, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import APIError
from app.domains.identity.models import AuthSession, User

bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class ActorContext:
    user: User
    session: AuthSession


def require_actor(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> ActorContext:
    """Resolve the user and active session from a signed bearer token."""
    token = credentials.credentials if credentials else request.cookies.get("forhire_access")
    if not token:
        raise APIError(status_code=401, code="AUTH_REQUIRED", message="Sign in is required.")
    settings = request.app.state.settings
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=["HS256"])
        user_id = UUID(payload["sub"])
        session_id = UUID(payload["sid"])
    except (jwt.PyJWTError, KeyError, TypeError, ValueError):
        raise APIError(
            status_code=401,
            code="TOKEN_INVALID",
            message="The access token is invalid.",
        )
    auth_session = db.get(AuthSession, session_id)
    user = db.get(User, user_id)
    if (
        auth_session is None
        or user is None
        or auth_session.user_id != user.id
        or auth_session.revoked_at is not None
        or auth_session.expires_at <= datetime.now(UTC)
        or user.status != "active"
    ):
        raise APIError(status_code=401, code="SESSION_INVALID", message="The session is invalid.")
    return ActorContext(user=user, session=auth_session)


def require_csrf(
    request: Request,
    actor: ActorContext = Depends(require_actor),
) -> ActorContext:
    """Require CSRF validation only when browser cookies authenticate the request."""
    if request.headers.get("Authorization"):
        return actor
    supplied_token = request.headers.get("X-CSRF-Token", "")
    expected_hash = actor.session.csrf_token_hash
    supplied_hash = hashlib.sha256(supplied_token.encode()).hexdigest()
    if not expected_hash or not hmac.compare_digest(expected_hash, supplied_hash):
        raise APIError(
            status_code=403,
            code="CSRF_INVALID",
            message="The CSRF token is missing or invalid.",
        )
    return actor


def require_optional_actor(
    request: Request,
    credentials: HTTPAuthorizationCredentials | None = Depends(bearer),
    db: Session = Depends(get_db),
) -> ActorContext | None:
    """Resolve the actor if a valid bearer token/cookie is present, else return None.

    Used by public endpoints (like listing search) that behave the same for
    anonymous and signed-in users, but need to know the caller's identity for a
    narrow purpose such as demo/seed-data visibility.
    """
    token = credentials.credentials if credentials else request.cookies.get("forhire_access")
    if not token:
        return None
    try:
        return require_actor(request, credentials, db)
    except APIError:
        return None
