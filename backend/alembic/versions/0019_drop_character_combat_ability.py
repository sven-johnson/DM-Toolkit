"""drop character_combat_abilities table

Revision ID: 0019
Revises: 0018
Create Date: 2026-06-04
"""

import sqlalchemy as sa
from alembic import op

revision = "0019"
down_revision = "0018"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.drop_table("character_combat_abilities")


def downgrade() -> None:
    # Recreates the empty table structure so downgrade runs cleanly.
    # Data cannot be restored — this table has been permanently replaced
    # by character_combat_turns and character_combat_turn_line_items.
    op.create_table(
        "character_combat_abilities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("character_id", sa.String(36),
                  sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("combat_ability_definition_id", sa.Integer(),
                  sa.ForeignKey("combat_ability_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("dice_count", sa.Integer(), nullable=False),
        sa.Column("dice_value", sa.Integer(), nullable=False),
        sa.Column("flat_bonus", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("is_bonus_action", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("attacks_per_use", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("uses_per_combat", sa.Integer(), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )
