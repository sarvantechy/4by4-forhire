"""Liveness, readiness, and version endpoints."""

from typing import Literal

from fastapi import APIRouter, Request
from pydantic import BaseModel

from app import __version__

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    """Health state returned by application probes."""

    status: Literal["ok"]
    service: str
    version: str


class ReadinessResponse(HealthResponse):
    """Readiness state with dependency checks."""

    checks: dict[str, Literal["ok"]]


class VersionResponse(BaseModel):
    """Public application version."""

    service: str
    version: str


@router.get("/health/live")
def liveness(request: Request) -> HealthResponse:
    """Report whether the API process can serve requests."""
    settings = request.app.state.settings
    return HealthResponse(status="ok", service=settings.service_name, version=__version__)


@router.get("/health/ready")
def readiness(request: Request) -> ReadinessResponse:
    """Report readiness for dependencies implemented in the current phase."""
    settings = request.app.state.settings
    return ReadinessResponse(
        status="ok",
        service=settings.service_name,
        version=__version__,
        checks={"application": "ok"},
    )


@router.get("/version")
def version(request: Request) -> VersionResponse:
    """Return the API service and release version."""
    settings = request.app.state.settings
    return VersionResponse(service=settings.service_name, version=__version__)
