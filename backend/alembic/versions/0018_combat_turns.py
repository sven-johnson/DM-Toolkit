"""add character_combat_turn and line_item tables

Revision ID: 0018
Revises: 0017
Create Date: 2026-06-04
"""

import sqlalchemy as sa
from alembic import op

revision = "0018"
down_revision = "0017"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "character_combat_turns",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("character_id", sa.String(36),
                  sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column(
            "turn_type",
            sa.Enum("nova", "sustained", "variant", name="turn_type_enum"),
            nullable=False,
        ),
        sa.Column("is_primary", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "character_combat_turn_line_items",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("turn_id", sa.Integer(),
                  sa.ForeignKey("character_combat_turns.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(100), nullable=False),
        sa.Column("dice_notation", sa.String(30), nullable=True),
        sa.Column("average_damage", sa.Float(), nullable=False),
        sa.Column("is_bonus_action", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )


def downgrade() -> None:
    op.drop_table("character_combat_turn_line_items")
    op.drop_table("character_combat_turns")
    sa.Enum(name="turn_type_enum").drop(op.get_bind(), checkfirst=True)
