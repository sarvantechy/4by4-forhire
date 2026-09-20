"""Catalog ownership, lifecycle, and search services."""

from typing import BinaryIO
from uuid import UUID

from geoalchemy2.elements import WKTElement
from sqlalchemy import Select, and_, exists, func, or_, select
from sqlalchemy.orm import Session, selectinload
from sqlalchemy.sql.elements import ColumnElement

from app.core.errors import APIError
from app.core.storage import ObjectStorage
from app.domains.catalog.models import (
    AvailabilityBlock,
    Category,
    Listing,
    ListingImage,
    ListingPrice,
    ListingStatusHistory,
    SellerHeader,
)
from app.domains.catalog.schemas import ListingCreateRequest, ListingUpdateRequest
from app.domains.identity.models import User
from app.domains.stores.models import Store


class CatalogService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def _public_store_visibility(self) -> ColumnElement[bool]:
        """Exclude listings attached to a store that is not itself public."""
        return or_(
            Listing.store_id.is_(None),
            exists().where(
                and_(
                    Store.id == Listing.store_id,
                    Store.status == "active",
                    Store.moderation_status == "active",
                )
            ),
        )

    def create_listing(self, owner: User, payload: ListingCreateRequest) -> Listing:
        category = self.session.get(Category, payload.category_id)
        if category is None or not category.enabled:
            raise APIError(
                status_code=404,
                code="CATEGORY_NOT_FOUND",
                message="Category not found.",
            )
        if payload.store_id is not None:
            store = self.session.get(Store, payload.store_id)
            if store is None or store.owner_user_id != owner.id:
                raise APIError(
                    status_code=403, code="STORE_FORBIDDEN", message="Store access denied."
                )
            if store.status != "active":
                raise APIError(
                    status_code=409,
                    code="STORE_TRANSITION_DENIED",
                    message="Listings can only be created under an active store.",
                )
        data = payload.model_dump(exclude={"prices", "latitude", "longitude"})
        data["condition"] = data.get("condition") or "not_applicable"
        listing = Listing(owner_user_id=owner.id, **data)
        if payload.latitude is not None and payload.longitude is not None:
            listing.public_location = WKTElement(
                f"POINT({payload.longitude} {payload.latitude})", srid=4326
            )
            listing.latitude = payload.latitude
            listing.longitude = payload.longitude
        listing.prices = [ListingPrice(**price.model_dump()) for price in payload.prices]
        self.session.add(listing)
        self.session.flush()
        self._history(listing, None, "draft", owner.id, "created")
        self.session.commit()
        return self.get_listing(listing.id, include_private=True)

    def get_listing(
        self,
        listing_id: UUID,
        *,
        include_private: bool = False,
        viewer_user_id: UUID | None = None,
    ) -> Listing:
        statement = (
            select(Listing)
            .options(
                selectinload(Listing.prices),
                selectinload(Listing.category),
                selectinload(Listing.images),
                selectinload(Listing.store),
            )
            .where(Listing.id == listing_id)
        )
        if not include_private:
            public_visibility = and_(
                Listing.status == "active",
                self._public_store_visibility(),
            )
            if viewer_user_id is not None:
                statement = statement.where(
                    or_(Listing.owner_user_id == viewer_user_id, public_visibility)
                )
            else:
                statement = statement.where(public_visibility)
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
        if payload.category_id is not None:
            category = self.session.get(Category, payload.category_id)
            if category is None or not category.enabled:
                raise APIError(
                    status_code=404,
                    code="CATEGORY_NOT_FOUND",
                    message="Category not found.",
                )
        pickup_enabled = (
            payload.pickup_enabled
            if payload.pickup_enabled is not None
            else listing.pickup_enabled
        )
        delivery_enabled = (
            payload.delivery_enabled
            if payload.delivery_enabled is not None
            else listing.delivery_enabled
        )
        if not pickup_enabled and not delivery_enabled:
            raise APIError(
                status_code=422,
                code="LISTING_FULFILLMENT_REQUIRED",
                message="Enable pickup or owner-managed delivery.",
            )
        data = payload.model_dump(
            exclude={"version", "prices", "latitude", "longitude"},
            exclude_none=True,
        )
        for field, value in data.items():
            setattr(listing, field, value)
        if payload.latitude is not None and payload.longitude is not None:
            listing.public_location = WKTElement(
                f"POINT({payload.longitude} {payload.latitude})", srid=4326
            )
            listing.latitude = payload.latitude
            listing.longitude = payload.longitude
        if payload.prices is not None:
            listing.prices.clear()
            self.session.flush()
            listing.prices = [ListingPrice(**price.model_dump()) for price in payload.prices]
        listing.version += 1
        if listing.status in {"active", "paused"}:
            self._transition(listing, owner.id, "pending_checks", "material_edit")
        self.session.commit()
        return self.get_listing(listing.id, include_private=True)

    def transition(self, listing_id: UUID, owner: User, action: str) -> Listing:
        listing = self.owner_listing(listing_id, owner.id)
        transitions: dict[tuple[str, str], str] = {
            ("draft", "publish"): "active",
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
        listing_type: str | None = None,
        latitude: float | None,
        longitude: float | None,
        radius_km: int,
        limit: int,
        include_seed_data: bool = False,
    ) -> list[Listing]:
        statement: Select[tuple[Listing]] = (
            select(Listing)
            .options(
                selectinload(Listing.prices),
                selectinload(Listing.category),
                selectinload(Listing.images),
                selectinload(Listing.store),
            )
            .where(Listing.status == "active")
            .where(self._public_store_visibility())
            .order_by(Listing.created_at.desc())
            .limit(limit)
        )
        if not include_seed_data:
            statement = statement.where(Listing.is_seed_data.is_(False))
        if query:
            pattern = f"%{query.strip()}%"
            statement = statement.where(
                or_(Listing.title.ilike(pattern), Listing.description.ilike(pattern))
            )
        if category_id:
            statement = statement.where(Listing.category_id == category_id)
        if listing_type:
            statement = statement.where(Listing.listing_type == listing_type)
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

    def add_image(
        self,
        listing_id: UUID,
        owner: User,
        *,
        storage: ObjectStorage,
        file_obj: BinaryIO,
        content_type: str,
    ) -> ListingImage:
        listing = self.owner_listing(listing_id, owner.id)
        if len(listing.images) >= 8:
            raise APIError(
                status_code=409,
                code="LISTING_IMAGE_LIMIT",
                message="A listing can have at most 8 photos.",
            )
        object_key = storage.upload(
            file_obj=file_obj,
            content_type=content_type,
            key_prefix=f"listings/{listing.id}",
        )
        next_position = max((image.position for image in listing.images), default=-1) + 1
        image = ListingImage(listing_id=listing.id, object_key=object_key, position=next_position)
        self.session.add(image)
        self.session.commit()
        self.session.refresh(image)
        return image

    def remove_image(
        self, listing_id: UUID, image_id: UUID, owner: User, *, storage: ObjectStorage
    ) -> None:
        listing = self.owner_listing(listing_id, owner.id)
        image = next((item for item in listing.images if item.id == image_id), None)
        if image is None:
            raise APIError(
                status_code=404, code="LISTING_IMAGE_NOT_FOUND", message="Photo not found."
            )
        storage.delete(image.object_key)
        self.session.delete(image)
        self.session.commit()

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
