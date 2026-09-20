"""Handover, return, condition, and offline-payment services."""

import hashlib
import hmac
import secrets
from datetime import UTC, datetime, timedelta
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.core.config import Settings
from app.core.errors import APIError
from app.domains.bookings.models import Booking, BookingStatusHistory
from app.domains.bookings.service import BookingService
from app.domains.fulfillment.models import (
    ConditionReport,
    Fulfillment,
    HandoverChallenge,
    HandoverConfirmation,
    PaymentAcknowledgement,
)
from app.domains.identity.models import User


class FulfillmentService:
    def __init__(self, session: Session, settings: Settings) -> None:
        self.session = session
        self.settings = settings
        self.bookings = BookingService(session)

    def schedule(
        self,
        booking_id: UUID,
        actor: User,
        scheduled_at: datetime | None,
        private_instructions: str | None,
    ) -> Fulfillment:
        booking = self.bookings.participant_booking(booking_id, actor)
        if actor.id != booking.owner_user_id:
            self._denied()
        fulfillment = self.session.get(Fulfillment, booking.id)
        if fulfillment is None:
            fulfillment = Fulfillment(booking_id=booking.id, method=booking.fulfillment_method)
            self.session.add(fulfillment)
        fulfillment.scheduled_at = scheduled_at
        fulfillment.private_instructions = private_instructions
        self.session.commit()
        self.session.refresh(fulfillment)
        return fulfillment

    def create_challenge(
        self,
        booking_id: UUID,
        actor: User,
        purpose: str,
    ) -> tuple[HandoverChallenge, str]:
        booking = self.bookings.participant_booking(booking_id, actor, lock=True)
        if actor.id != booking.owner_user_id:
            self._denied()
        required_status = "accepted" if purpose == "handover" else "return_pending"
        if booking.status != required_status:
            self._denied()
        code = f"{secrets.randbelow(1_000_000):06d}"
        challenge = HandoverChallenge(
            booking_id=booking.id,
            purpose=purpose,
            code_hash=self._code_hash(booking.id, code),
            expires_at=datetime.now(UTC) + timedelta(minutes=10),
        )
        self.session.add(challenge)
        if purpose == "handover":
            self._transition(booking, actor.id, "ready_for_handover", "handover_ready")
        self.session.commit()
        self.session.refresh(challenge)
        return challenge, code

    def confirm_challenge(
        self,
        booking_id: UUID,
        actor: User,
        challenge_id: UUID,
        code: str,
    ) -> Booking:
        booking = self.bookings.participant_booking(booking_id, actor, lock=True)
        challenge = self.session.get(HandoverChallenge, challenge_id, with_for_update=True)
        now = datetime.now(UTC)
        if (
            challenge is None
            or challenge.booking_id != booking.id
            or challenge.expires_at <= now
            or challenge.consumed_at is not None
            or not hmac.compare_digest(challenge.code_hash, self._code_hash(booking.id, code))
        ):
            raise APIError(status_code=400, code="CHALLENGE_INVALID", message="Challenge invalid.")
        existing = self.session.scalar(
            select(HandoverConfirmation).where(
                HandoverConfirmation.challenge_id == challenge.id,
                HandoverConfirmation.actor_user_id == actor.id,
            )
        )
        if existing is None:
            self.session.add(
                HandoverConfirmation(challenge_id=challenge.id, actor_user_id=actor.id)
            )
            self.session.flush()
        confirmations = self.session.scalar(
            select(func.count(HandoverConfirmation.id)).where(
                HandoverConfirmation.challenge_id == challenge.id
            )
        )
        if int(confirmations or 0) >= 2:
            challenge.consumed_at = now
            target = "active" if challenge.purpose == "handover" else "inspection"
            self._transition(booking, actor.id, target, f"{challenge.purpose}_confirmed")
        self.session.commit()
        self.session.refresh(booking)
        return booking

    def add_condition_report(
        self,
        booking_id: UUID,
        actor: User,
        phase: str,
        checklist: dict[str, object],
        notes: str,
    ) -> ConditionReport:
        booking = self.bookings.participant_booking(booking_id, actor)
        allowed = {
            "handover": {"accepted", "ready_for_handover"},
            "return": {"active", "return_pending", "inspection", "overdue"},
        }
        if booking.status not in allowed[phase]:
            self._denied()
        report = ConditionReport(
            booking_id=booking.id,
            actor_user_id=actor.id,
            phase=phase,
            checklist=checklist,
            notes=notes,
        )
        self.session.add(report)
        self.session.commit()
        self.session.refresh(report)
        return report

    def acknowledge_payment(
        self, booking_id: UUID, actor: User, disagreement: bool
    ) -> PaymentAcknowledgement:
        booking = self.bookings.participant_booking(booking_id, actor)
        acknowledgement = self.session.scalar(
            select(PaymentAcknowledgement).where(
                PaymentAcknowledgement.booking_id == booking.id,
                PaymentAcknowledgement.actor_user_id == actor.id,
            )
        )
        if acknowledgement is None:
            acknowledgement = PaymentAcknowledgement(
                booking_id=booking.id,
                actor_user_id=actor.id,
                rental_charge_minor=booking.rental_charge_minor,
                deposit_minor=booking.deposit_minor,
                currency=booking.currency,
                disagreement=disagreement,
            )
            self.session.add(acknowledgement)
            self.session.commit()
            self.session.refresh(acknowledgement)
        return acknowledgement

    def initiate_return(self, booking_id: UUID, actor: User) -> Booking:
        booking = self.bookings.participant_booking(booking_id, actor, lock=True)
        if actor.id != booking.renter_user_id or booking.status not in {"active", "overdue"}:
            self._denied()
        self._transition(booking, actor.id, "return_pending", "return_initiated")
        self.session.commit()
        return booking

    def accept_inspection(self, booking_id: UUID, actor: User) -> Booking:
        booking = self.bookings.participant_booking(booking_id, actor, lock=True)
        if actor.id != booking.owner_user_id or booking.status != "inspection":
            self._denied()
        self._transition(booking, actor.id, "completed", "inspection_accepted")
        self.session.commit()
        return booking

    def _transition(self, booking: Booking, actor_id: UUID, target: str, reason: str) -> None:
        previous = booking.status
        booking.status = target
        self.session.add(
            BookingStatusHistory(
                booking_id=booking.id,
                from_status=previous,
                to_status=target,
                actor_user_id=actor_id,
                reason_code=reason,
            )
        )

    def _code_hash(self, booking_id: UUID, code: str) -> str:
        return hmac.new(
            self.settings.session_secret.encode(),
            f"{booking_id}:{code}".encode(),
            hashlib.sha256,
        ).hexdigest()

    @staticmethod
    def _denied() -> None:
        raise APIError(
            status_code=409,
            code="FULFILLMENT_TRANSITION_DENIED",
            message="This fulfillment action is not allowed.",
        )
