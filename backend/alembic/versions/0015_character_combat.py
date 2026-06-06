"""add character combat stat, skill and ability tables

Revision ID: 0015
Revises: 0014
Create Date: 2026-06-03
"""

import sqlalchemy as sa
from alembic import op

revision = "0015"
down_revision = "0014"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "character_stats",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("character_id", sa.String(36), sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("stat_definition_id", sa.Integer(), sa.ForeignKey("stat_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column("value", sa.Integer(), nullable=False),
        sa.Column("override_modifier", sa.Integer(), nullable=True),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("character_id", "stat_definition_id", name="uq_character_stat"),
    )

    op.create_table(
        "character_skills",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("character_id", sa.String(36), sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("skill_definition_id", sa.Integer(), sa.ForeignKey("skill_definitions.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "proficiency_type",
            sa.Enum("none", "half", "full", "expertise", name="skill_proficiency_enum"),
            nullable=False,
            server_default="none",
        ),
        sa.Column("additional_bonus", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("character_id", "skill_definition_id", name="uq_character_skill"),
    )

    op.create_table(
        "character_combat_abilities",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("character_id", sa.String(36), sa.ForeignKey("characters.id", ondelete="CASCADE"), nullable=False),
        sa.Column("combat_ability_definition_id", sa.Integer(), sa.ForeignKey("combat_ability_definitions.id", ondelete="CASCADE"), nullable=False),
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


def downgrade() -> None:
    op.drop_table("character_combat_abilities")
    op.drop_table("character_skills")
    op.drop_table("character_stats")
    sa.Enum(name="skill_proficiency_enum").drop(op.get_bind(), checkfirst=True)
