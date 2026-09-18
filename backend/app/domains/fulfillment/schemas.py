"""Fulfillment and evidence API schemas."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field


class FulfillmentScheduleRequest(BaseModel):
    scheduled_at: datetime | None = None
    private_instructions: str | None = Field(default=None, max_length=1000)


class ChallengeResponse(BaseModel):
    challenge_id: UUID
    code: str
    purpose: Literal["handover", "return"]
    expires_at: datetime


class ChallengeConfirmRequest(BaseModel):
    challenge_id: UUID
    code: str = Field(pattern=r"^\d{6}$")


class ConditionReportRequest(BaseModel):
    phase: Literal["handover", "return"]
    checklist: dict[str, object] = Field(default_factory=dict)
    notes: str = Field(default="", max_length=3000)


class PaymentAcknowledgementRequest(BaseModel):
    disagreement: bool = False


class FulfillmentResponse(BaseModel):
    booking_id: UUID
    method: str
    status: str
    scheduled_at: datetime | None
    private_instructions: str | None


class ReviewRequest(BaseModel):
    rating: int = Field(ge=1, le=5)
    text: str = Field(default="", max_length=2000)


class DisputeRequest(BaseModel):
    type: Literal[
        "item_not_received",
        "item_different",
        "damage",
        "missing_parts",
        "late_return",
        "non_return",
        "payment_disagreement",
        "unsafe_behavior",
        "abusive_communication",
    ]
    description: str = Field(min_length=10, max_length=5000)


class ReportRequest(BaseModel):
    target_type: Literal["listing", "user", "message", "seller_header"]
    target_id: UUID
    reason: str = Field(min_length=2, max_length=80)
    description: str = Field(default="", max_length=3000)


class ModerationRequest(BaseModel):
    action: Literal["approve", "remove"]
    reason: str = Field(min_length=3, max_length=1000)


class AdminReportResponse(BaseModel):
    id: UUID
    target_type: str
    target_id: UUID
    reason: str
    description: str
    status: str
    created_at: datetime
