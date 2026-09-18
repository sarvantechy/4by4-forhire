"""Catalog ownership, lifecycle, and search services."""

from uuid import UUID

from geoalchemy2.elements import WKTElement
from sqlalchemy import Select, func, or_, select
from sqlalchemy.orm import Session, selectinload

from app.core.errors import APIError
from app.domains.catalog.models import (
    AvailabilityBlock,
    Category,
    Listing,
    ListingPrice,
    ListingStatusHistory,
    SellerHeader,
)
from app.domains.catalog.schemas import ListingCreateRequest, ListingUpdateRequest
from app.domains.identity.models import User


class CatalogService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def create_listing(self, owner: User, payload: ListingCreateRequest) -> Listing:
        category = self.session.get(Category, payload.category_id)
        if category is None or not category.enabled:
            raise APIError(
                status_code=404,
                code="CATEGORY_NOT_FOUND",
                message="Category not found.",
            )
        data = payload.model_dump(exclude={"prices", "latitude", "longitude"})
        listing = Listing(owner_user_id=owner.id, **data)
        if payload.latitude is not None and payload.longitude is not None:
            listing.public_location = WKTElement(
                f"POINT({payload.longitude} {payload.latitude})", srid=4326
            )
        listing.prices = [ListingPrice(**price.model_dump()) for price in payload.prices]
        self.session.add(listing)
        self.session.flush()
        self._history(listing, None, "draft", owner.id, "created")
        self.session.commit()
        return self.get_listing(listing.id, include_private=True)

    def get_listing(self, listing_id: UUID, *, include_private: bool = False) -> Listing:
        statement = (
            select(Listing)
            .options(selectinload(Listing.prices), selectinload(Listing.category))
            .where(Listing.id == listing_id)
        )
        if not include_private:
            statement = statement.where(Listing.status == "active")
        listing = self.session.scalar(statement)
        if listing is None:
            raise APIError(status_code=404, code="LISTING_NOT_FOUND", message="Listing not found.")
        return listing

    def owner_listing(self, listing_id: UUID, owner_id: UUID) -> Listing:
        listing = self.get_listing(listing_id, include_private=True)
        if listing.owner_user_id != owner_id:
            raise APIError(
                status_code=403,
                code="LISTING_FORBIDDEN",
                message="Listing access denied.",
            )
        return listing

    def update_listing(
        self, listing_id: UUID, owner: User, payload: ListingUpdateRequest
    ) -> Listing:
        listing = self.owner_listing(listing_id, owner.id)
        if listing.version != payload.version:
            raise APIError(
                status_code=409,
                code="LISTING_VERSION_CONFLICT",
                message="The listing changed. Refresh and try again.",
            )
        for field, value in payload.model_dump(exclude={"version"}, exclude_none=True).items():
            setattr(listing, field, value)
        listing.version += 1
        if listing.status in {"active", "paused"}:
            self._transition(listing, owner.id, "pending_checks", "material_edit")
        self.session.commit()
        return self.get_listing(listing.id, include_private=True)

    def transition(self, listing_id: UUID, owner: User, action: str) -> Listing:
        listing = self.owner_listing(listing_id, owner.id)
        category = listing.category
        transitions: dict[tuple[str, str], str] = {
            ("draft", "publish"): "under_review"
            if category.risk_tier in {"controlled", "high_value", "restricted"}
            else "active",
            ("paused", "resume"): "active",
            ("active", "pause"): "paused",
            ("draft", "archive"): "archived",
            ("paused", "archive"): "archived",
            ("active", "archive"): "archived",
        }
        target = transitions.get((listing.status, action))
        if target is None:
            raise APIError(
                status_code=409,
                code="LISTING_TRANSITION_DENIED",
                message="The listing cannot perform that action from its current status.",
            )
        self._transition(listing, owner.id, target, action)
        self.session.commit()
        return self.get_listing(listing.id, include_private=True)

    def search(
        self,
        *,
        query: str | None,
        category_id: UUID | None,
        latitude: float | None,
        longitude: float | None,
        radius_km: int,
        limit: int,
    ) -> list[Listing]:
        statement: Select[tuple[Listing]] = (
            select(Listing)
            .options(selectinload(Listing.prices), selectinload(Listing.category))
            .where(Listing.status == "active")
            .order_by(Listing.created_at.desc())
            .limit(limit)
        )
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(Listing.title.ilike(pattern), Listing.description.ilike(pattern))
            )
        if category_id:
            statement = statement.where(Listing.category_id == category_id)
        if latitude is not None and longitude is not None:
            point = func.ST_SetSRID(func.ST_MakePoint(longitude, latitude), 4326)
            statement = statement.where(
                func.ST_DWithin(Listing.public_location, point, radius_km * 1000)
            )
        return list(self.session.scalars(statement).unique())

    def add_block(
        self, listing_id: UUID, owner: User, **values: object
    ) -> AvailabilityBlock:
        listing = self.owner_listing(listing_id, owner.id)
        block = AvailabilityBlock(listing_id=listing.id, **values)
        self.session.add(block)
        self.session.commit()
        self.session.refresh(block)
        return block

    def upsert_seller_header(self, user: User, **values: object) -> SellerHeader:
        header = self.session.get(SellerHeader, user.id)
        if header is None:
            header = SellerHeader(user_id=user.id, **values)
            self.session.add(header)
        else:
            for field, value in values.items():
                setattr(header, field, value)
        self.session.commit()
        self.session.refresh(header)
        return header

    def _transition(
        self,
        listing: Listing,
        actor_id: UUID,
        target: str,
        reason: str,
    ) -> None:
        previous = listing.status
        listing.status = target
        listing.version += 1
        self._history(listing, previous, target, actor_id, reason)

    def _history(
        self,
        listing: Listing,
        previous: str | None,
        target: str,
        actor_id: UUID,
        reason: str,
    ) -> None:
        self.session.add(
            ListingStatusHistory(
                listing_id=listing.id,
                from_status=previous,
                to_status=target,
                actor_user_id=actor_id,
                reason_code=reason,
            )
        )
