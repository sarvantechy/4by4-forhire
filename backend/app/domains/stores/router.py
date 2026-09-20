"""Owner and public store API routes."""

import io
from uuid import UUID

from fastapi import APIRouter, Depends, File, Query, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.errors import APIError
from app.core.storage import ObjectStorage, get_object_storage
from app.domains.catalog.router import (
    ALLOWED_IMAGE_CONTENT_TYPES,
    MAX_IMAGE_BYTES,
    get_catalog_service,
    listing_response,
)
from app.domains.catalog.schemas import ListingResponse
from app.domains.catalog.service import CatalogService
from app.domains.identity.dependencies import ActorContext, require_actor, require_csrf
from app.domains.stores.models import Store
from app.domains.stores.schemas import (
    ListingStoreAssignmentRequest,
    StoreCreateRequest,
    StoreListingCountsResponse,
    StoreOwnerResponse,
    StorePublicResponse,
    StoreUpdateRequest,
)
from app.domains.stores.service import StoreService

router = APIRouter(tags=["stores"])


def get_store_service(db: Session = Depends(get_db)) -> StoreService:
    return StoreService(db)


def _media_url(storage: ObjectStorage, object_key: str | None) -> str | None:
    return storage.presigned_url(object_key) if object_key else None


def store_owner_response(
    service: StoreService, store: Store, storage: ObjectStorage
) -> StoreOwnerResponse:
    counts = service.listing_counts(store.id)
    return StoreOwnerResponse(
        id=store.id,
        owner_user_id=store.owner_user_id,
        slug=store.slug,
        display_name=store.display_name,
        description=store.description,
        public_locality=store.public_locality,
        operating_hours=store.operating_hours,
        logo_url=_media_url(storage, store.logo_object_key),
        cover_url=_media_url(storage, store.cover_object_key),
        status=store.status,
        moderation_status=store.moderation_status,
        version=store.version,
        listing_counts=StoreListingCountsResponse(**counts),
        created_at=store.created_at,
    )


def store_public_response(
    service: StoreService, store: Store, storage: ObjectStorage
) -> StorePublicResponse:
    return StorePublicResponse(
        id=store.id,
        slug=store.slug,
        display_name=store.display_name,
        description=store.description,
        public_locality=store.public_locality,
        operating_hours=store.operating_hours,
        logo_url=_media_url(storage, store.logo_object_key),
        cover_url=_media_url(storage, store.cover_object_key),
        active_listing_count=service.active_listing_count(store.id),
    )


@router.get("/me/stores")
def list_my_stores(
    actor: ActorContext = Depends(require_actor),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> list[StoreOwnerResponse]:
    stores = service.list_owner_stores(actor.user.id)
    return [store_owner_response(service, store, storage) for store in stores]


@router.post("/me/stores", status_code=201)
def create_my_store(
    payload: StoreCreateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    store = service.create_store(actor.user, payload)
    return store_owner_response(service, store, storage)


@router.get("/me/stores/{store_id}")
def get_my_store(
    store_id: UUID,
    actor: ActorContext = Depends(require_actor),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    store = service.owner_store(store_id, actor.user.id)
    return store_owner_response(service, store, storage)


@router.patch("/me/stores/{store_id}")
def update_my_store(
    store_id: UUID,
    payload: StoreUpdateRequest,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    store = service.update_store(store_id, actor.user, payload)
    return store_owner_response(service, store, storage)


def _transition_my_store(
    store_id: UUID,
    action: str,
    actor: ActorContext,
    service: StoreService,
    storage: ObjectStorage,
) -> StoreOwnerResponse:
    store = service.transition_store(store_id, actor.user, action)
    return store_owner_response(service, store, storage)


@router.post("/me/stores/{store_id}/pause")
def pause_my_store(
    store_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    return _transition_my_store(store_id, "pause", actor, service, storage)


@router.post("/me/stores/{store_id}/resume")
def resume_my_store(
    store_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    return _transition_my_store(store_id, "resume", actor, service, storage)


@router.post("/me/stores/{store_id}/archive")
def archive_my_store(
    store_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    return _transition_my_store(store_id, "archive", actor, service, storage)


@router.get("/me/stores/{store_id}/listings")
def list_my_store_listings(
    store_id: UUID,
    status: str | None = Query(
        default=None,
        pattern="^(draft|pending_checks|under_review|active|paused|archived|removed)$",
    ),
    actor: ActorContext = Depends(require_actor),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> list[ListingResponse]:
    listings = service.list_owner_store_listings(store_id, actor.user.id, status)
    return [listing_response(listing, storage) for listing in listings]


async def _read_media_upload(file: UploadFile) -> bytes:
    if file.content_type not in ALLOWED_IMAGE_CONTENT_TYPES:
        raise APIError(
            status_code=422,
            code="STORE_MEDIA_TYPE_INVALID",
            message="Images must be JPEG, PNG, or WEBP.",
        )
    contents = await file.read(MAX_IMAGE_BYTES + 1)
    if len(contents) > MAX_IMAGE_BYTES:
        raise APIError(
            status_code=413,
            code="STORE_MEDIA_TOO_LARGE",
            message="Images must be 8 MB or smaller.",
        )
    return contents


@router.post("/me/stores/{store_id}/logo", status_code=201)
async def upload_my_store_logo(
    store_id: UUID,
    file: UploadFile = File(...),
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    contents = await _read_media_upload(file)
    content_type = file.content_type or ""
    store = service.upload_logo(
        store_id,
        actor.user,
        storage=storage,
        file_obj=io.BytesIO(contents),
        content_type=content_type,
    )
    return store_owner_response(service, store, storage)


@router.delete("/me/stores/{store_id}/logo")
def delete_my_store_logo(
    store_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    store = service.remove_logo(store_id, actor.user, storage=storage)
    return store_owner_response(service, store, storage)


@router.post("/me/stores/{store_id}/cover", status_code=201)
async def upload_my_store_cover(
    store_id: UUID,
    file: UploadFile = File(...),
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    contents = await _read_media_upload(file)
    content_type = file.content_type or ""
    store = service.upload_cover(
        store_id,
        actor.user,
        storage=storage,
        file_obj=io.BytesIO(contents),
        content_type=content_type,
    )
    return store_owner_response(service, store, storage)


@router.delete("/me/stores/{store_id}/cover")
def delete_my_store_cover(
    store_id: UUID,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StoreOwnerResponse:
    store = service.remove_cover(store_id, actor.user, storage=storage)
    return store_owner_response(service, store, storage)


@router.put("/me/listings/{listing_id}/store")
def assign_listing_store(
    listing_id: UUID,
    payload: ListingStoreAssignmentRequest,
    actor: ActorContext = Depends(require_csrf),
    service: StoreService = Depends(get_store_service),
    catalog_service: CatalogService = Depends(get_catalog_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> ListingResponse:
    updated = service.assign_listing(
        listing_id, actor.user, payload.store_id, payload.listing_version
    )
    listing = catalog_service.get_listing(updated.id, include_private=True)
    return listing_response(listing, storage)


@router.get("/stores/{slug}")
def get_public_store(
    slug: str,
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> StorePublicResponse:
    store = service.public_store(slug)
    return store_public_response(service, store, storage)


@router.get("/stores/{slug}/listings")
def list_public_store_listings(
    slug: str,
    limit: int = Query(default=20, ge=1, le=100),
    service: StoreService = Depends(get_store_service),
    storage: ObjectStorage = Depends(get_object_storage),
) -> list[ListingResponse]:
    _store, listings = service.list_public_store_listings(slug, limit)
    return [listing_response(listing, storage) for listing in listings]
