"""Booking and booking-scoped messaging routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.domains.bookings.models import Booking, BookingQuote
from app.domains.bookings.schemas import (
    BookingCreateRequest,
    BookingResponse,
    MessageCreateRequest,
    MessageResponse,
    QuoteRequest,
    QuoteResponse,
)
from app.domains.bookings.service import BookingService
from app.domains.identity.dependencies import ActorContext, require_actor, require_csrf
from app.domains.messaging.models import Message
from app.domains.messaging.service import MessagingService

router = APIRouter(tags=["bookings"])


def get_booking_service(db: Session = Depends(get_db)) -> BookingService:
    return BookingService(db)


def booking_response(booking: Booking) -> BookingResponse:
    return BookingResponse(
        id=booking.id,
        public_number=booking.public_number,
        listing_id=booking.listing_id,
        renter_user_id=booking.renter_user_id,
        owner_user_id=booking.owner_user_id,
        starts_at=booking.starts_at,
        ends_at=booking.ends_at,
        quantity=booking.quantity,
        status=booking.status,
        fulfillment_method=booking.fulfillment_method,
        rental_charge_minor=booking.rental_charge_minor,
        deposit_minor=booking.deposit_minor,
        currency=booking.currency,
        created_at=booking.created_at,
    )


def quote_response(quote: BookingQuote) -> QuoteResponse:
    return QuoteResponse(
        id=quote.id,
        listing_id=quote.listing_id,
        starts_at=quote.starts_at,
        ends_at=quote.ends_at,
        quantity=quote.quantity,
        rental_charge_minor=quote.rental_charge_minor,
        deposit_minor=quote.deposit_minor,
        currency=quote.currency,
        expires_at=quote.expires_at,
    )


def message_response(message: Message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        sender_user_id=message.sender_user_id,
        body=message.body,
        created_at=message.created_at,
    )


@router.post("/listings/{listing_id}/quotes", status_code=201)
def create_quote(
    listing_id: UUID,
    payload: QuoteRequest,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> QuoteResponse:
    return quote_response(service.create_quote(listing_id, actor.user, payload))


@router.post("/bookings", status_code=201)
def create_booking(
    payload: BookingCreateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> BookingResponse:
    return booking_response(
        service.create_booking(payload.quote_id, actor.user, payload.fulfillment_method)
    )


@router.get("/bookings")
def list_bookings(
    actor: ActorContext = Depends(require_actor),
    service: BookingService = Depends(get_booking_service),
) -> list[BookingResponse]:
    return [booking_response(item) for item in service.list_for_actor(actor.user)]


@router.get("/bookings/{booking_id}")
def get_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_actor),
    service: BookingService = Depends(get_booking_service),
) -> BookingResponse:
    return booking_response(service.participant_booking(booking_id, actor.user))


def _transition_booking(
    booking_id: UUID,
    action: str,
    actor: ActorContext,
    service: BookingService,
) -> BookingResponse:
    return booking_response(service.transition(booking_id, actor.user, action))


@router.post("/bookings/{booking_id}/accept")
def accept_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> BookingResponse:
    return _transition_booking(booking_id, "accept", actor, service)


@router.post("/bookings/{booking_id}/reject")
def reject_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> BookingResponse:
    return _transition_booking(booking_id, "reject", actor, service)


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> BookingResponse:
    return _transition_booking(booking_id, "cancel", actor, service)


@router.get("/bookings/{booking_id}/messages")
def list_messages(
    booking_id: UUID,
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> list[MessageResponse]:
    service = MessagingService(db)
    conversation = service.conversation_for_booking(booking_id, actor.user)
    return [message_response(message) for message in service.messages(conversation)]


@router.post("/bookings/{booking_id}/messages", status_code=201)
def send_message(
    booking_id: UUID,
    payload: MessageCreateRequest,
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
) -> MessageResponse:
    service = MessagingService(db)
    conversation = service.conversation_for_booking(booking_id, actor.user)
    return message_response(
        service.send_message(conversation, actor.user, payload.client_message_id, payload.body)
    )
