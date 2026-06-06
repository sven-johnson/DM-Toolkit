"""add saved_encounter_monster_id to scene_enemies

Revision ID: 0017
Revises: 0016
Create Date: 2026-06-04
"""

import sqlalchemy as sa
from alembic import op

revision = "0017"
down_revision = "0016"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "scene_enemies",
        sa.Column(
            "saved_encounter_monster_id",
            sa.String(36),
            sa.ForeignKey("saved_encounter_monsters.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    from sqlalchemy import inspect as sa_inspect
    conn = op.get_bind()
    inspector = sa_inspect(conn)
    for fk in inspector.get_foreign_keys("scene_enemies"):
        if "saved_encounter_monster_id" in fk["constrained_columns"]:
            op.drop_constraint(fk["name"], "scene_enemies", type_="foreignkey")
            break
    op.drop_column("scene_enemies", "saved_encounter_monster_id")
