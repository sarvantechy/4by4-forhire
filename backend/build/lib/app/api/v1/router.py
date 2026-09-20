"""Version 1 API router."""

from fastapi import APIRouter

from app.api.v1.routes.health import router as health_router
from app.domains.bookings.router import router as bookings_router
from app.domains.catalog.router import router as catalog_router
from app.domains.fulfillment.router import router as fulfillment_router
from app.domains.identity.router import router as identity_router
from app.domains.messaging.router import router as messaging_router
from app.domains.stores.router import router as stores_router

router = APIRouter()
router.include_router(health_router)
router.include_router(identity_router)
router.include_router(catalog_router)
router.include_router(stores_router)
router.include_router(bookings_router)
router.include_router(fulfillment_router)
router.include_router(messaging_router)
