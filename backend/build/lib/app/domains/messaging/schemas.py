"""Messaging API schemas."""

from datetime import datetime
from uuid import UUID

from pydantic import BaseModel


class ConversationSummaryResponse(BaseModel):
    id: UUID
    listing_id: UUID | None
    listing_title: str | None
    other_user_id: UUID
    other_display_name: str
    last_message_body: str | None
    last_message_at: datetime
    last_message_is_mine: bool
