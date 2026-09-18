"""Reviews, reports, disputes, and moderation services."""

from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domains.bookings.models import BookingStatusHistory
from app.domains.bookings.service import BookingService
from app.domains.catalog.models import Listing, ListingStatusHistory
from app.domains.identity.models import User
from app.domains.trust.models import Dispute, ModerationAction, Report, Review


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
