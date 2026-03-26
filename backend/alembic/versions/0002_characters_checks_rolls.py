"""characters checks rolls

Revision ID: 0002
Revises: 0001
Create Date: 2026-03-26 00:00:00.000000

"""

import sqlalchemy as sa
from alembic import op

revision = "0002"
down_revision = "0001"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "characters",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("char_class", sa.String(255), nullable=False, server_default=""),
        sa.Column("subclass", sa.String(255), nullable=False, server_default=""),
        sa.Column("level", sa.Integer(), nullable=False, server_default=sa.text("1")),
        # Ability scores
        sa.Column("str_score", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("dex_score", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("con_score", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("int_score", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("wis_score", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("cha_score", sa.Integer(), nullable=False, server_default=sa.text("10")),
        # Ability modifiers
        sa.Column("str_mod", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("dex_mod", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("con_mod", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("int_mod", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("wis_mod", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("cha_mod", sa.Integer(), nullable=False, server_default=sa.text("0")),
        # Skill modifiers
        sa.Column("acrobatics", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("animal_handling", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("arcana", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("athletics", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("deception", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("history", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("insight", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("intimidation", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("investigation", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("medicine", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("nature", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("perception", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("performance", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("persuasion", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("religion", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("sleight_of_hand", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("stealth", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("survival", sa.Integer(), nullable=False, server_default=sa.text("0")),
        # Saving throws
        sa.Column("str_save", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("dex_save", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("con_save", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("int_save", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("wis_save", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("cha_save", sa.Integer(), nullable=False, server_default=sa.text("0")),
        # Combat
        sa.Column("ac", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("max_hp", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_characters_id", "characters", ["id"])

    op.create_table(
        "checks",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("check_type", sa.String(50), nullable=False),
        sa.Column("subtype", sa.String(100), nullable=False),
        sa.Column("dc", sa.Integer(), nullable=False, server_default=sa.text("10")),
        sa.Column("character_ids", sa.JSON(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_checks_id", "checks", ["id"])

    op.create_table(
        "rolls",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("check_id", sa.Integer(), nullable=False),
        sa.Column("character_id", sa.Integer(), nullable=False),
        sa.Column("die_result", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["check_id"], ["checks.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["character_id"], ["characters.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("check_id", "character_id"),
    )
    op.create_index("ix_rolls_id", "rolls", ["id"])


def downgrade() -> None:
    op.drop_index("ix_rolls_id", table_name="rolls")
    op.drop_table("rolls")
    op.drop_index("ix_checks_id", table_name="checks")
    op.drop_table("checks")
    op.drop_index("ix_characters_id", table_name="characters")
    op.drop_table("characters")
