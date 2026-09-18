"""Create catalog tables.

Revision ID: 20260916_0003
Revises: 20260916_0002
Create Date: 2026-09-16
"""

from alembic import op
import sqlalchemy as sa
from geoalchemy2 import Geography
from sqlalchemy.dialects import postgresql

revision: str = "20260916_0003"
down_revision: str | None = "20260916_0002"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_table(
        "categories",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("slug", sa.String(80), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("risk_tier", sa.String(24), nullable=False),
        sa.Column("enabled", sa.Boolean(), nullable=False),
        sa.Column("required_attributes", postgresql.JSONB(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("slug"),
    )
    op.create_table(
        "listings",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("owner_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("category_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("title", sa.String(160), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("condition", sa.String(32), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("attributes", postgresql.JSONB(), nullable=False),
        sa.Column("status", sa.String(32), nullable=False),
        sa.Column("pickup_enabled", sa.Boolean(), nullable=False),
        sa.Column("delivery_enabled", sa.Boolean(), nullable=False),
        sa.Column("public_locality", sa.String(160), nullable=False),
        sa.Column("public_location", Geography(geometry_type="POINT", srid=4326), nullable=True),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.CheckConstraint(
            "status IN ('draft','pending_checks','under_review','active','paused','archived','removed')",
            name="ck_listings_status",
        ),
        sa.CheckConstraint("quantity > 0", name="ck_listings_quantity_positive"),
        sa.ForeignKeyConstraint(["category_id"], ["categories.id"], ondelete="RESTRICT"),
        sa.ForeignKeyConstraint(["owner_user_id"], ["users.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_listings_owner_status", "listings", ["owner_user_id", "status"])
    op.create_index("ix_listings_status_category", "listings", ["status", "category_id"])
    op.create_table(
        "listing_prices",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("unit", sa.String(16), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("deposit_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(3), nullable=False),
        sa.CheckConstraint("unit IN ('hour','day','week','month')", name="ck_listing_prices_unit"),
        sa.CheckConstraint("amount_minor > 0", name="ck_listing_prices_amount"),
        sa.CheckConstraint("deposit_minor >= 0", name="ck_listing_prices_deposit"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_id", "unit", name="uq_listing_prices_listing_unit"),
    )
    op.create_table(
        "listing_status_history",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("from_status", sa.String(32), nullable=True),
        sa.Column("to_status", sa.String(32), nullable=False),
        sa.Column("actor_user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("reason_code", sa.String(80), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "availability_blocks",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("starts_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("ends_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("quantity", sa.Integer(), nullable=False),
        sa.Column("reason", sa.String(120), nullable=False),
        sa.CheckConstraint("quantity > 0", name="ck_availability_blocks_quantity"),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_table(
        "seller_headers",
        sa.Column("user_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("display_name", sa.String(120), nullable=False),
        sa.Column("description", sa.Text(), nullable=False),
        sa.Column("public_locality", sa.String(160), nullable=False),
        sa.Column("operating_hours", postgresql.JSONB(), nullable=False),
        sa.Column("moderation_status", sa.String(24), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("user_id"),
    )
    op.execute(
        """
        INSERT INTO categories (id, slug, name, risk_tier, enabled, required_attributes)
        VALUES
          ('10000000-0000-0000-0000-000000000001', 'tools-repair', 'Tools & Repair', 'controlled', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000002', 'construction-labour', 'Construction & Labour', 'controlled', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000003', 'cleaning-home', 'Cleaning & Home', 'standard', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000004', 'garden-farm', 'Garden & Farm', 'controlled', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000005', 'events-functions', 'Events & Functions', 'standard', true, '{}'::jsonb)
        ON CONFLICT (slug) DO NOTHING
        """
    )


def downgrade() -> None:
    op.drop_table("seller_headers")
    op.drop_table("availability_blocks")
    op.drop_table("listing_status_history")
    op.drop_table("listing_prices")
    op.drop_index("ix_listings_status_category", table_name="listings")
    op.drop_index("ix_listings_owner_status", table_name="listings")
    op.drop_table("listings")
    op.drop_table("categories")
