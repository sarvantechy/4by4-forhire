"""Expose plain latitude/longitude columns on listings for map features.

Revision ID: 20260918_0002
Revises: 20260918_0001
Create Date: 2026-09-18
"""

from alembic import op
import sqlalchemy as sa

revision: str = "20260918_0002"
down_revision: str | None = "20260918_0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("listings", sa.Column("latitude", sa.Float(), nullable=True))
    op.add_column("listings", sa.Column("longitude", sa.Float(), nullable=True))
    op.execute(
        """
        UPDATE listings
        SET latitude = ST_Y(public_location::geometry),
            longitude = ST_X(public_location::geometry)
        WHERE public_location IS NOT NULL
        """
    )


def downgrade() -> None:
    op.drop_column("listings", "longitude")
    op.drop_column("listings", "latitude")
