"""add location_subtype to wiki_articles

Revision ID: 0020
Revises: 0019
Create Date: 2026-06-10
"""

import sqlalchemy as sa
from alembic import op

revision = "0020"
down_revision = "0019"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("wiki_articles", sa.Column("location_subtype", sa.String(50), nullable=True))


def downgrade() -> None:
    op.drop_column("wiki_articles", "location_subtype")
