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
    created_at: datetime


class MessageCreateRequest(BaseModel):
    client_message_id: UUID
    body: str = Field(min_length=1, max_length=2000)


class MessageResponse(BaseModel):
    id: UUID
    sender_user_id: UUID
    body: str
    created_at: datetime
