"""Transactional quote and booking state services."""

import math
import secrets
from datetime import UTC, datetime, timedelta
from typing import NoReturn
from uuid import UUID

from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domains.bookings.models import (
    Booking,
    BookingQuote,
    BookingStatusHistory,
    InventoryAllocation,
    Offer,
)
from app.domains.bookings.schemas import OfferCreateRequest, QuoteRequest
from app.domains.catalog.models import Listing, ListingPrice
from app.domains.identity.models import User
from app.domains.messaging.models import Conversation
from app.domains.trust.blocking import is_blocked


class BookingService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_quote(self, listing_id: UUID, renter: User, payload: QuoteRequest) -> BookingQuote:
        listing = self.session.get(Listing, listing_id)
        if listing is None or listing.status != "active":
            raise APIError(
                status_code=404,
                code="LISTING_NOT_FOUND",
                message="Listing not found.",
            )
        if listing.owner_user_id == renter.id:
            raise APIError(
                status_code=409,
                code="SELF_BOOKING_DENIED",
                message="You cannot rent your own item.",
            )
        if is_blocked(self.session, renter.id, listing.owner_user_id):
            raise APIError(
                status_code=403,
                code="USER_BLOCKED",
                message="You cannot contact this user.",
            )
        if payload.quantity > listing.quantity:
            raise APIError(
                status_code=409,
                code="QUANTITY_UNAVAILABLE",
                message="Quantity unavailable.",
            )
        price = self.session.scalar(
            select(ListingPrice).where(
                ListingPrice.listing_id == listing.id,
                ListingPrice.unit == payload.unit,
            )
        )
        if price is None:
            raise APIError(
                status_code=422,
                code="PRICE_UNIT_UNAVAILABLE",
                message="Price unit unavailable.",
            )
        duration_seconds = (payload.ends_at - payload.starts_at).total_seconds()
        unit_seconds = {"hour": 3600, "day": 86400, "week": 604800, "month": 2592000}[payload.unit]
        units = max(1, math.ceil(duration_seconds / unit_seconds))
        quote = BookingQuote(
            listing_id=listing.id,
            renter_user_id=renter.id,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            quantity=payload.quantity,
            rental_charge_minor=price.amount_minor * units * payload.quantity,
            deposit_minor=price.deposit_minor * payload.quantity,
            currency=price.currency,
            expires_at=datetime.now(UTC) + timedelta(minutes=10),
        )
        self.session.add(quote)
        self.session.commit()
        self.session.refresh(quote)
        return quote

    def create_booking(
        self, quote_id: UUID, renter: User, fulfillment_method: str, note: str | None = None
    ) -> Booking:
        quote = self.session.get(BookingQuote, quote_id, with_for_update=True)
        if (
            quote is None
            or quote.renter_user_id != renter.id
            or quote.expires_at <= datetime.now(UTC)
        ):
            raise APIError(
                status_code=409,
                code="QUOTE_INVALID",
                message="The quote is invalid or expired.",
            )
        existing = self.session.scalar(select(Booking).where(Booking.quote_id == quote.id))
        if existing is not None:
            return existing
        listing = self.session.get(Listing, quote.listing_id)
        if listing is None or listing.status != "active":
            raise APIError(
                status_code=409,
                code="LISTING_UNAVAILABLE",
                message="Listing unavailable.",
            )
        booking = Booking(
            public_number=f"FH-{secrets.token_hex(4).upper()}",
            quote_id=quote.id,
            listing_id=listing.id,
            renter_user_id=renter.id,
            owner_user_id=listing.owner_user_id,
            starts_at=quote.starts_at,
            ends_at=quote.ends_at,
            quantity=quote.quantity,
            status="requested",
            fulfillment_method=fulfillment_method,
            rental_charge_minor=quote.rental_charge_minor,
            deposit_minor=quote.deposit_minor,
            currency=quote.currency,
            note=note,
        )
        self.session.add(booking)
        self.session.flush()
        self._history(booking, None, "requested", renter.id, "requested")
        conversation = self.session.scalar(
            select(Conversation).where(
                Conversation.listing_id == listing.id,
                Conversation.renter_user_id == renter.id,
                Conversation.booking_id.is_(None),
            )
        )
        if conversation is not None:
            conversation.booking_id = booking.id
        else:
            self.session.add(Conversation(
                booking_id=booking.id,
                listing_id=listing.id,
                renter_user_id=renter.id,
                owner_user_id=listing.owner_user_id,
            ))
        self.session.commit()
        self.session.refresh(booking)
        return booking

    def create_offer(self, listing_id: UUID, renter: User, payload: OfferCreateRequest) -> Offer:
        listing = self.session.get(Listing, listing_id)
        if listing is None or listing.status != "active":
            raise APIError(
                status_code=404,
                code="LISTING_NOT_FOUND",
                message="Listing not found.",
            )
        if listing.owner_user_id == renter.id:
            raise APIError(
                status_code=409,
                code="SELF_BOOKING_DENIED",
                message="You cannot rent your own item.",
            )
        if is_blocked(self.session, renter.id, listing.owner_user_id):
            raise APIError(
                status_code=403,
                code="USER_BLOCKED",
                message="You cannot contact this user.",
            )
        if payload.quantity > listing.quantity:
            raise APIError(
                status_code=409,
                code="QUANTITY_UNAVAILABLE",
                message="Quantity unavailable.",
            )
        offer = Offer(
            listing_id=listing.id,
            renter_user_id=renter.id,
            owner_user_id=listing.owner_user_id,
            starts_at=payload.starts_at,
            ends_at=payload.ends_at,
            quantity=payload.quantity,
            unit=payload.unit,
            fulfillment_method=payload.fulfillment_method,
            proposed_amount_minor=payload.proposed_amount_minor,
            reason=payload.reason,
        )
        self.session.add(offer)
        self.session.commit()
        self.session.refresh(offer)
        return offer

    def participant_offer(self, offer_id: UUID, actor: User, *, lock: bool = False) -> Offer:
        statement = select(Offer).where(
            Offer.id == offer_id,
            or_(Offer.renter_user_id == actor.id, Offer.owner_user_id == actor.id),
        )
        if lock:
            statement = statement.with_for_update()
        offer = self.session.scalar(statement)
        if offer is None:
            raise APIError(status_code=404, code="OFFER_NOT_FOUND", message="Offer not found.")
        return offer

    def list_offers_for_actor(self, actor: User) -> list[Offer]:
        return list(
            self.session.scalars(
                select(Offer)
                .where(or_(Offer.renter_user_id == actor.id, Offer.owner_user_id == actor.id))
                .order_by(Offer.created_at.desc())
            )
        )

    def _book_from_offer(self, offer: Offer, amount_minor: int) -> Booking:
        listing = self.session.get(Listing, offer.listing_id)
        if listing is None or listing.status != "active":
            raise APIError(
                status_code=409,
                code="LISTING_UNAVAILABLE",
                message="Listing unavailable.",
            )
        price = self.session.scalar(
            select(ListingPrice).where(
                ListingPrice.listing_id == listing.id, ListingPrice.unit == offer.unit
            )
        )
        deposit_minor = price.deposit_minor * offer.quantity if price is not None else 0
        quote = BookingQuote(
            listing_id=listing.id,
            renter_user_id=offer.renter_user_id,
            starts_at=offer.starts_at,
            ends_at=offer.ends_at,
            quantity=offer.quantity,
            rental_charge_minor=amount_minor,
            deposit_minor=deposit_minor,
            currency=offer.currency,
            expires_at=datetime.now(UTC) + timedelta(minutes=10),
        )
        self.session.add(quote)
        self.session.flush()
        renter = self.session.get(User, offer.renter_user_id)
        if renter is None:
            raise APIError(
                status_code=409,
                code="RENTER_UNAVAILABLE",
                message="The renter account is unavailable.",
            )
        return self.create_booking(quote.id, renter, offer.fulfillment_method)

    def accept_offer(self, offer_id: UUID, actor: User) -> Offer:
        offer = self.participant_offer(offer_id, actor, lock=True)
        if actor.id != offer.owner_user_id or offer.status != "pending":
            self._offer_denied()
        booking = self._book_from_offer(offer, offer.proposed_amount_minor)
        offer.status = "accepted"
        offer.booking_id = booking.id
        self.session.commit()
        self.session.refresh(offer)
        return offer

    def decline_offer(self, offer_id: UUID, actor: User) -> Offer:
        offer = self.participant_offer(offer_id, actor, lock=True)
        if actor.id != offer.owner_user_id or offer.status != "pending":
            self._offer_denied()
        offer.status = "declined"
        self.session.commit()
        self.session.refresh(offer)
        return offer

    def counter_offer(
        self, offer_id: UUID, actor: User, counter_amount_minor: int, counter_reason: str
    ) -> Offer:
        offer = self.participant_offer(offer_id, actor, lock=True)
        if actor.id != offer.owner_user_id or offer.status != "pending":
            self._offer_denied()
        offer.status = "countered"
        offer.counter_amount_minor = counter_amount_minor
        offer.counter_reason = counter_reason
        self.session.commit()
        self.session.refresh(offer)
        return offer

    def accept_counter(self, offer_id: UUID, actor: User) -> Offer:
        offer = self.participant_offer(offer_id, actor, lock=True)
        if (
            actor.id != offer.renter_user_id
            or offer.status != "countered"
            or offer.counter_amount_minor is None
        ):
            self._offer_denied()
        booking = self._book_from_offer(offer, offer.counter_amount_minor)
        offer.status = "counter_accepted"
        offer.booking_id = booking.id
        self.session.commit()
        self.session.refresh(offer)
        return offer

    def decline_counter(self, offer_id: UUID, actor: User) -> Offer:
        offer = self.participant_offer(offer_id, actor, lock=True)
        if actor.id != offer.renter_user_id or offer.status != "countered":
            self._offer_denied()
        offer.status = "counter_declined"
        self.session.commit()
        self.session.refresh(offer)
        return offer

    def withdraw_offer(self, offer_id: UUID, actor: User) -> Offer:
        offer = self.participant_offer(offer_id, actor, lock=True)
        if actor.id != offer.renter_user_id or offer.status not in {"pending", "countered"}:
            self._offer_denied()
        offer.status = "withdrawn"
        self.session.commit()
        self.session.refresh(offer)
        return offer

    @staticmethod
    def _offer_denied() -> NoReturn:
        raise APIError(
            status_code=409,
            code="OFFER_TRANSITION_DENIED",
            message="This offer action is not allowed.",
        )

    def participant_booking(self, booking_id: UUID, actor: User, *, lock: bool = False) -> Booking:
        statement = select(Booking).where(
            Booking.id == booking_id,
            or_(Booking.renter_user_id == actor.id, Booking.owner_user_id == actor.id),
        )
        if lock:
            statement = statement.with_for_update()
        booking = self.session.scalar(statement)
        if booking is None:
            raise APIError(status_code=404, code="BOOKING_NOT_FOUND", message="Booking not found.")
        return booking

    def transition(self, booking_id: UUID, actor: User, action: str) -> Booking:
        booking = self.participant_booking(booking_id, actor, lock=True)
        if action == "accept":
            if actor.id != booking.owner_user_id or booking.status != "requested":
                self._denied()
            listing = self.session.scalar(
                select(Listing).where(Listing.id == booking.listing_id).with_for_update()
            )
            if listing is None:
                raise APIError(
                    status_code=409,
                    code="LISTING_UNAVAILABLE",
                    message="Listing unavailable.",
                )
            allocated = self.session.scalar(
                select(func.coalesce(func.sum(InventoryAllocation.quantity), 0)).where(
                    InventoryAllocation.listing_id == listing.id,
                    InventoryAllocation.status == "confirmed",
                    InventoryAllocation.starts_at < booking.ends_at,
                    InventoryAllocation.ends_at > booking.starts_at,
                )
            )
            if int(allocated or 0) + booking.quantity > listing.quantity:
                raise APIError(
                    status_code=409,
                    code="BOOKING_AVAILABILITY_CHANGED",
                    message="The requested quantity is no longer available.",
                )
            self.session.add(
                InventoryAllocation(
                    booking_id=booking.id,
                    listing_id=listing.id,
                    starts_at=booking.starts_at,
                    ends_at=booking.ends_at,
                    quantity=booking.quantity,
                    status="confirmed",
                )
            )
            target = "accepted"
        elif (
            action == "reject"
            and actor.id == booking.owner_user_id
            and booking.status == "requested"
        ):
            target = "rejected"
        elif (
            action == "cancel"
            and actor.id == booking.renter_user_id
            and booking.status in {"requested", "accepted"}
        ):
            target = "cancelled"
            allocation = self.session.scalar(
                select(InventoryAllocation).where(InventoryAllocation.booking_id == booking.id)
            )
            if allocation is not None:
                self.session.delete(allocation)
        else:
            self._denied()
        previous = booking.status
        booking.status = target
        self._history(booking, previous, target, actor.id, action)
        self.session.commit()
        self.session.refresh(booking)
        return booking

    def list_for_actor(self, actor: User) -> list[Booking]:
        return list(
            self.session.scalars(
                select(Booking)
                .where(or_(Booking.renter_user_id == actor.id, Booking.owner_user_id == actor.id))
                .order_by(Booking.created_at.desc())
            )
        )

    def _history(
        self,
        booking: Booking,
        previous: str | None,
        target: str,
        actor_id: UUID,
        reason: str,
    ) -> None:
        self.session.add(
            BookingStatusHistory(
                booking_id=booking.id,
                from_status=previous,
                to_status=target,
                actor_user_id=actor_id,
                reason_code=reason,
            )
        )

    @staticmethod
    def _denied() -> None:
        raise APIError(
            status_code=409,
            code="BOOKING_TRANSITION_DENIED",
            message="This booking action is not allowed.",
        )
