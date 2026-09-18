"""Platform staff authorization dependencies."""

from dataclasses import dataclass

from fastapi import Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import APIError
from app.domains.identity.dependencies import ActorContext, require_actor
from app.domains.trust.models import PlatformStaff


@dataclass(frozen=True)
class StaffContext:
    actor: ActorContext
    staff: PlatformStaff


def require_staff(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> StaffContext:
    staff = db.get(PlatformStaff, actor.user.id)
    if staff is None or not staff.active:
        raise APIError(status_code=403, code="STAFF_REQUIRED", message="Staff access required.")
    return StaffContext(actor=actor, staff=staff)
