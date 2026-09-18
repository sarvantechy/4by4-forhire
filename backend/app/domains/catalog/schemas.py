"""Catalog API schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


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
    title: str = Field(min_length=3, max_length=160)
    description: str = Field(min_length=10, max_length=5000)
    condition: Literal["new", "like_new", "good", "fair"]
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
        return self


class ListingUpdateRequest(BaseModel):
    title: str | None = Field(default=None, min_length=3, max_length=160)
    description: str | None = Field(default=None, min_length=10, max_length=5000)
    condition: Literal["new", "like_new", "good", "fair"] | None = None
    quantity: int | None = Field(default=None, gt=0, le=1000)
    pickup_enabled: bool | None = None
    delivery_enabled: bool | None = None
    public_locality: str | None = Field(default=None, min_length=2, max_length=160)
    version: int = Field(gt=0)


class PriceResponse(PriceInput):
    id: UUID


class ListingResponse(BaseModel):
    id: UUID
    owner_user_id: UUID
    category: CategoryResponse
    title: str
    description: str
    condition: str
    quantity: int
    attributes: dict[str, object]
    status: str
    pickup_enabled: bool
    delivery_enabled: bool
    public_locality: str
    version: int
    prices: list[PriceResponse]
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
