"""Catalog and seller API routes."""

from uuid import UUID

from fastapi import APIRouter, Depends, Query
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import APIError
from app.domains.catalog.models import Category, Listing, SellerHeader
from app.domains.catalog.schemas import (
    AvailabilityBlockRequest,
    CategoryResponse,
    ListingCreateRequest,
    ListingResponse,
    ListingUpdateRequest,
    PriceResponse,
    SellerHeaderRequest,
    SellerHeaderResponse,
)
from app.domains.catalog.service import CatalogService
from app.domains.identity.dependencies import ActorContext, require_actor, require_csrf

router = APIRouter(tags=["catalog"])


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


def listing_response(listing: Listing) -> ListingResponse:
    return ListingResponse(
        id=listing.id,
        owner_user_id=listing.owner_user_id,
        category=category_response(listing.category),
        title=listing.title,
        description=listing.description,
        condition=listing.condition,
        quantity=listing.quantity,
        attributes=listing.attributes,
        status=listing.status,
        pickup_enabled=listing.pickup_enabled,
        delivery_enabled=listing.delivery_enabled,
        public_locality=listing.public_locality,
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
        created_at=listing.created_at,
    )


@router.get("/categories")
def list_categories(db: Session = Depends(get_db)) -> list[CategoryResponse]:
    categories = db.scalars(
        select(Category).where(Category.enabled.is_(True)).order_by(Category.name)
    ).all()
    return [category_response(category) for category in categories]


@router.get("/listings")
def search_listings(
    q: str | None = Query(default=None, max_length=120),
    category_id: UUID | None = None,
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: int = Query(default=25, ge=1, le=200),
    limit: int = Query(default=20, ge=1, le=100),
    service: CatalogService = Depends(get_catalog_service),
) -> list[ListingResponse]:
    listings = service.search(
        query=q,
        category_id=category_id,
        latitude=latitude,
        longitude=longitude,
        radius_km=radius_km,
        limit=limit,
    )
    return [listing_response(listing) for listing in listings]


@router.get("/listings/{listing_id}")
def get_listing(
    listing_id: UUID,
    service: CatalogService = Depends(get_catalog_service),
) -> ListingResponse:
    return listing_response(service.get_listing(listing_id))


@router.get("/me/listings")
def my_listings(
    actor: ActorContext = Depends(require_actor),
    db: Session = Depends(get_db),
) -> list[ListingResponse]:
    listings = db.scalars(
        select(Listing)
        .where(Listing.owner_user_id == actor.user.id)
        .order_by(Listing.created_at.desc())
    ).all()
    service = CatalogService(db)
    return [
        listing_response(service.get_listing(item.id, include_private=True))
        for item in listings
    ]


@router.post("/listings", status_code=201)
def create_listing(
    payload: ListingCreateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> ListingResponse:
    return listing_response(service.create_listing(actor.user, payload))


@router.patch("/listings/{listing_id}")
def update_listing(
    listing_id: UUID,
    payload: ListingUpdateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> ListingResponse:
    return listing_response(service.update_listing(listing_id, actor.user, payload))


def _transition_listing(
    listing_id: UUID,
    action: str,
    actor: ActorContext,
    service: CatalogService,
) -> ListingResponse:
    return listing_response(service.transition(listing_id, actor.user, action))


@router.post("/listings/{listing_id}/publish")
def publish_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> ListingResponse:
    return _transition_listing(listing_id, "publish", actor, service)


@router.post("/listings/{listing_id}/pause")
def pause_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> ListingResponse:
    return _transition_listing(listing_id, "pause", actor, service)


@router.post("/listings/{listing_id}/resume")
def resume_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> ListingResponse:
    return _transition_listing(listing_id, "resume", actor, service)


@router.post("/listings/{listing_id}/archive")
def archive_listing(
    listing_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: CatalogService = Depends(get_catalog_service),
) -> ListingResponse:
    return _transition_listing(listing_id, "archive", actor, service)


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
