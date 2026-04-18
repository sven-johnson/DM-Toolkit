"""add music_cue to scenes

Revision ID: 0007
Revises: 0006
Create Date: 2026-04-17 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "0007"
down_revision = "0006"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scenes",
        sa.Column("music_cue", sa.String(2048), nullable=True),
    )


def downgrade() -> None:
    op.drop_column("scenes", "music_cue")
