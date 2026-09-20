"""Store API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

_HOUR_PATTERN = r"^([01]\d|2[0-3]):[0-5]\d$"


class StoreHoursInterval(BaseModel):
    opens_at: str = Field(pattern=_HOUR_PATTERN)
    closes_at: str = Field(pattern=_HOUR_PATTERN)


class StoreHoursInput(BaseModel):
    monday: StoreHoursInterval | None = None
    tuesday: StoreHoursInterval | None = None
    wednesday: StoreHoursInterval | None = None
    thursday: StoreHoursInterval | None = None
    friday: StoreHoursInterval | None = None
    saturday: StoreHoursInterval | None = None
    sunday: StoreHoursInterval | None = None


class StoreCreateRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1200)
    public_locality: str = Field(min_length=2, max_length=160)
    operating_hours: StoreHoursInput = Field(default_factory=StoreHoursInput)


class StoreUpdateRequest(BaseModel):
    display_name: str | None = Field(default=None, min_length=2, max_length=120)
    description: str | None = Field(default=None, max_length=1200)
    public_locality: str | None = Field(default=None, min_length=2, max_length=160)
    operating_hours: StoreHoursInput | None = None
    version: int = Field(gt=0)


class StoreListingCountsResponse(BaseModel):
    draft: int = 0
    active: int = 0
    paused: int = 0
    archived: int = 0
    total: int = 0


class StoreSummaryResponse(BaseModel):
    id: UUID
    slug: str
    display_name: str
    logo_url: str | None = None
    public_locality: str


class StoreOwnerResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    slug: str
    display_name: str
    description: str
    public_locality: str
    operating_hours: dict[str, object]
    logo_url: str | None = None
    cover_url: str | None = None
    status: str
    moderation_status: str
    version: int
    listing_counts: StoreListingCountsResponse
    created_at: datetime


class StorePublicResponse(BaseModel):
    id: UUID
    slug: str
    display_name: str
    description: str
    public_locality: str
    operating_hours: dict[str, object]
    logo_url: str | None = None
    cover_url: str | None = None
    active_listing_count: int


class ListingStoreAssignmentRequest(BaseModel):
    store_id: UUID | None = None
    listing_version: int = Field(gt=0)

    @field_validator("store_id", mode="before")
    @classmethod
    def blank_string_is_null(cls, value: object) -> object:
        if isinstance(value, str) and not value.strip():
            return None
        return value
