"""add RBAC: is_admin on users, campaign_members table

Revision ID: 0009
Revises: 0008
Create Date: 2026-05-19 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "0009"
down_revision = "0008"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "is_admin",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
    )

    op.create_table(
        "campaign_members",
        sa.Column("id", sa.String(36), nullable=False),
        sa.Column("user_id", sa.String(36), nullable=False),
        sa.Column("campaign_id", sa.String(36), nullable=False),
        sa.Column("role", sa.String(20), nullable=False, server_default="player"),
        sa.Column(
            "created_at",
            sa.DateTime(),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["campaign_id"], ["campaigns.id"], ondelete="CASCADE"
        ),
        sa.UniqueConstraint(
            "user_id", "campaign_id", name="uq_campaign_members_user_campaign"
        ),
    )


def downgrade() -> None:
    op.drop_table("campaign_members")
    op.drop_column("users", "is_admin")
