"""Booking API schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, model_validator


class QuoteRequest(BaseModel):
    starts_at: datetime
    ends_at: datetime
    quantity: int = Field(gt=0, le=100)
    unit: Literal["hour", "day", "week", "month"]

    @model_validator(mode="after")
    def valid_interval(self) -> "QuoteRequest":
        if self.ends_at <= self.starts_at:
            raise ValueError("End time must be after start time")
        return self


class QuoteResponse(BaseModel):
    id: UUID
    listing_id: UUID
    starts_at: datetime
    ends_at: datetime
    quantity: int
    rental_charge_minor: int
    deposit_minor: int
    currency: str
    expires_at: datetime


class BookingCreateRequest(BaseModel):
    quote_id: UUID
    fulfillment_method: Literal["pickup", "owner_delivery"]
    note: str | None = Field(default=None, max_length=1000)


class BookingResponse(BaseModel):
    id: UUID
    public_number: str
    listing_id: UUID
    renter_user_id: UUID
    owner_user_id: UUID
    starts_at: datetime
    ends_at: datetime
    quantity: int
    status: str
    fulfillment_method: str
    rental_charge_minor: int
    deposit_minor: int
    currency: str
    note: str | None = None
    listing_title: str | None = None
    listing_image_url: str | None = None
    created_at: datetime


class MessageCreateRequest(BaseModel):
    client_message_id: UUID
    body: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: UUID
    sender_user_id: UUID
    body: str
    created_at: datetime


class OfferCreateRequest(BaseModel):
    starts_at: datetime
    ends_at: datetime
    quantity: int = Field(gt=0, le=100)
    unit: Literal["hour", "day", "week", "month"]
    fulfillment_method: Literal["pickup", "owner_delivery"]
    proposed_amount_minor: int = Field(gt=0)
    reason: str = Field(min_length=3, max_length=1000)

    @model_validator(mode="after")
    def valid_interval(self) -> "OfferCreateRequest":
        if self.ends_at <= self.starts_at:
            raise ValueError("End time must be after start time")
        return self


class OfferCounterRequest(BaseModel):
    counter_amount_minor: int = Field(gt=0)
    counter_reason: str = Field(default="", max_length=1000)


class OfferResponse(BaseModel):
    id: UUID
    listing_id: UUID
    renter_user_id: UUID
    owner_user_id: UUID
    starts_at: datetime
    ends_at: datetime
    quantity: int
    unit: str
    fulfillment_method: str
    proposed_amount_minor: int
    currency: str
    reason: str
    status: str
    counter_amount_minor: int | None
    counter_reason: str | None
    booking_id: UUID | None
    created_at: datetime
