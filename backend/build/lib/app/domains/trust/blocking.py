"""Shared user-block lookup, importable by booking and messaging services without a domain cycle."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.domains.trust.models import UserBlock


def is_blocked(session: Session, user_a: UUID, user_b: UUID) -> bool:
    return (
        session.scalar(
            select(UserBlock.id).where(
                ((UserBlock.blocker_user_id == user_a) & (UserBlock.blocked_user_id == user_b))
                | ((UserBlock.blocker_user_id == user_b) & (UserBlock.blocked_user_id == user_a))
            )
        )
        is not None
    )
