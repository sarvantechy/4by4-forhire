"""Allow pre-booking listing inquiry conversations.

Revision ID: 20260918_0003
Revises: 20260918_0002
Create Date: 2026-09-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260918_0003"
down_revision: str | None = "20260918_0002"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.alter_column("conversations", "booking_id", nullable=True)
    op.add_column(
        "conversations",
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.create_foreign_key(
        "fk_conversations_listing_id",
        "conversations",
        "listings",
        ["listing_id"],
        ["id"],
        ondelete="CASCADE",
    )
    op.create_index(
        "ix_conversations_listing_renter",
        "conversations",
        ["listing_id", "renter_user_id"],
        unique=True,
        postgresql_where=sa.text("booking_id IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("ix_conversations_listing_renter", table_name="conversations")
    op.drop_constraint("fk_conversations_listing_id", "conversations", type_="foreignkey")
    op.drop_column("conversations", "listing_id")
    op.alter_column("conversations", "booking_id", nullable=False)
