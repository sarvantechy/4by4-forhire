"""Create stores, listing store association, and store audit history.

Revision ID: 20260922_0001
Revises: 20260921_0001
Create Date: 2026-09-22
"""

import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

from alembic import op

revision: str = "20260922_0001"
down_revision: str | None = "20260921_0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "stores",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(100), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("public_locality", sa.String(160), nullable=False),
        sa.Column("operating_hours", postgresql.JSONB(), nullable=False),
        sa.Column("logo_object_key", sa.String(512), nullable=True),
        sa.Column("cover_object_key", sa.String(512), nullable=True),
        sa.Column("status", sa.String(24), nullable=False),
        sa.Column("moderation_status", sa.String(24), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("is_seed_data", sa.Boolean(), nullable=False, server_default=sa.text("false")),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint("status IN ('active','paused','archived')", name="ck_stores_status"),
        sa.CheckConstraint(
            "moderation_status IN ('active','under_review','removed')",
            name="ck_stores_moderation_status",
        ),
        sa.CheckConstraint("version > 0", name="ck_stores_version_positive"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug", name="uq_stores_slug"),
        sa.UniqueConstraint("id", "owner_user_id", name="uq_stores_id_owner"),
    )
    op.create_index("ix_stores_owner_status", "stores", ["owner_user_id", "status"])
    op.create_index("ix_stores_status_moderation", "stores", ["status", "moderation_status"])

    op.add_column("listings", sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=True))
    op.create_index("ix_listings_store_status", "listings", ["store_id", "status"])
    op.create_foreign_key(
        "fk_listings_store_owner",
        "listings",
        "stores",
        ["store_id", "owner_user_id"],
        ["id", "owner_user_id"],
        ondelete="RESTRICT",
    )

    op.create_table(
        "store_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("store_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_status", sa.String(24), nullable=True),
        sa.Column("to_status", sa.String(24), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason_code", sa.String(80), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["store_id"], ["stores.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )

    op.create_table(
        "listing_store_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_store_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("to_store_id", postgresql.UUID(as_uuid=True), nullable=True),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason_code", sa.String(80), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )


def downgrade() -> None:
    op.drop_table("listing_store_history")
    op.drop_table("store_status_history")
    op.drop_constraint("fk_listings_store_owner", "listings", type_="foreignkey")
    op.drop_index("ix_listings_store_status", table_name="listings")
    op.drop_column("listings", "store_id")
    op.drop_index("ix_stores_status_moderation", table_name="stores")
    op.drop_index("ix_stores_owner_status", table_name="stores")
    op.drop_table("stores")
