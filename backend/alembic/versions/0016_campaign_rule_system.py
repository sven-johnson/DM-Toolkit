"""add rule_system_id to campaigns

Revision ID: 0016
Revises: 0015
Create Date: 2026-06-03
"""

import sqlalchemy as sa
from alembic import op

revision = "0016"
down_revision = "0015"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "campaigns",
        sa.Column(
            "rule_system_id",
            sa.Integer(),
            sa.ForeignKey("rule_systems.id", ondelete="SET NULL"),
            nullable=True,
        ),
    )


def downgrade() -> None:
    # MySQL requires dropping the FK constraint before the column
    from sqlalchemy import inspect as sa_inspect
    conn = op.get_bind()
    inspector = sa_inspect(conn)
    for fk in inspector.get_foreign_keys("campaigns"):
        if "rule_system_id" in fk["constrained_columns"]:
            op.drop_constraint(fk["name"], "campaigns", type_="foreignkey")
            break
    op.drop_column("campaigns", "rule_system_id")
