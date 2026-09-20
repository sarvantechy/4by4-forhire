"""Structured logging with mandatory sensitive-value redaction."""

import json
import logging
import re
import sys
from collections.abc import Awaitable, Callable
from datetime import UTC, datetime
from time import perf_counter
from typing import Any

from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from starlette.responses import Response

LOGGER_NAME = "forhire"
_SENSITIVE_PATTERNS = (
    (re.compile(r"Bearer\s+[a-z0-9._~+/=-]+", re.IGNORECASE), "Bearer [REDACTED]"),
    (re.compile(r"[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}", re.IGNORECASE), "[EMAIL]"),
    (re.compile(r"(?:\+91[ -]?)?[6-9]\d{9}"), "[PHONE]"),
    (re.compile(r"([?&]X-Amz-Signature=)[^&\s]+", re.IGNORECASE), r"\1[REDACTED]"),
)


def redact_sensitive(value: str) -> str:
    """Redact supported secret and personal-data patterns from text."""
    redacted = value
    for pattern, replacement in _SENSITIVE_PATTERNS:
        redacted = pattern.sub(replacement, redacted)
    return redacted


class JSONFormatter(logging.Formatter):
    """Render stable JSON logs without request or exception bodies."""

    def format(self, record: logging.LogRecord) -> str:
        payload: dict[str, Any] = {
            "timestamp": datetime.now(UTC).isoformat(),
            "level": record.levelname,
            "logger": record.name,
            "message": redact_sensitive(record.getMessage()),
        }
        for field in ("request_id", "method", "route", "status_code", "duration_ms"):
            value = getattr(record, field, None)
            if value is not None:
                payload[field] = value
        return json.dumps(payload, separators=(",", ":"), sort_keys=True)


def configure_logging(level: str) -> logging.Logger:
    """Configure the application logger once per process."""
    logger = logging.getLogger(LOGGER_NAME)
    logger.setLevel(level.upper())
    logger.propagate = False
    if not logger.handlers:
        handler = logging.StreamHandler(sys.stdout)
        handler.setFormatter(JSONFormatter())
        logger.addHandler(handler)
    return logger


class RequestLoggingMiddleware(BaseHTTPMiddleware):
    """Emit one metadata-only completion event per HTTP request."""

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        started_at = perf_counter()
        response = await call_next(request)
        duration_ms = round((perf_counter() - started_at) * 1000, 2)
        logging.getLogger(LOGGER_NAME).info(
            "request_completed",
            extra={
                "duration_ms": duration_ms,
                "method": request.method,
                "request_id": getattr(request.state, "request_id", None),
                "route": request.url.path,
                "status_code": response.status_code,
            },
        )
        return response
