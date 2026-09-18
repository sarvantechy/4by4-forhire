"""Private booking conversation service."""

import re
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.errors import APIError
from app.domains.identity.models import User
from app.domains.messaging.models import Conversation, Message

CONTACT_PATTERNS = (
    re.compile(r"(?:\+?91[\s.-]?)?[6-9](?:[\s.-]?\d){9}"),
    re.compile(r"[a-z0-9._%+-]+\s*@\s*[a-z0-9.-]+\.[a-z]{2,}", re.IGNORECASE),
    re.compile(r"\b[a-z0-9._-]+@[a-z]{2,}\b", re.IGNORECASE),
    re.compile(r"\b(?:upi|gpay|phonepe|paytm|bank account|ifsc)\b", re.IGNORECASE),
)


class MessagingService:
    def __init__(self, session: Session) -> None:
        self.session = session

    def conversation_for_booking(self, booking_id: UUID, actor: User) -> Conversation:
        conversation = self.session.scalar(
            select(Conversation).where(
                Conversation.booking_id == booking_id,
                (Conversation.renter_user_id == actor.id)
                | (Conversation.owner_user_id == actor.id),
            )
        )
        if conversation is None:
            raise APIError(
                status_code=404,
                code="CONVERSATION_NOT_FOUND",
                message="Conversation not found.",
            )
        return conversation

    def send_message(
        self,
        conversation: Conversation,
        sender: User,
        client_message_id: UUID,
        body: str,
    ) -> Message:
        if any(pattern.search(body) for pattern in CONTACT_PATTERNS):
            raise APIError(
                status_code=422,
                code="MESSAGE_PRIVATE_CONTACT_BLOCKED",
                message="Keep contact and payment details inside the app.",
            )
        existing = self.session.scalar(
            select(Message).where(
                Message.conversation_id == conversation.id,
                Message.client_message_id == client_message_id,
            )
        )
        if existing is not None:
            return existing
        message = Message(
            conversation_id=conversation.id,
            sender_user_id=sender.id,
            client_message_id=client_message_id,
            body=body.strip(),
        )
        self.session.add(message)
        self.session.commit()
        self.session.refresh(message)
        return message

    def messages(self, conversation: Conversation) -> list[Message]:
        return list(
            self.session.scalars(
                select(Message)
                .where(Message.conversation_id == conversation.id)
                .order_by(Message.created_at)
            )
        )
