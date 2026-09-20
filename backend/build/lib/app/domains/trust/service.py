"""Reviews, reports, disputes, blocking, and moderation services."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domains.bookings.models import BookingStatusHistory
from app.domains.bookings.service import BookingService
from app.domains.catalog.models import Listing, ListingStatusHistory
from app.domains.identity.models import User, UserProfile
from app.domains.trust.models import Dispute, ModerationAction, Report, Review, UserBlock

CASE_PRIORITIES = {"low", "normal", "high", "urgent"}
CASE_STATUSES = {"open", "in_review", "resolved", "dismissed"}


class TrustService:
    def __init__(self, session: Session) -> None:
        self.session = session
        self.bookings = BookingService(session)

    def review(self, booking_id: UUID, actor: User, rating: int, text: str) -> Review:
        booking = self.bookings.participant_booking(booking_id, actor)
        if booking.status != "completed":
            raise APIError(
                status_code=409,
                code="REVIEW_NOT_ALLOWED",
                message="Reviews are available after completion.",
            )
        subject_id = (
            booking.owner_user_id if actor.id == booking.renter_user_id else booking.renter_user_id
        )
        existing = self.session.scalar(
            select(Review).where(
                Review.booking_id == booking.id,
                Review.reviewer_user_id == actor.id,
            )
        )
        if existing is not None:
            return existing
        review = Review(
            booking_id=booking.id,
            reviewer_user_id=actor.id,
            subject_user_id=subject_id,
            rating=rating,
            text=text,
        )
        self.session.add(review)
        self.session.commit()
        self.session.refresh(review)
        return review

    def dispute(
        self,
        booking_id: UUID,
        actor: User,
        dispute_type: str,
        description: str,
    ) -> Dispute:
        booking = self.bookings.participant_booking(booking_id, actor, lock=True)
        existing = self.session.scalar(
            select(Dispute).where(Dispute.booking_id == booking.id, Dispute.status == "open")
        )
        if existing is not None:
            return existing
        dispute = Dispute(
            booking_id=booking.id,
            opened_by_user_id=actor.id,
            type=dispute_type,
            description=description,
        )
        previous = booking.status
        booking.status = "disputed"
        self.session.add(dispute)
        self.session.add(
            BookingStatusHistory(
                booking_id=booking.id,
                from_status=previous,
                to_status="disputed",
                actor_user_id=actor.id,
                reason_code=dispute_type,
            )
        )
        self.session.commit()
        self.session.refresh(dispute)
        return dispute

    def report(
        self,
        actor: User,
        target_type: str,
        target_id: UUID,
        reason: str,
        description: str,
    ) -> Report:
        report = Report(
            reporter_user_id=actor.id,
            target_type=target_type,
            target_id=target_id,
            reason=reason,
            description=description,
        )
        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        return report

    def moderate_listing(
        self,
        listing_id: UUID,
        actor_id: UUID,
        action: str,
        reason: str,
    ) -> Listing:
        listing = self.session.get(Listing, listing_id, with_for_update=True)
        if listing is None:
            raise APIError(status_code=404, code="LISTING_NOT_FOUND", message="Listing not found.")
        target = "active" if action == "approve" else "removed"
        previous = listing.status
        listing.status = target
        listing.version += 1
        self.session.add(
            ListingStatusHistory(
                listing_id=listing.id,
                from_status=previous,
                to_status=target,
                actor_user_id=actor_id,
                reason_code=f"moderation_{action}",
            )
        )
        self.session.add(
            ModerationAction(
                actor_user_id=actor_id,
                target_type="listing",
                target_id=listing.id,
                action=action,
                reason=reason,
            )
        )
        self.session.commit()
        self.session.refresh(listing)
        return listing

    def block_user(self, blocker_id: UUID, blocked_id: UUID) -> UserBlock:
        if blocker_id == blocked_id:
            raise APIError(
                status_code=422, code="CANNOT_BLOCK_SELF", message="You cannot block yourself."
            )
        existing = self.session.scalar(
            select(UserBlock).where(
                UserBlock.blocker_user_id == blocker_id,
                UserBlock.blocked_user_id == blocked_id,
            )
        )
        if existing is not None:
            return existing
        block = UserBlock(blocker_user_id=blocker_id, blocked_user_id=blocked_id)
        self.session.add(block)
        self.session.commit()
        self.session.refresh(block)
        return block

    def unblock_user(self, blocker_id: UUID, blocked_id: UUID) -> None:
        existing = self.session.scalar(
            select(UserBlock).where(
                UserBlock.blocker_user_id == blocker_id,
                UserBlock.blocked_user_id == blocked_id,
            )
        )
        if existing is not None:
            self.session.delete(existing)
            self.session.commit()

    def list_blocks(self, blocker_id: UUID) -> list[tuple[UserBlock, UserProfile | None]]:
        blocks = list(
            self.session.scalars(
                select(UserBlock)
                .where(UserBlock.blocker_user_id == blocker_id)
                .order_by(UserBlock.created_at.desc())
            )
        )
        profiles = {
            profile.user_id: profile
            for profile in self.session.scalars(
                select(UserProfile).where(
                    UserProfile.user_id.in_([block.blocked_user_id for block in blocks])
                )
            )
        } if blocks else {}
        return [(block, profiles.get(block.blocked_user_id)) for block in blocks]

    def list_disputes(self) -> list[Dispute]:
        return list(self.session.scalars(select(Dispute).order_by(Dispute.created_at.desc())))

    def update_report_case(
        self,
        report_id: UUID,
        staff_id: UUID,
        *,
        status: str | None,
        priority: str | None,
        assign_to_self: bool,
    ) -> Report:
        report = self.session.get(Report, report_id)
        if report is None:
            raise APIError(status_code=404, code="REPORT_NOT_FOUND", message="Report not found.")
        self._apply_case_update(
            report,
            staff_id,
            status=status,
            priority=priority,
            assign_to_self=assign_to_self,
        )
        self.session.commit()
        self.session.refresh(report)
        return report

    def update_dispute_case(
        self,
        dispute_id: UUID,
        staff_id: UUID,
        *,
        status: str | None,
        priority: str | None,
        assign_to_self: bool,
    ) -> Dispute:
        dispute = self.session.get(Dispute, dispute_id)
        if dispute is None:
            raise APIError(status_code=404, code="DISPUTE_NOT_FOUND", message="Dispute not found.")
        self._apply_case_update(
            dispute,
            staff_id,
            status=status,
            priority=priority,
            assign_to_self=assign_to_self,
        )
        self.session.commit()
        self.session.refresh(dispute)
        return dispute

    @staticmethod
    def _apply_case_update(
        case: Report | Dispute,
        staff_id: UUID,
        *,
        status: str | None,
        priority: str | None,
        assign_to_self: bool,
    ) -> None:
        if status is not None:
            if status not in CASE_STATUSES:
                raise APIError(
                    status_code=422,
                    code="INVALID_CASE_STATUS",
                    message="Invalid case status.",
                )
            case.status = status
        if priority is not None:
            if priority not in CASE_PRIORITIES:
                raise APIError(
                    status_code=422,
                    code="INVALID_CASE_PRIORITY",
                    message="Invalid case priority.",
                )
            case.priority = priority
        if assign_to_self:
            case.assigned_staff_user_id = staff_id

