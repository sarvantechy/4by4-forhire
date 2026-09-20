"""Add bargain offers, user blocking, and admin case assignment/priority.

Revision ID: 20260919_0001
Revises: 20260918_0003
Create Date: 2026-09-19
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260919_0001"
down_revision: str | None = "20260918_0003"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "offers",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column(
            "listing_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("listings.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "renter_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "owner_user_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("users.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("unit", sa.String(10), nullable=False),
        sa.Column("fulfillment_method", sa.String(20), nullable=False),
        sa.Column("proposed_amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False, server_default="INR"),
        sa.Column("reason", sa.String(1000), nullable=False),
        sa.Column("status", sa.String(24), nullable=False, server_default="pending"),
        sa.Column("counter_amount_minor", sa.Integer(), nullable=True),
        sa.Column("counter_reason", sa.String(1000), nullable=True),
        sa.Column(
            "booking_id",
            postgresql.UUID(as_uuid=True),
            sa.ForeignKey("bookings.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.CheckConstraint(
            "status IN ('pending','accepted','declined','countered',"
            "'counter_accepted','counter_declined','withdrawn')",
            name="ck_offers_status",
        ),
    )
    op.create_index("ix_offers_renter", "offers", ["renter_user_id"])
    op.create_index("ix_offers_owner", "offers", ["owner_user_id"])

    op.create_table(
        "user_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), primary_key=True),
        sa.Column("blocker_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("blocked_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False, server_default=sa.func.now()),
        sa.UniqueConstraint("blocker_user_id", "blocked_user_id", name="uq_user_blocks_pair"),
    )
    op.create_index("ix_user_blocks_blocker", "user_blocks", ["blocker_user_id"])

    op.add_column(
        "reports",
        sa.Column("priority", sa.String(16), nullable=False, server_default="normal"),
    )
    op.add_column(
        "reports",
        sa.Column("assigned_staff_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )
    op.add_column(
        "disputes",
        sa.Column("priority", sa.String(16), nullable=False, server_default="normal"),
    )
    op.add_column(
        "disputes",
        sa.Column("assigned_staff_user_id", postgresql.UUID(as_uuid=True), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("disputes", "assigned_staff_user_id")
    op.drop_column("disputes", "priority")
    op.drop_column("reports", "assigned_staff_user_id")
    op.drop_column("reports", "priority")
    op.drop_index("ix_user_blocks_blocker", table_name="user_blocks")
    op.drop_table("user_blocks")
    op.drop_index("ix_offers_owner", table_name="offers")
    op.drop_index("ix_offers_renter", table_name="offers")
    op.drop_table("offers")
