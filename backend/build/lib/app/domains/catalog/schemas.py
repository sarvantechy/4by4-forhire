"""Catalog API schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator

from app.domains.stores.schemas import StoreSummaryResponse


class CategoryResponse(BaseModel):
    id: UUID
    slug: str
    name: str
    risk_tier: str
    required_attributes: dict[str, object]


class PriceInput(BaseModel):
    unit: Literal["hour", "day", "week", "month"]
    amount_minor: int = Field(gt=0)
    deposit_minor: int = Field(default=0, ge=0)
    currency: Literal["INR"] = "INR"


class ListingCreateRequest(BaseModel):
    category_id: UUID
    listing_type: Literal["item", "service"] = "item"
    store_id: UUID | None = None
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=5000)
    condition: Literal["new", "like_new", "good", "fair"] | None = None
    quantity: int = Field(default=1, gt=0, le=1000)
    attributes: dict[str, object] = Field(default_factory=dict)
    pickup_enabled: bool = True
    delivery_enabled: bool = False
    public_locality: str = Field(min_length=2, max_length=160)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    prices: list[PriceInput] = Field(min_length=1, max_length=4)

    @model_validator(mode="after")
    def require_pickup_or_delivery(self) -> "ListingCreateRequest":
        if not self.pickup_enabled and not self.delivery_enabled:
            raise ValueError("Enable pickup or owner-managed delivery")
        if (self.latitude is None) != (self.longitude is None):
            raise ValueError("Latitude and longitude must be provided together")
        if self.listing_type == "item" and self.condition is None:
            raise ValueError("Condition is required for item listings")
        if self.listing_type == "service" and not str(self.attributes.get("skill") or "").strip():
            raise ValueError("Describe the skill or work offered for a service listing")
        return self


class ListingUpdateRequest(BaseModel):
    category_id: UUID | None = None
    title: str | None = Field(default=None, min_length=3, max_length=160)
    description: str | None = Field(default=None, min_length=10, max_length=5000)
    condition: Literal["new", "like_new", "good", "fair"] | None = None
    quantity: int | None = Field(default=None, gt=0, le=1000)
    attributes: dict[str, object] | None = None
    pickup_enabled: bool | None = None
    delivery_enabled: bool | None = None
    public_locality: str | None = Field(default=None, min_length=2, max_length=160)
    latitude: float | None = Field(default=None, ge=-90, le=90)
    longitude: float | None = Field(default=None, ge=-180, le=180)
    prices: list[PriceInput] | None = Field(default=None, min_length=1, max_length=4)
    version: int = Field(gt=0)

    @model_validator(mode="after")
    def require_complete_coordinates(self) -> "ListingUpdateRequest":
        has_latitude = "latitude" in self.model_fields_set
        has_longitude = "longitude" in self.model_fields_set
        if has_latitude != has_longitude:
            raise ValueError("Latitude and longitude must be provided together")
        return self


class PriceResponse(PriceInput):
    id: UUID


class ListingImageResponse(BaseModel):
    id: UUID
    url: str
    position: int


class ListingResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    category: CategoryResponse
    listing_type: str
    title: str
    description: str
    condition: str
    quantity: int
    attributes: dict[str, object]
    status: str
    pickup_enabled: bool
    delivery_enabled: bool
    public_locality: str
    latitude: float | None = None
    longitude: float | None = None
    version: int
    prices: list[PriceResponse]
    images: list[ListingImageResponse]
    store: StoreSummaryResponse | None = None
    created_at: datetime


class AvailabilityBlockRequest(BaseModel):
    starts_at: datetime
    ends_at: datetime
    quantity: int = Field(gt=0)
    reason: str = Field(min_length=2, max_length=120)

    @model_validator(mode="after")
    def valid_interval(self) -> "AvailabilityBlockRequest":
        if self.ends_at <= self.starts_at:
            raise ValueError("End time must be after start time")
        return self


class SellerHeaderRequest(BaseModel):
    display_name: str = Field(min_length=2, max_length=120)
    description: str = Field(default="", max_length=1200)
    public_locality: str = Field(min_length=2, max_length=160)
    operating_hours: dict[str, object] = Field(default_factory=dict)


class SellerHeaderResponse(SellerHeaderRequest):
    user_id: UUID
    moderation_status: str
