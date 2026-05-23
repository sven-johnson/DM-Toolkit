"""monster_factory tables and seed

Revision ID: 0010
Revises: 0009
Create Date: 2026-05-21
"""

import uuid
from alembic import op
import sqlalchemy as sa

revision = "0010"
down_revision = "0009"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "gm_profiles",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("is_default", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now(), onupdate=sa.func.now()),
    )

    op.create_table(
        "lethality_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gm_profile_id", sa.String(36), sa.ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("threat_turns_trivial", sa.Float(), nullable=False, server_default="6.0"),
        sa.Column("threat_turns_easy", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("threat_turns_medium", sa.Float(), nullable=False, server_default="3.5"),
        sa.Column("threat_turns_hard", sa.Float(), nullable=False, server_default="2.25"),
        sa.Column("threat_turns_deadly", sa.Float(), nullable=False, server_default="1.5"),
        sa.Column("damage_smoothing", sa.Float(), nullable=False, server_default="0.85"),
        sa.Column("hp_smoothing", sa.Float(), nullable=False, server_default="1.1"),
        sa.Column("one_shot_prevention_threshold", sa.Float(), nullable=False, server_default="0.6"),
        sa.Column("boss_nova_multiplier", sa.Float(), nullable=False, server_default="1.5"),
        sa.Column("allow_player_death", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("gm_profile_id"),
        sa.CheckConstraint("one_shot_prevention_threshold BETWEEN 0.0 AND 1.0", name="ck_lethality_one_shot_threshold"),
        sa.CheckConstraint("damage_smoothing > 0", name="ck_lethality_damage_smoothing"),
        sa.CheckConstraint("hp_smoothing > 0", name="ck_lethality_hp_smoothing"),
        sa.CheckConstraint("boss_nova_multiplier > 0", name="ck_lethality_boss_nova"),
    )

    op.create_table(
        "combat_duration_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gm_profile_id", sa.String(36), sa.ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("target_rounds_trivial", sa.Float(), nullable=False, server_default="1.5"),
        sa.Column("target_rounds_easy", sa.Float(), nullable=False, server_default="2.5"),
        sa.Column("target_rounds_medium", sa.Float(), nullable=False, server_default="3.5"),
        sa.Column("target_rounds_hard", sa.Float(), nullable=False, server_default="5.0"),
        sa.Column("target_rounds_deadly", sa.Float(), nullable=False, server_default="6.0"),
        sa.Column("round_variance_tolerance", sa.Float(), nullable=False, server_default="1.0"),
        sa.UniqueConstraint("gm_profile_id"),
        sa.CheckConstraint("round_variance_tolerance >= 0", name="ck_combat_duration_variance"),
    )

    op.create_table(
        "action_economy_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gm_profile_id", sa.String(36), sa.ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("multiplier_trivial", sa.Float(), nullable=False, server_default="0.6"),
        sa.Column("multiplier_easy", sa.Float(), nullable=False, server_default="0.8"),
        sa.Column("multiplier_medium", sa.Float(), nullable=False, server_default="1.0"),
        sa.Column("multiplier_hard", sa.Float(), nullable=False, server_default="1.2"),
        sa.Column("multiplier_deadly", sa.Float(), nullable=False, server_default="1.4"),
        sa.Column("bonus_action_estimate", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("legendary_action_override", sa.Integer(), nullable=True),
        sa.Column("lair_actions_enabled", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.UniqueConstraint("gm_profile_id"),
        sa.CheckConstraint("bonus_action_estimate BETWEEN 0.0 AND 1.0", name="ck_action_economy_bonus_action"),
        sa.CheckConstraint(
            "legendary_action_override IS NULL OR legendary_action_override >= 0",
            name="ck_action_economy_legendary",
        ),
    )

    op.create_table(
        "hit_rate_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gm_profile_id", sa.String(36), sa.ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("monster_hit_rate_trivial", sa.Float(), nullable=False, server_default="0.4"),
        sa.Column("monster_hit_rate_easy", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("monster_hit_rate_medium", sa.Float(), nullable=False, server_default="0.6"),
        sa.Column("monster_hit_rate_hard", sa.Float(), nullable=False, server_default="0.65"),
        sa.Column("monster_hit_rate_deadly", sa.Float(), nullable=False, server_default="0.7"),
        sa.Column("player_hit_rate_trivial", sa.Float(), nullable=False, server_default="0.75"),
        sa.Column("player_hit_rate_easy", sa.Float(), nullable=False, server_default="0.65"),
        sa.Column("player_hit_rate_medium", sa.Float(), nullable=False, server_default="0.55"),
        sa.Column("player_hit_rate_hard", sa.Float(), nullable=False, server_default="0.5"),
        sa.Column("player_hit_rate_deadly", sa.Float(), nullable=False, server_default="0.45"),
        sa.UniqueConstraint("gm_profile_id"),
        sa.CheckConstraint(
            "monster_hit_rate_trivial BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_easy BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_medium BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_hard BETWEEN 0.0 AND 1.0"
            " AND monster_hit_rate_deadly BETWEEN 0.0 AND 1.0",
            name="ck_hit_rate_monster",
        ),
        sa.CheckConstraint(
            "player_hit_rate_trivial BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_easy BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_medium BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_hard BETWEEN 0.0 AND 1.0"
            " AND player_hit_rate_deadly BETWEEN 0.0 AND 1.0",
            name="ck_hit_rate_player",
        ),
    )

    op.create_table(
        "saving_throw_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gm_profile_id", sa.String(36), sa.ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("save_dc_base", sa.Integer(), nullable=False, server_default="8"),
        sa.Column("save_dc_proficiency_scaling", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("save_dc_difficulty_bonus", sa.Integer(), nullable=False, server_default="1"),
        sa.UniqueConstraint("gm_profile_id"),
        sa.CheckConstraint("save_dc_base >= 0", name="ck_saving_throw_dc_base"),
        sa.CheckConstraint("save_dc_difficulty_bonus >= 0", name="ck_saving_throw_dc_bonus"),
    )

    op.create_table(
        "minion_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gm_profile_id", sa.String(36), sa.ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("minion_one_hit_kill", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("minion_hp_fraction", sa.Float(), nullable=False, server_default="0.25"),
        sa.Column("minion_damage_fraction", sa.Float(), nullable=False, server_default="0.4"),
        sa.UniqueConstraint("gm_profile_id"),
        sa.CheckConstraint("minion_hp_fraction BETWEEN 0.0 AND 1.0", name="ck_minion_hp_fraction"),
        sa.CheckConstraint("minion_damage_fraction BETWEEN 0.0 AND 1.0", name="ck_minion_damage_fraction"),
    )

    op.create_table(
        "warning_settings",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("gm_profile_id", sa.String(36), sa.ForeignKey("gm_profiles.id", ondelete="CASCADE"), nullable=False),
        sa.Column("warn_nova_threshold", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("warn_one_shot_risk", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("warn_action_economy_imbalance", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("warn_round_duration_deviation", sa.Boolean(), nullable=False, server_default=sa.true()),
        sa.Column("show_math", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.UniqueConstraint("gm_profile_id"),
    )

    # Seed "Balanced (Default)" profile
    profile_id = str(uuid.uuid4())
    op.execute(
        f"INSERT INTO gm_profiles (id, name, is_default) VALUES ('{profile_id}', 'Balanced (Default)', TRUE)"
    )
    op.execute(
        f"INSERT INTO lethality_settings (id, gm_profile_id, threat_turns_trivial, threat_turns_easy,"
        f" threat_turns_medium, threat_turns_hard, threat_turns_deadly, damage_smoothing, hp_smoothing,"
        f" one_shot_prevention_threshold, boss_nova_multiplier, allow_player_death)"
        f" VALUES ('{uuid.uuid4()}', '{profile_id}', 6.0, 5.0, 3.5, 2.25, 1.5, 0.85, 1.1, 0.6, 1.5, FALSE)"
    )
    op.execute(
        f"INSERT INTO combat_duration_settings (id, gm_profile_id, target_rounds_trivial, target_rounds_easy,"
        f" target_rounds_medium, target_rounds_hard, target_rounds_deadly, round_variance_tolerance)"
        f" VALUES ('{uuid.uuid4()}', '{profile_id}', 1.5, 2.5, 3.5, 5.0, 6.0, 1.0)"
    )
    op.execute(
        f"INSERT INTO action_economy_settings (id, gm_profile_id, multiplier_trivial, multiplier_easy,"
        f" multiplier_medium, multiplier_hard, multiplier_deadly, bonus_action_estimate,"
        f" legendary_action_override, lair_actions_enabled)"
        f" VALUES ('{uuid.uuid4()}', '{profile_id}', 0.6, 0.8, 1.0, 1.2, 1.4, 0.5, NULL, TRUE)"
    )
    op.execute(
        f"INSERT INTO hit_rate_settings (id, gm_profile_id, monster_hit_rate_trivial, monster_hit_rate_easy,"
        f" monster_hit_rate_medium, monster_hit_rate_hard, monster_hit_rate_deadly,"
        f" player_hit_rate_trivial, player_hit_rate_easy, player_hit_rate_medium,"
        f" player_hit_rate_hard, player_hit_rate_deadly)"
        f" VALUES ('{uuid.uuid4()}', '{profile_id}', 0.40, 0.50, 0.60, 0.65, 0.70, 0.75, 0.65, 0.55, 0.50, 0.45)"
    )
    op.execute(
        f"INSERT INTO saving_throw_settings (id, gm_profile_id, save_dc_base, save_dc_proficiency_scaling,"
        f" save_dc_difficulty_bonus)"
        f" VALUES ('{uuid.uuid4()}', '{profile_id}', 8, TRUE, 1)"
    )
    op.execute(
        f"INSERT INTO minion_settings (id, gm_profile_id, minion_one_hit_kill, minion_hp_fraction,"
        f" minion_damage_fraction)"
        f" VALUES ('{uuid.uuid4()}', '{profile_id}', FALSE, 0.25, 0.40)"
    )
    op.execute(
        f"INSERT INTO warning_settings (id, gm_profile_id, warn_nova_threshold, warn_one_shot_risk,"
        f" warn_action_economy_imbalance, warn_round_duration_deviation, show_math)"
        f" VALUES ('{uuid.uuid4()}', '{profile_id}', TRUE, TRUE, TRUE, TRUE, FALSE)"
    )


def downgrade() -> None:
    op.drop_table("warning_settings")
    op.drop_table("minion_settings")
    op.drop_table("saving_throw_settings")
    op.drop_table("hit_rate_settings")
    op.drop_table("action_economy_settings")
    op.drop_table("combat_duration_settings")
    op.drop_table("lethality_settings")
    op.drop_table("gm_profiles")
