"""Fulfillment and trust API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Request
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.bookings.router import booking_response
from app.domains.bookings.schemas import BookingResponse
from app.domains.fulfillment.models import Fulfillment
from app.domains.fulfillment.schemas import (
    AdminCaseUpdateRequest,
    AdminDisputeResponse,
    AdminReportResponse,
    BlockedUserResponse,
    BlockUserRequest,
    ChallengeConfirmRequest,
    ChallengeResponse,
    ConditionReportRequest,
    DisputeRequest,
    FulfillmentResponse,
    FulfillmentScheduleRequest,
    ModerationRequest,
    PaymentAcknowledgementRequest,
    ReportRequest,
    ReviewRequest,
)
from app.domains.fulfillment.service import FulfillmentService
from app.domains.identity.dependencies import ActorContext, require_actor, require_csrf
from app.domains.trust.dependencies import StaffContext, require_staff
from app.domains.trust.models import Dispute, Report
from app.domains.trust.service import TrustService

router = APIRouter(tags=["fulfillment", "trust"])


def get_fulfillment_service(
    request: Request,
    db: Session = Depends(get_db),
) -> FulfillmentService:
    return FulfillmentService(db, request.app.state.settings)


def fulfillment_response(item: Fulfillment) -> FulfillmentResponse:
    return FulfillmentResponse(
        booking_id=item.booking_id,
        method=item.method,
        status=item.status,
        scheduled_at=item.scheduled_at,
        private_instructions=item.private_instructions,
    )


@router.put("/bookings/{booking_id}/fulfillment")
def schedule_fulfillment(
    booking_id: UUID,
    payload: FulfillmentScheduleRequest,
    actor: ActorContext = Depends(require_csrf),
    service: FulfillmentService = Depends(get_fulfillment_service),
) -> FulfillmentResponse:
    return fulfillment_response(service.schedule(booking_id, actor.user, **payload.model_dump()))


@router.post("/bookings/{booking_id}/{purpose}/challenge")
def create_challenge(
    booking_id: UUID,
    purpose: str,
    actor: ActorContext = Depends(require_csrf),
    service: FulfillmentService = Depends(get_fulfillment_service),
) -> ChallengeResponse:
    if purpose not in {"handover", "return"}:
        from app.core.errors import APIError

        raise APIError(status_code=404, code="PURPOSE_NOT_FOUND", message="Purpose not found.")
    challenge, code = service.create_challenge(booking_id, actor.user, purpose)
    return ChallengeResponse(
        challenge_id=challenge.id,
        code=code,
        purpose=purpose,
        expires_at=challenge.expires_at,
    )


@router.post("/bookings/{booking_id}/challenge/confirm")
def confirm_challenge(
    booking_id: UUID,
    payload: ChallengeConfirmRequest,
    actor: ActorContext = Depends(require_csrf),
    service: FulfillmentService = Depends(get_fulfillment_service),
) -> BookingResponse:
    return booking_response(
        service.confirm_challenge(booking_id, actor.user, payload.challenge_id, payload.code)
    )


@router.post("/bookings/{booking_id}/condition-reports", status_code=201)
def condition_report(
    booking_id: UUID,
    payload: ConditionReportRequest,
    actor: ActorContext = Depends(require_csrf),
    service: FulfillmentService = Depends(get_fulfillment_service),
) -> dict[str, str]:
    report = service.add_condition_report(booking_id, actor.user, **payload.model_dump())
    return {"id": str(report.id)}


@router.post("/bookings/{booking_id}/payment-at-pickup/acknowledge", status_code=201)
def acknowledge_payment(
    booking_id: UUID,
    payload: PaymentAcknowledgementRequest,
    actor: ActorContext = Depends(require_csrf),
    service: FulfillmentService = Depends(get_fulfillment_service),
) -> dict[str, str | bool]:
    acknowledgement = service.acknowledge_payment(
        booking_id, actor.user, payload.disagreement
    )
    return {"id": str(acknowledgement.id), "disagreement": acknowledgement.disagreement}


@router.post("/bookings/{booking_id}/return/initiate")
def initiate_return(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: FulfillmentService = Depends(get_fulfillment_service),
) -> BookingResponse:
    return booking_response(service.initiate_return(booking_id, actor.user))


@router.post("/bookings/{booking_id}/inspection/accept")
def accept_inspection(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: FulfillmentService = Depends(get_fulfillment_service),
) -> BookingResponse:
    return booking_response(service.accept_inspection(booking_id, actor.user))


@router.post("/bookings/{booking_id}/reviews", status_code=201)
def create_review(
    booking_id: UUID,
    payload: ReviewRequest,
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str | int]:
    review = TrustService(db).review(booking_id, actor.user, payload.rating, payload.text)
    return {"id": str(review.id), "rating": review.rating}


@router.post("/bookings/{booking_id}/disputes", status_code=201)
def create_dispute(
    booking_id: UUID,
    payload: DisputeRequest,
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    dispute = TrustService(db).dispute(
        booking_id, actor.user, payload.type, payload.description
    )
    return {"id": str(dispute.id), "status": dispute.status}


@router.post("/reports", status_code=201)
def create_report(
    payload: ReportRequest,
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    report = TrustService(db).report(actor.user, **payload.model_dump())
    return {"id": str(report.id), "status": report.status}


@router.get("/admin/reports")
def admin_reports(
    staff: StaffContext = Depends(require_staff),
    db: Session = Depends(get_db),
) -> list[AdminReportResponse]:
    del staff
    reports = db.scalars(select(Report).order_by(Report.created_at.desc())).all()
    return [
        AdminReportResponse(
            id=report.id,
            target_type=report.target_type,
            target_id=report.target_id,
            reason=report.reason,
            description=report.description,
            status=report.status,
            priority=report.priority,
            assigned_staff_user_id=report.assigned_staff_user_id,
            created_at=report.created_at,
        )
        for report in reports
    ]


@router.patch("/admin/reports/{report_id}")
def update_report_case(
    report_id: UUID,
    payload: AdminCaseUpdateRequest,
    staff: StaffContext = Depends(require_staff),
    db: Session = Depends(get_db),
) -> AdminReportResponse:
    report = TrustService(db).update_report_case(
        report_id,
        staff.actor.user.id,
        status=payload.status,
        priority=payload.priority,
        assign_to_self=payload.assign_to_self,
    )
    return AdminReportResponse(
        id=report.id,
        target_type=report.target_type,
        target_id=report.target_id,
        reason=report.reason,
        description=report.description,
        status=report.status,
        priority=report.priority,
        assigned_staff_user_id=report.assigned_staff_user_id,
        created_at=report.created_at,
    )


def _dispute_response(dispute: Dispute) -> AdminDisputeResponse:
    return AdminDisputeResponse(
        id=dispute.id,
        booking_id=dispute.booking_id,
        opened_by_user_id=dispute.opened_by_user_id,
        type=dispute.type,
        description=dispute.description,
        status=dispute.status,
        priority=dispute.priority,
        assigned_staff_user_id=dispute.assigned_staff_user_id,
        created_at=dispute.created_at,
    )


@router.get("/admin/disputes")
def admin_disputes(
    staff: StaffContext = Depends(require_staff),
    db: Session = Depends(get_db),
) -> list[AdminDisputeResponse]:
    del staff
    return [_dispute_response(dispute) for dispute in TrustService(db).list_disputes()]


@router.patch("/admin/disputes/{dispute_id}")
def update_dispute_case(
    dispute_id: UUID,
    payload: AdminCaseUpdateRequest,
    staff: StaffContext = Depends(require_staff),
    db: Session = Depends(get_db),
) -> AdminDisputeResponse:
    dispute = TrustService(db).update_dispute_case(
        dispute_id,
        staff.actor.user.id,
        status=payload.status,
        priority=payload.priority,
        assign_to_self=payload.assign_to_self,
    )
    return _dispute_response(dispute)


@router.post("/trust/blocks", status_code=201)
def block_user(
    payload: BlockUserRequest,
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    TrustService(db).block_user(actor.user.id, payload.blocked_user_id)
    return {"status": "blocked"}


@router.delete("/trust/blocks/{blocked_user_id}")
def unblock_user(
    blocked_user_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    TrustService(db).unblock_user(actor.user.id, blocked_user_id)
    return {"status": "unblocked"}


@router.get("/trust/blocks")
def list_blocked_users(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> list[BlockedUserResponse]:
    blocks = TrustService(db).list_blocks(actor.user.id)
    return [
        BlockedUserResponse(
            blocked_user_id=block.blocked_user_id,
            display_name=profile.display_name if profile else "4x4 member",
            blocked_at=block.created_at,
        )
        for block, profile in blocks
    ]


@router.post("/admin/listings/{listing_id}/moderate")
def moderate_listing(
    listing_id: UUID,
    payload: ModerationRequest,
    staff: StaffContext = Depends(require_staff),
    db: Session = Depends(get_db),
) -> dict[str, str]:
    listing = TrustService(db).moderate_listing(
        listing_id, staff.actor.user.id, payload.action, payload.reason
    )
    return {"id": str(listing.id), "status": listing.status}
