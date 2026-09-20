"""Add an optional renter note to bookings.

Revision ID: 20260921_0001
Revises: 20260920_0001
Create Date: 2026-09-21
"""

from alembic import op
import sqlalchemy as sa

revision: str = "20260921_0001"
down_revision: str | None = "20260920_0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column("bookings", sa.Column("note", sa.String(length=1000), nullable=True))


def downgrade() -> None:
    op.drop_column("bookings", "note")
