"""Merge pre-booking inquiry conversations into booking conversations.

Revision ID: 20260922_0002
Revises: 20260922_0001
Create Date: 2026-09-20
"""

from alembic import op

revision: str = "20260922_0002"
down_revision: str | None = "20260922_0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.execute(
        """
        CREATE TEMP TABLE conversation_merge_pairs ON COMMIT DROP AS
        SELECT DISTINCT ON (booking.id)
            booking.id AS booking_id,
            booking_conversation.id AS booking_conversation_id,
            inquiry_conversation.id AS inquiry_conversation_id
        FROM bookings AS booking
        JOIN conversations AS booking_conversation
            ON booking_conversation.booking_id = booking.id
        JOIN conversations AS inquiry_conversation
            ON inquiry_conversation.listing_id = booking.listing_id
            AND inquiry_conversation.renter_user_id = booking.renter_user_id
            AND inquiry_conversation.owner_user_id = booking.owner_user_id
            AND inquiry_conversation.booking_id IS NULL
        ORDER BY booking.id, inquiry_conversation.created_at
        """
    )
    op.execute(
        """
        DELETE FROM messages AS booking_message
        USING conversation_merge_pairs AS pair
        WHERE booking_message.conversation_id = pair.booking_conversation_id
          AND EXISTS (
              SELECT 1
              FROM messages AS inquiry_message
              WHERE inquiry_message.conversation_id = pair.inquiry_conversation_id
                AND inquiry_message.client_message_id = booking_message.client_message_id
          )
        """
    )
    op.execute(
        """
        UPDATE messages AS message
        SET conversation_id = pair.inquiry_conversation_id
        FROM conversation_merge_pairs AS pair
        WHERE message.conversation_id = pair.booking_conversation_id
        """
    )
    op.execute(
        """
        UPDATE conversations AS conversation
        SET booking_id = NULL
        FROM conversation_merge_pairs AS pair
        WHERE conversation.id = pair.booking_conversation_id
        """
    )
    op.execute(
        """
        UPDATE conversations AS conversation
        SET booking_id = pair.booking_id
        FROM conversation_merge_pairs AS pair
        WHERE conversation.id = pair.inquiry_conversation_id
        """
    )
    op.execute(
        """
        DELETE FROM conversations AS conversation
        USING conversation_merge_pairs AS pair
        WHERE conversation.id = pair.booking_conversation_id
        """
    )


def downgrade() -> None:
    # The original split between inquiry and booking messages cannot be reconstructed safely.
    pass
