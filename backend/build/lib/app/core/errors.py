"""Stable public API error responses."""

from typing import Any, cast

from fastapi import Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from starlette.exceptions import HTTPException as StarletteHTTPException


class APIError(Exception):
    """Expected application error safe to expose to clients."""

    def __init__(
        self,
        *,
        status_code: int,
        code: str,
        message: str,
        details: dict[str, Any] | None = None,
    ) -> None:
        super().__init__(message)
        self.status_code = status_code
        self.code = code
        self.message = message
        self.details = details or {}


def _error_content(
    request: Request,
    *,
    code: str,
    message: str,
    details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    return {
        "error": {
            "code": code,
            "message": message,
            "request_id": getattr(request.state, "request_id", None),
            "details": details or {},
        }
    }


def api_error_handler(request: Request, error: Exception) -> JSONResponse:
    """Render an expected domain or application error."""
    api_error = cast(APIError, error)
    return JSONResponse(
        status_code=api_error.status_code,
        content=_error_content(
            request,
            code=api_error.code,
            message=api_error.message,
            details=api_error.details,
        ),
    )


def http_error_handler(request: Request, error: Exception) -> JSONResponse:
    """Render framework HTTP errors without exposing internals."""
    http_error = cast(StarletteHTTPException, error)
    return JSONResponse(
        status_code=http_error.status_code,
        content=_error_content(
            request,
            code=f"HTTP_{http_error.status_code}",
            message=str(http_error.detail),
        ),
    )


def validation_error_handler(request: Request, error: Exception) -> JSONResponse:
    """Render safe field-level request validation errors."""
    validation_error = cast(RequestValidationError, error)
    details = {
        "fields": [
            {
                "location": [str(part) for part in item["loc"]],
                "message": item["msg"],
                "type": item["type"],
            }
            for item in validation_error.errors()
        ]
    }
    return JSONResponse(
        status_code=422,
        content=_error_content(
            request,
            code="REQUEST_VALIDATION_FAILED",
            message="The request contains invalid fields.",
            details=details,
        ),
    )
