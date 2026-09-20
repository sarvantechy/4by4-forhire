"""Flag seed/demo listings so they can be hidden from real users.

Revision ID: 20260920_0001
Revises: 20260919_0001
Create Date: 2026-09-20
"""

from alembic import op
import sqlalchemy as sa

revision: str = "20260920_0001"
down_revision: str | None = "20260919_0001"
branch_labels: str | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "listings",
        sa.Column("is_seed_data", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("listings", "is_seed_data")
