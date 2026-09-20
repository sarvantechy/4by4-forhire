"""Booking and booking-scoped messaging routes."""

from uuid import UUID

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.core.database import get_db
from app.core.storage import ObjectStorage, get_object_storage
from app.domains.bookings.models import Booking, BookingQuote, Offer
from app.domains.bookings.schemas import (
    BookingCreateRequest,
    BookingResponse,
    MessageCreateRequest,
    MessageResponse,
    OfferCounterRequest,
    OfferCreateRequest,
    OfferResponse,
    QuoteRequest,
    QuoteResponse,
)
from app.domains.bookings.service import BookingService
from app.domains.catalog.models import Listing
from app.domains.identity.dependencies import ActorContext, require_actor, require_csrf
from app.domains.messaging.models import Message
from app.domains.messaging.service import MessagingService

router = APIRouter(tags=["bookings"])


def get_booking_service(db: Session = Depends(get_db)) -> BookingService:
    return BookingService(db)


def _listing_summary(
    listing: Listing | None, storage: ObjectStorage
) -> tuple[str | None, str | None]:
    if listing is None:
        return None, None
    image = min(listing.images, key=lambda item: item.position, default=None)
    image_url = storage.presigned_url(image.object_key) if image is not None else None
    return listing.title, image_url


def booking_response(
    booking: Booking,
    *,
    listing_title: str | None = None,
    listing_image_url: str | None = None,
) -> BookingResponse:
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
        note=booking.note,
        listing_title=listing_title,
        listing_image_url=listing_image_url,
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


def offer_response(offer: Offer) -> OfferResponse:
    return OfferResponse(
        id=offer.id,
        listing_id=offer.listing_id,
        renter_user_id=offer.renter_user_id,
        owner_user_id=offer.owner_user_id,
        starts_at=offer.starts_at,
        ends_at=offer.ends_at,
        quantity=offer.quantity,
        unit=offer.unit,
        fulfillment_method=offer.fulfillment_method,
        proposed_amount_minor=offer.proposed_amount_minor,
        currency=offer.currency,
        reason=offer.reason,
        status=offer.status,
        counter_amount_minor=offer.counter_amount_minor,
        counter_reason=offer.counter_reason,
        booking_id=offer.booking_id,
        created_at=offer.created_at,
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
    storage: ObjectStorage = Depends(get_object_storage),
) -> BookingResponse:
    booking = service.create_booking(
        payload.quote_id, actor.user, payload.fulfillment_method, payload.note
    )
    listing = service.session.get(Listing, booking.listing_id)
    listing_title, listing_image_url = _listing_summary(listing, storage)
    return booking_response(
        booking, listing_title=listing_title, listing_image_url=listing_image_url
    )


@router.get("/bookings")
def list_bookings(
    actor: ActorContext = Depends(require_actor),
    service: BookingService = Depends(get_booking_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> list[BookingResponse]:
    bookings = service.list_for_actor(actor.user)
    listing_ids = {item.listing_id for item in bookings}
    listings = {
        listing.id: listing
        for listing in service.session.scalars(
            select(Listing)
            .options(selectinload(Listing.images))
            .where(Listing.id.in_(listing_ids))
        )
    }
    responses = []
    for item in bookings:
        listing_title, listing_image_url = _listing_summary(
            listings.get(item.listing_id), storage
        )
        responses.append(
            booking_response(
                item, listing_title=listing_title, listing_image_url=listing_image_url
            )
        )
    return responses


@router.get("/bookings/{booking_id}")
def get_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_actor),
    service: BookingService = Depends(get_booking_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> BookingResponse:
    booking = service.participant_booking(booking_id, actor.user)
    listing = service.session.get(Listing, booking.listing_id)
    listing_title, listing_image_url = _listing_summary(listing, storage)
    return booking_response(
        booking, listing_title=listing_title, listing_image_url=listing_image_url
    )


def _transition_booking(
    booking_id: UUID,
    action: str,
    actor: ActorContext,
    service: BookingService,
    storage: ObjectStorage,
) -> BookingResponse:
    booking = service.transition(booking_id, actor.user, action)
    listing = service.session.get(Listing, booking.listing_id)
    listing_title, listing_image_url = _listing_summary(listing, storage)
    return booking_response(
        booking, listing_title=listing_title, listing_image_url=listing_image_url
    )


@router.post("/bookings/{booking_id}/accept")
def accept_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> BookingResponse:
    return _transition_booking(booking_id, "accept", actor, service, storage)


@router.post("/bookings/{booking_id}/reject")
def reject_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> BookingResponse:
    return _transition_booking(booking_id, "reject", actor, service, storage)


@router.post("/bookings/{booking_id}/cancel")
def cancel_booking(
    booking_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> BookingResponse:
    return _transition_booking(booking_id, "cancel", actor, service, storage)


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


@router.post("/listings/{listing_id}/offers", status_code=201)
def create_offer(
    listing_id: UUID,
    payload: OfferCreateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> OfferResponse:
    return offer_response(service.create_offer(listing_id, actor.user, payload))


@router.get("/offers")
def list_offers(
    actor: ActorContext = Depends(require_actor),
    service: BookingService = Depends(get_booking_service),
) -> list[OfferResponse]:
    return [offer_response(item) for item in service.list_offers_for_actor(actor.user)]


@router.post("/offers/{offer_id}/accept")
def accept_offer(
    offer_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> OfferResponse:
    return offer_response(service.accept_offer(offer_id, actor.user))


@router.post("/offers/{offer_id}/decline")
def decline_offer(
    offer_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> OfferResponse:
    return offer_response(service.decline_offer(offer_id, actor.user))


@router.post("/offers/{offer_id}/counter")
def counter_offer(
    offer_id: UUID,
    payload: OfferCounterRequest,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> OfferResponse:
    return offer_response(
        service.counter_offer(
            offer_id, actor.user, payload.counter_amount_minor, payload.counter_reason
        )
    )


@router.post("/offers/{offer_id}/counter/accept")
def accept_offer_counter(
    offer_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> OfferResponse:
    return offer_response(service.accept_counter(offer_id, actor.user))


@router.post("/offers/{offer_id}/counter/decline")
def decline_offer_counter(
    offer_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> OfferResponse:
    return offer_response(service.decline_counter(offer_id, actor.user))


@router.post("/offers/{offer_id}/withdraw")
def withdraw_offer(
    offer_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: BookingService = Depends(get_booking_service),
) -> OfferResponse:
    return offer_response(service.withdraw_offer(offer_id, actor.user))
