"""add nova_damage to characters

Revision ID: 0013
Revises: 0012
Create Date: 2026-05-22
"""

import sqlalchemy as sa
from alembic import op

revision = "0013"
down_revision = "0012"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "characters",
        sa.Column("nova_damage", sa.Integer(), nullable=False, server_default="0"),
    )


def downgrade() -> None:
    op.drop_column("characters", "nova_damage")
