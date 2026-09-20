"""Mobile phase 1: listing_type, listing images, and expanded categories.

Revision ID: 20260918_0001
Revises: 20260916_0005
Create Date: 2026-09-18
"""

from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects import postgresql

revision: str = "20260918_0001"
down_revision: str | None = "20260916_0005"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "listings",
        sa.Column("listing_type", sa.String(16), nullable=False, server_default="item"),
    )
    op.alter_column("listings", "listing_type", server_default=None)
    op.create_check_constraint(
        "ck_listings_listing_type", "listings", "listing_type IN ('item','service')"
    )
    op.create_table(
        "listing_images",
        sa.Column("id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("listing_id", postgresql.UUID(as_uuid=True), nullable=False),
        sa.Column("object_key", sa.String(512), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.text("now()"), nullable=False
        ),
        sa.ForeignKeyConstraint(["listing_id"], ["listings.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("listing_id", "position", name="uq_listing_images_listing_position"),
    )
    op.execute(
        """
        INSERT INTO categories (id, slug, name, risk_tier, enabled, required_attributes)
        VALUES
          ('10000000-0000-0000-0000-000000000006', 'electronics-photography', 'Electronics & Photography', 'high_value', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000007', 'travel-outdoor', 'Travel & Outdoor', 'standard', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000008', 'home-office', 'Home & Office', 'standard', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000009', 'fashion-accessories', 'Fashion & Accessories', 'controlled', true, '{}'::jsonb),
          ('10000000-0000-0000-0000-000000000010', 'labour-work-services', 'Labour & Work Services', 'controlled', true, '{}'::jsonb)
        ON CONFLICT (slug) DO NOTHING
        """
    )


def downgrade() -> None:
    op.execute(
        """
        DELETE FROM categories WHERE slug IN (
            'electronics-photography', 'travel-outdoor', 'home-office',
            'fashion-accessories', 'labour-work-services'
        )
        """
    )
    op.drop_table("listing_images")
    op.drop_constraint("ck_listings_listing_type", "listings", type_="check")
    op.drop_column("listings", "listing_type")
