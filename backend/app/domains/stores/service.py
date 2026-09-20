"""Store ownership, lifecycle, media, and listing-assignment services."""

import re
from typing import BinaryIO
from uuid import UUID

from sqlalchemy import func, select
from sqlalchemy.orm import Session, selectinload

from app.core.config import get_settings
from app.core.errors import APIError
from app.core.storage import ObjectStorage
from app.domains.catalog.models import Listing
from app.domains.identity.models import User
from app.domains.stores.models import ListingStoreHistory, Store, StoreStatusHistory
from app.domains.stores.schemas import StoreCreateRequest, StoreUpdateRequest

_ACTIVE_LIMIT_STATUSES = ("active", "paused")

_PAUSE_TARGETS = {"pause": "paused", "resume": "active", "archive": "archived"}
_TRANSITIONS: dict[tuple[str, str], str] = {
    ("active", "pause"): "paused",
    ("paused", "resume"): "active",
    ("active", "archive"): "archived",
    ("paused", "archive"): "archived",
}


class StoreService:
    def __init__(self, session: Session) -> None:
        self.session = session

    # -- creation and slugs -------------------------------------------------

    def _slugify(self, name: str) -> str:
        base = re.sub(r"[^a-z0-9]+", "-", name.strip().lower()).strip("-")
        return base or "store"

    def _unique_slug(self, name: str) -> str:
        base = self._slugify(name)
        candidate = base
        suffix = 2
        while self.session.scalar(select(Store.id).where(Store.slug == candidate)) is not None:
            candidate = f"{base}-{suffix}"
            suffix += 1
        return candidate

    def create_store(self, owner: User, payload: StoreCreateRequest) -> Store:
        limit = get_settings().store_limit_per_user
        active_count = (
            self.session.scalar(
                select(func.count())
                .select_from(Store)
                .where(
                    Store.owner_user_id == owner.id,
                    Store.status.in_(_ACTIVE_LIMIT_STATUSES),
                )
            )
            or 0
        )
        if active_count >= limit:
            raise APIError(
                status_code=409,
                code="STORE_LIMIT_REACHED",
                message=f"You can have up to {limit} stores.",
            )
        store = Store(
            owner_user_id=owner.id,
            slug=self._unique_slug(payload.display_name),
            display_name=payload.display_name.strip(),
            description=payload.description.strip(),
            public_locality=payload.public_locality.strip(),
            operating_hours=payload.operating_hours.model_dump(exclude_none=True),
            status="active",
            moderation_status="active",
            version=1,
        )
        self.session.add(store)
        self.session.flush()
        self._store_history(store, None, "active", owner.id, "created")
        self.session.commit()
        self.session.refresh(store)
        return store

    # -- reads ---------------------------------------------------------------

    def list_owner_stores(self, owner_id: UUID) -> list[Store]:
        return list(
            self.session.scalars(
                select(Store)
                .where(Store.owner_user_id == owner_id)
                .order_by(Store.created_at.desc())
            )
        )

    def owner_store(self, store_id: UUID, owner_id: UUID) -> Store:
        store = self.session.get(Store, store_id)
        if store is None:
            raise APIError(status_code=404, code="STORE_NOT_FOUND", message="Store not found.")
        if store.owner_user_id != owner_id:
            raise APIError(
                status_code=403, code="STORE_FORBIDDEN", message="Store access denied."
            )
        return store

    def public_store(self, slug: str) -> Store:
        store = self.session.scalar(select(Store).where(Store.slug == slug))
        if store is None or store.status != "active" or store.moderation_status != "active":
            raise APIError(status_code=404, code="STORE_NOT_FOUND", message="Store not found.")
        return store

    def listing_counts(self, store_id: UUID) -> dict[str, int]:
        rows = self.session.execute(
            select(Listing.status, func.count())
            .where(Listing.store_id == store_id)
            .group_by(Listing.status)
        ).all()
        counts: dict[str, int] = {str(row[0]): int(row[1]) for row in rows}
        total = sum(counts.values())
        return {
            "draft": counts.get("draft", 0),
            "active": counts.get("active", 0),
            "paused": counts.get("paused", 0),
            "archived": counts.get("archived", 0),
            "total": total,
        }

    def active_listing_count(self, store_id: UUID) -> int:
        return (
            self.session.scalar(
                select(func.count())
                .select_from(Listing)
                .where(
                    Listing.store_id == store_id,
                    Listing.status == "active",
                    Listing.is_seed_data.is_(False),
                )
            )
            or 0
        )

    # -- mutation --------------------------------------------------------------

    def update_store(self, store_id: UUID, owner: User, payload: StoreUpdateRequest) -> Store:
        store = self.owner_store(store_id, owner.id)
        if store.version != payload.version:
            raise APIError(
                status_code=409,
                code="STORE_VERSION_CONFLICT",
                message="The store changed. Refresh and try again.",
            )
        if payload.display_name is not None:
            store.display_name = payload.display_name.strip()
        if payload.description is not None:
            store.description = payload.description.strip()
        if payload.public_locality is not None:
            store.public_locality = payload.public_locality.strip()
        if payload.operating_hours is not None:
            store.operating_hours = payload.operating_hours.model_dump(exclude_none=True)
        store.version += 1
        self.session.commit()
        self.session.refresh(store)
        return store

    def transition_store(self, store_id: UUID, owner: User, action: str) -> Store:
        store = self.owner_store(store_id, owner.id)
        if store.status == _PAUSE_TARGETS.get(action):
            return store
        target = _TRANSITIONS.get((store.status, action))
        if target is None:
            raise APIError(
                status_code=409,
                code="STORE_TRANSITION_DENIED",
                message="The store cannot perform that action from its current status.",
            )
        previous = store.status
        store.status = target
        store.version += 1
        self._store_history(store, previous, target, owner.id, action)
        if action == "archive":
            self._detach_all_listings(store, owner.id)
        self.session.commit()
        self.session.refresh(store)
        return store

    def _detach_all_listings(self, store: Store, actor_id: UUID) -> None:
        listings = list(
            self.session.scalars(select(Listing).where(Listing.store_id == store.id))
        )
        for listing in listings:
            listing.store_id = None
            self.session.add(
                ListingStoreHistory(
                    listing_id=listing.id,
                    from_store_id=store.id,
                    to_store_id=None,
                    actor_user_id=actor_id,
                    reason_code="store_archived",
                )
            )

    # -- listing association --------------------------------------------------

    def list_owner_store_listings(
        self, store_id: UUID, owner_id: UUID, status: str | None
    ) -> list[Listing]:
        self.owner_store(store_id, owner_id)
        statement = (
            select(Listing)
            .options(
                selectinload(Listing.prices),
                selectinload(Listing.category),
                selectinload(Listing.images),
            )
            .where(Listing.store_id == store_id)
            .order_by(Listing.created_at.desc())
        )
        if status:
            statement = statement.where(Listing.status == status)
        return list(self.session.scalars(statement).unique())

    def list_public_store_listings(self, slug: str, limit: int) -> tuple[Store, list[Listing]]:
        store = self.public_store(slug)
        statement = (
            select(Listing)
            .options(
                selectinload(Listing.prices),
                selectinload(Listing.category),
                selectinload(Listing.images),
            )
            .where(
                Listing.store_id == store.id,
                Listing.status == "active",
                Listing.is_seed_data.is_(False),
            )
            .order_by(Listing.created_at.desc())
            .limit(limit)
        )
        return store, list(self.session.scalars(statement).unique())

    def assign_listing(
        self,
        listing_id: UUID,
        owner: User,
        store_id: UUID | None,
        listing_version: int,
    ) -> Listing:
        listing = self.session.get(Listing, listing_id)
        if listing is None:
            raise APIError(
                status_code=404, code="LISTING_NOT_FOUND", message="Listing not found."
            )
        if listing.owner_user_id != owner.id:
            raise APIError(
                status_code=403, code="LISTING_FORBIDDEN", message="Listing access denied."
            )
        if listing.version != listing_version:
            raise APIError(
                status_code=409,
                code="LISTING_VERSION_CONFLICT",
                message="The listing changed. Refresh and try again.",
            )
        if store_id is not None:
            target_store = self.owner_store(store_id, owner.id)
            if target_store.status != "active":
                raise APIError(
                    status_code=409,
                    code="STORE_TRANSITION_DENIED",
                    message="Listings can only be assigned to an active store.",
                )
        if listing.store_id == store_id:
            return listing
        previous_store_id = listing.store_id
        listing.store_id = store_id
        listing.version += 1
        self.session.add(
            ListingStoreHistory(
                listing_id=listing.id,
                from_store_id=previous_store_id,
                to_store_id=store_id,
                actor_user_id=owner.id,
                reason_code="assignment",
            )
        )
        self.session.commit()
        self.session.refresh(listing)
        return listing

    # -- media -----------------------------------------------------------------

    def upload_logo(
        self,
        store_id: UUID,
        owner: User,
        *,
        storage: ObjectStorage,
        file_obj: BinaryIO,
        content_type: str,
    ) -> Store:
        return self._upload_media(
            store_id,
            owner,
            storage=storage,
            file_obj=file_obj,
            content_type=content_type,
            field="logo_object_key",
        )

    def remove_logo(self, store_id: UUID, owner: User, *, storage: ObjectStorage) -> Store:
        return self._remove_media(store_id, owner, storage=storage, field="logo_object_key")

    def upload_cover(
        self,
        store_id: UUID,
        owner: User,
        *,
        storage: ObjectStorage,
        file_obj: BinaryIO,
        content_type: str,
    ) -> Store:
        return self._upload_media(
            store_id,
            owner,
            storage=storage,
            file_obj=file_obj,
            content_type=content_type,
            field="cover_object_key",
        )

    def remove_cover(self, store_id: UUID, owner: User, *, storage: ObjectStorage) -> Store:
        return self._remove_media(store_id, owner, storage=storage, field="cover_object_key")

    def _upload_media(
        self,
        store_id: UUID,
        owner: User,
        *,
        storage: ObjectStorage,
        file_obj: BinaryIO,
        content_type: str,
        field: str,
    ) -> Store:
        store = self.owner_store(store_id, owner.id)
        old_key = getattr(store, field)
        new_key = storage.upload(
            file_obj=file_obj,
            content_type=content_type,
            key_prefix=f"stores/{store.id}/{field.split('_')[0]}",
        )
        setattr(store, field, new_key)
        self.session.commit()
        self.session.refresh(store)
        if old_key:
            storage.delete(old_key)
        return store

    def _remove_media(
        self, store_id: UUID, owner: User, *, storage: ObjectStorage, field: str
    ) -> Store:
        store = self.owner_store(store_id, owner.id)
        old_key = getattr(store, field)
        if old_key:
            storage.delete(old_key)
            setattr(store, field, None)
            self.session.commit()
            self.session.refresh(store)
        return store

    # -- history -----------------------------------------------------------------

    def _store_history(
        self, store: Store, previous: str | None, target: str, actor_id: UUID, reason: str
    ) -> None:
        self.session.add(
            StoreStatusHistory(
                store_id=store.id,
                from_status=previous,
                to_status=target,
                actor_user_id=actor_id,
                reason_code=reason,
            )
        )
