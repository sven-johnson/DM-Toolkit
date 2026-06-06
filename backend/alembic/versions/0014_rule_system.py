"""add rule system abstraction tables

Revision ID: 0014
Revises: 0013
Create Date: 2026-06-03
"""

import sqlalchemy as sa
from alembic import op

revision = "0014"
down_revision = "0013"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "rule_systems",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("slug", sa.String(64), nullable=False, unique=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("version", sa.String(64), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "stat_definitions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rule_system_id", sa.Integer(), sa.ForeignKey("rule_systems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("abbreviation", sa.String(16), nullable=False),
        sa.Column(
            "stat_type",
            sa.Enum("ability_score", "derived", "resource", "custom", name="stat_type_enum"),
            nullable=False,
        ),
        sa.Column("has_modifier", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("modifier_formula", sa.String(255), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("rule_system_id", "slug", name="uq_stat_definition_rs_slug"),
    )

    op.create_table(
        "skill_definitions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rule_system_id", sa.Integer(), sa.ForeignKey("rule_systems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("governing_stat_id", sa.Integer(), sa.ForeignKey("stat_definitions.id", ondelete="SET NULL"), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("rule_system_id", "slug", name="uq_skill_definition_rs_slug"),
    )

    op.create_table(
        "combat_ability_definitions",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("rule_system_id", sa.Integer(), sa.ForeignKey("rule_systems.id", ondelete="CASCADE"), nullable=False),
        sa.Column("slug", sa.String(64), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "ability_category",
            sa.Enum("attack", "spell", "feature", "cantrip", "resource", name="ability_category_enum"),
            nullable=False,
        ),
        sa.Column("is_nova_eligible", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("is_sustained_eligible", sa.Boolean(), nullable=False, server_default="0"),
        sa.Column("notes", sa.Text(), nullable=True),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.UniqueConstraint("rule_system_id", "slug", name="uq_combat_ability_definition_rs_slug"),
    )


def downgrade() -> None:
    op.drop_table("combat_ability_definitions")
    op.drop_table("skill_definitions")
    op.drop_table("stat_definitions")
    op.drop_table("rule_systems")
    # Drop enum types (required for PostgreSQL; no-op on MySQL/SQLite)
    sa.Enum(name="ability_category_enum").drop(op.get_bind(), checkfirst=True)
    sa.Enum(name="stat_type_enum").drop(op.get_bind(), checkfirst=True)
