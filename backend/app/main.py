"""FastAPI application factory."""

from fastapi import FastAPI
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from starlette.exceptions import HTTPException as StarletteHTTPException

from app import __version__
from app.api.v1.router import router as api_v1_router
from app.core.config import Settings, get_settings
from app.core.errors import (
    APIError,
    api_error_handler,
    http_error_handler,
    validation_error_handler,
)
from app.core.logging import RequestLoggingMiddleware, configure_logging
from app.core.request_id import RequestIDMiddleware


def create_app(settings: Settings | None = None) -> FastAPI:
    """Create and configure the API application."""
    resolved_settings = settings or get_settings()
    configure_logging(resolved_settings.log_level)
    application = FastAPI(
        title="4by4 For Hire API",
        version=__version__,
        docs_url="/api/docs" if resolved_settings.docs_enabled else None,
        openapi_url="/api/v1/openapi.json" if resolved_settings.docs_enabled else None,
        redoc_url=None,
    )
    application.state.settings = resolved_settings

    application.add_middleware(
        CORSMiddleware,
        allow_origins=resolved_settings.allowed_origins,
        allow_credentials=True,
        allow_methods=["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
        allow_headers=[
            "Authorization",
            "Content-Type",
            "Idempotency-Key",
            "X-CSRF-Token",
            "X-Request-ID",
        ],
        expose_headers=["X-Request-ID"],
    )
    application.add_middleware(RequestIDMiddleware)
    application.add_middleware(RequestLoggingMiddleware)

    application.add_exception_handler(APIError, api_error_handler)
    application.add_exception_handler(StarletteHTTPException, http_error_handler)
    application.add_exception_handler(RequestValidationError, validation_error_handler)
    application.include_router(api_v1_router, prefix=resolved_settings.api_v1_prefix)
    return application


app = create_app()
