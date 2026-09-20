"""Catalog and seller API routes."""

import io
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import get_settings
from app.core.database import get_db
from app.core.errors import APIError
from app.core.storage import ObjectStorage, get_object_storage
from app.domains.bookings.schemas import MessageCreateRequest, MessageResponse
from app.domains.catalog.models import Category, Listing, SellerHeader
from app.domains.catalog.schemas import (
    AvailabilityBlockRequest,
    CategoryResponse,
    ListingCreateRequest,
    ListingImageResponse,
    ListingResponse,
    ListingUpdateRequest,
    PriceResponse,
    SellerHeaderRequest,
    SellerHeaderResponse,
)
from app.domains.catalog.service import CatalogService
from app.domains.identity.dependencies import (
    ActorContext,
    require_actor,
    require_csrf,
    require_optional_actor,
)
from app.domains.messaging.models import Message
from app.domains.messaging.service import MessagingService
from app.domains.stores.models import Store
from app.domains.stores.schemas import StoreSummaryResponse

router = APIRouter(tags=["catalog"])

ALLOWED_IMAGE_CONTENT_TYPES = {"image/jpeg", "image/png", "image/webp"}
MAX_IMAGE_BYTES = 8 * 1024 * 1024


def get_catalog_service(db: Session = Depends(get_db)) -> CatalogService:
    return CatalogService(db)


def category_response(category: Category) -> CategoryResponse:
    return CategoryResponse(
        id=category.id,
        slug=category.slug,
        name=category.name,
        risk_tier=category.risk_tier,
        required_attributes=category.required_attributes,
    )


def store_summary_response(
    store: Store | None, storage: ObjectStorage
) -> StoreSummaryResponse | None:
    if store is None:
        return None
    return StoreSummaryResponse(
        id=store.id,
        slug=store.slug,
        display_name=store.display_name,
        logo_url=storage.presigned_url(store.logo_object_key) if store.logo_object_key else None,
        public_locality=store.public_locality,
    )


def listing_response(listing: Listing, storage: ObjectStorage) -> ListingResponse:
    return ListingResponse(
        id=listing.id,
        owner_user_id=listing.owner_user_id,
        category=category_response(listing.category),
        listing_type=listing.listing_type,
        title=listing.title,
        description=listing.description,
        condition=listing.condition,
        quantity=listing.quantity,
        attributes=listing.attributes,
        status=listing.status,
        pickup_enabled=listing.pickup_enabled,
        delivery_enabled=listing.delivery_enabled,
        public_locality=listing.public_locality,
        latitude=listing.latitude,
        longitude=listing.longitude,
        version=listing.version,
        prices=[
            PriceResponse(
                id=price.id,
                unit=price.unit,
                amount_minor=price.amount_minor,
                deposit_minor=price.deposit_minor,
                currency="INR",
            )
            for price in listing.prices
        ],
        images=[
            ListingImageResponse(
                id=image.id,
                url=storage.presigned_url(image.object_key),
                position=image.position,
            )
            for image in listing.images
        ],
        store=store_summary_response(listing.store, storage),
        created_at=listing.created_at,
    )


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)) -> list[CategoryResponse]:
    categories = db.scalars(
        select(Category).where(Category.enabled.is_(True)).order_by(Category.name)
    ).all()
    return [category_response(category) for category in categories]


def _is_demo_actor(actor: ActorContext | None) -> bool:
    """Return True only when the caller is signed in as the demo/seed-data login."""
    demo_mobile_number = get_settings().demo_mobile_number
    if actor is None or not demo_mobile_number:
        return False
    return any(
        identity.type == "mobile" and identity.normalized_identifier == demo_mobile_number
        for identity in actor.user.identities
    )


@router.get("/listings")
def search_listings(
    q: str | None = Query(default=None, max_length=120),
    category_id: UUID | None = None,
    listing_type: str | None = Query(default=None, pattern="^(item|service)$"),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: int = Query(default=25, ge=1, le=200),
    limit: int = Query(default=20, ge=1, le=100),
    actor: ActorContext | None = Depends(require_optional_actor),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> list[ListingResponse]:
    listings = service.search(
        query=q,
        category_id=category_id,
        listing_type=listing_type,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        limit=limit,
        include_seed_data=_is_demo_actor(actor),
    )
    return [listing_response(listing, storage) for listing in listings]


def _listing_message_response(message: Message) -> MessageResponse:
    return MessageResponse(
        id=message.id,
        sender_user_id=message.sender_user_id,
        body=message.body,
        created_at=message.created_at,
    )


@router.get("/listings/{listing_id}/messages")
def list_listing_messages(
    listing_id: UUID,
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
    service: CatalogService = Depends(get_catalog_service),
) -> list[MessageResponse]:
    listing = service.get_listing(listing_id)
    messaging = MessagingService(db)
    conversation = messaging.conversation_for_listing(listing_id, listing.owner_user_id, actor.user)
    return [_listing_message_response(message) for message in messaging.messages(conversation)]


@router.post("/listings/{listing_id}/messages", status_code=201)
def send_listing_message(
    listing_id: UUID,
    payload: MessageCreateRequest,
    actor: ActorContext = Depends(require_csrf),
    db: Session = Depends(get_db),
    service: CatalogService = Depends(get_catalog_service),
) -> MessageResponse:
    listing = service.get_listing(listing_id)
    messaging = MessagingService(db)
    conversation = messaging.conversation_for_listing(listing_id, listing.owner_user_id, actor.user)
    message = messaging.send_message(
        conversation, actor.user, payload.client_message_id, payload.body
    )
    return _listing_message_response(message)


@router.get("/listings/{listing_id}")
def get_listing(
    listing_id: UUID,
    actor: ActorContext | None = Depends(require_optional_actor),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    viewer_user_id = actor.user.id if actor is not None else None
    return listing_response(
        service.get_listing(listing_id, viewer_user_id=viewer_user_id),
        storage,
    )


@router.get("/me/listings")
def my_listings(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
    storage: ObjectStorage = Depends(get_object_storage),
) -> list[ListingResponse]:
    listings = db.scalars(
        select(Listing)
        .where(Listing.owner_user_id == actor.user.id)
        .order_by(Listing.created_at.desc())
    ).all()
    service = CatalogService(db)
    return [
        listing_response(service.get_listing(item.id, include_private=True), storage)
        for item in listings
    ]


@router.post("/listings", status_code=201)
def create_listing(
    payload: ListingCreateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    return listing_response(service.create_listing(actor.user, payload), storage)


@router.patch("/listings/{listing_id}")
def update_listing(
    listing_id: UUID,
    payload: ListingUpdateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    return listing_response(service.update_listing(listing_id, actor.user, payload), storage)


def _transition_listing(
    listing_id: UUID,
    action: str,
    actor: ActorContext,
    service: CatalogService,
    storage: ObjectStorage,
) -> ListingResponse:
    return listing_response(service.transition(listing_id, actor.user, action), storage)


@router.post("/listings/{listing_id}/publish")
def publish_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    return _transition_listing(listing_id, "publish", actor, service, storage)


@router.post("/listings/{listing_id}/pause")
def pause_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    return _transition_listing(listing_id, "pause", actor, service, storage)


@router.post("/listings/{listing_id}/resume")
def resume_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    return _transition_listing(listing_id, "resume", actor, service, storage)


@router.post("/listings/{listing_id}/archive")
def archive_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    return _transition_listing(listing_id, "archive", actor, service, storage)


@router.post("/listings/{listing_id}/images", status_code=201)
async def upload_listing_image(
    listing_id: UUID,
    file: UploadFile = File(...),
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise APIError(
            status_code=422,
            code="LISTING_IMAGE_TYPE_INVALID",
            message="Photos must be JPEG, PNG, or WEBP.",
        )
    contents = await file.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise APIError(
            status_code=413,
            code="LISTING_IMAGE_TOO_LARGE",
            message="Photos must be 8 MB or smaller.",
        )
    service.add_image(
        listing_id,
        actor.user,
        storage=storage,
        file_obj=io.BytesIO(contents),
        content_type=file.content_type,
    )
    return listing_response(service.get_listing(listing_id, include_private=True), storage)


@router.delete("/listings/{listing_id}/images/{image_id}", status_code=204)
def delete_listing_image(
    listing_id: UUID,
    image_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> None:
    service.remove_image(listing_id, image_id, actor.user, storage=storage)


@router.post("/listings/{listing_id}/availability-blocks", status_code=201)
def add_availability_block(
    listing_id: UUID,
    payload: AvailabilityBlockRequest,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> dict[str, str]:
    block = service.add_block(listing_id, actor.user, **payload.model_dump())
    return {"id": str(block.id)}


@router.put("/me/seller-header")
def upsert_seller_header(
    payload: SellerHeaderRequest,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> SellerHeaderResponse:
    header = service.upsert_seller_header(actor.user, **payload.model_dump())
    return SellerHeaderResponse(
        user_id=header.user_id,
        display_name=header.display_name,
        description=header.description,
        public_locality=header.public_locality,
        operating_hours=header.operating_hours,
        moderation_status=header.moderation_status,
    )


@router.get("/sellers/{user_id}")
def public_seller(
    user_id: UUID,
    db: Session = Depends(get_db),
) -> SellerHeaderResponse:
    header = db.get(SellerHeader, user_id)
    if header is None or header.moderation_status != "active":
        raise APIError(status_code=404, code="SELLER_NOT_FOUND", message="Seller not found.")
    return SellerHeaderResponse(
        user_id=header.user_id,
        display_name=header.display_name,
        description=header.description,
        public_locality=header.public_locality,
        operating_hours=header.operating_hours,
        moderation_status=header.moderation_status,
    )
