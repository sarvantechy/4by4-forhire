"""Enable required PostgreSQL extensions.

Revision ID: 20260916_0001
Revises:
Create Date: 2026-09-16
"""

from alembic import op

revision: str = "20260916_0001"
down_revision: str | None = None
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    """Enable geospatial and text-search extensions idempotently."""
    op.execute("CREATE EXTENSION IF NOT EXISTS postgis")
    op.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm")


def downgrade() -> None:
    """Retain infrastructure-owned extensions during application rollback."""
    pass
