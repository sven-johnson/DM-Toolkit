"""create invites table

Revision ID: 0022
Revises: 0021
Create Date: 2026-10-01
"""

import sqlalchemy as sa
from alembic import op

revision = "0022"
down_revision = "0021"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "invites",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("email", sa.String(255), nullable=False),
        sa.Column("campaign_id", sa.String(36), nullable=True),
        sa.Column("role", sa.String(20), nullable=True),
        sa.Column("invited_by_user_id", sa.String(36), nullable=False),
        sa.Column("created_at", sa.DateTime, server_default=sa.func.now(), nullable=False),
        sa.Column("expires_at", sa.DateTime, nullable=False),
        sa.Column("accepted_at", sa.DateTime, nullable=True),
        sa.Column("accepted_by_user_id", sa.String(36), nullable=True),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], name="fk_invites_campaign", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["invited_by_user_id"], ["users.id"], name="fk_invites_inviter", ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["accepted_by_user_id"], ["users.id"], name="fk_invites_accepted_by", ondelete="SET NULL"),
        sa.CheckConstraint(
            "(campaign_id IS NULL AND role IS NULL) OR (campaign_id IS NOT NULL AND role IS NOT NULL)",
            name="ck_invites_campaign_role",
        ),
    )
    op.create_index("ix_invites_email", "invites", ["email"])
    op.create_index("ix_invites_campaign", "invites", ["campaign_id"])


def downgrade() -> None:
    op.drop_table("invites")
