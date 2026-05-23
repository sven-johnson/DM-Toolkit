"""encounter template, monster stat block, and saved encounter tables

Revision ID: 0012
Revises: 0011
Create Date: 2026-05-21
"""

import uuid

import sqlalchemy as sa
from alembic import op

revision = "0012"
down_revision = "0011"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ── Tables ───────────────────────────────────────────────────────────────────

    op.create_table(
        "encounter_templates",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False, unique=True),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("is_custom", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
    )

    op.create_table(
        "encounter_template_slots",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "encounter_template_id",
            sa.String(36),
            sa.ForeignKey("encounter_templates.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "combat_role_archetype_id",
            sa.String(36),
            sa.ForeignKey("combat_role_archetypes.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("default_count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("is_required", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    op.create_table(
        "monster_stat_blocks",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "creature_archetype_id",
            sa.String(36),
            sa.ForeignKey("creature_archetypes.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "combat_role_archetype_id",
            sa.String(36),
            sa.ForeignKey("combat_role_archetypes.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column(
            "gm_profile_id",
            sa.String(36),
            sa.ForeignKey("gm_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("is_boss", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("level_tier", sa.Integer(), nullable=False),
        sa.Column("hp", sa.Integer(), nullable=False),
        sa.Column("ac", sa.Integer(), nullable=False),
        sa.Column("attack_bonus", sa.Integer(), nullable=False),
        sa.Column("save_dc", sa.Integer(), nullable=False),
        sa.Column("speed", sa.Integer(), nullable=False, server_default="30"),
        sa.Column("str_score", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("dex_score", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("con_score", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("int_score", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("wis_score", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("cha_score", sa.Integer(), nullable=False, server_default="10"),
        sa.Column("damage_immunities", sa.JSON(), nullable=True),
        sa.Column("damage_resistances", sa.JSON(), nullable=True),
        sa.Column("condition_immunities", sa.JSON(), nullable=True),
        sa.Column("has_legendary_actions", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("legendary_action_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("has_lair_actions", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("actions", sa.JSON(), nullable=True),
        sa.Column("legendary_actions", sa.JSON(), nullable=True),
        sa.Column("lair_actions", sa.JSON(), nullable=True),
        sa.Column("is_saved_template", sa.Boolean(), nullable=False, server_default=sa.false()),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint("level_tier BETWEEN 1 AND 4", name="ck_monster_level_tier"),
        sa.CheckConstraint("hp >= 1", name="ck_monster_hp"),
        sa.CheckConstraint("ac >= 0", name="ck_monster_ac"),
        sa.CheckConstraint("legendary_action_count >= 0", name="ck_monster_legendary_action_count"),
    )

    op.create_table(
        "saved_encounters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column(
            "encounter_template_id",
            sa.String(36),
            sa.ForeignKey("encounter_templates.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column(
            "gm_profile_id",
            sa.String(36),
            sa.ForeignKey("gm_profiles.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("difficulty", sa.String(10), nullable=False),
        sa.Column("party_size", sa.Integer(), nullable=False),
        sa.Column("party_avg_level", sa.Integer(), nullable=False),
        sa.Column("party_avg_hp", sa.Float(), nullable=False),
        sa.Column("party_total_hp", sa.Float(), nullable=False),
        sa.Column("party_lowest_hp", sa.Integer(), nullable=False),
        sa.Column("party_avg_ac", sa.Float(), nullable=False),
        sa.Column("party_nova_damage", sa.Float(), nullable=False),
        sa.Column("party_sustained_damage", sa.Float(), nullable=False),
        sa.Column("expected_rounds", sa.Float(), nullable=False),
        sa.Column("expected_rounds_min", sa.Float(), nullable=False),
        sa.Column("expected_rounds_max", sa.Float(), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.func.now()),
        sa.Column("updated_at", sa.DateTime(), server_default=sa.func.now()),
        sa.CheckConstraint(
            "difficulty IN ('trivial', 'easy', 'medium', 'hard', 'deadly')",
            name="ck_saved_encounter_difficulty",
        ),
        sa.CheckConstraint("party_size >= 1", name="ck_saved_encounter_party_size"),
    )

    op.create_table(
        "saved_encounter_monsters",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column(
            "saved_encounter_id",
            sa.String(36),
            sa.ForeignKey("saved_encounters.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "monster_stat_block_id",
            sa.String(36),
            sa.ForeignKey("monster_stat_blocks.id", ondelete="RESTRICT"),
            nullable=False,
        ),
        sa.Column("count", sa.Integer(), nullable=False, server_default="1"),
        sa.Column("sort_order", sa.Integer(), nullable=False, server_default="0"),
    )

    # ── Seed encounter templates + slots ─────────────────────────────────────────

    conn = op.get_bind()

    def uid() -> str:
        return str(uuid.uuid4())

    # Look up combat role IDs by name (seeded in 0011)
    rows = conn.execute(
        sa.text("SELECT id, name FROM combat_role_archetypes")
    ).fetchall()
    role_ids: dict[str, str] = {row[1]: row[0] for row in rows}

    # (template_name, description, slots)
    # slots: list of (role_name, default_count, is_required, sort_order)
    templates = [
        (
            "Simple Skirmish",
            "A straightforward combat encounter with a small group of similar enemies.",
            [
                ("Bruiser",    2, True,  0),
                ("Skirmisher", 1, False, 1),
            ],
        ),
        (
            "Elite Squad",
            "A coordinated group of elite enemies including support and ranged units.",
            [
                ("Elite",   2, True,  0),
                ("Archer",  1, False, 1),
                ("Support", 1, False, 2),
            ],
        ),
        (
            "Boss Fight",
            "A climactic encounter dominated by a powerful boss with supporting minions.",
            [
                ("Boss",    1, True,  0),
                ("Minion",  4, False, 1),
                ("Support", 1, False, 2),
            ],
        ),
        (
            "Ambush",
            "Enemies strike from hidden positions; assassins and skirmishers take the lead.",
            [
                ("Assassin",   2, True,  0),
                ("Skirmisher", 2, False, 1),
                ("Controller", 1, False, 2),
            ],
        ),
        (
            "Wave Assault",
            "Enemies attack in waves — minions lead, with elites and bruisers following.",
            [
                ("Minion",  6, True,  0),
                ("Bruiser", 2, False, 1),
                ("Elite",   1, False, 2),
            ],
        ),
        (
            "Guardian Encounter",
            "A powerful guardian defends a location, supported by heavy frontliners.",
            [
                ("Tank",    1, True,  0),
                ("Elite",   1, True,  1),
                ("Bruiser", 2, False, 2),
            ],
        ),
        (
            "Horde",
            "An overwhelming swarm of weaker enemies relying on sheer numbers.",
            [
                ("Minion",  8, True,  0),
                ("Bruiser", 2, False, 1),
            ],
        ),
        (
            "Hunt",
            "Predatory enemies isolate and target individual party members.",
            [
                ("Assassin",   1, True,  0),
                ("Skirmisher", 2, False, 1),
                ("Controller", 1, False, 2),
            ],
        ),
    ]

    for template_name, description, slots in templates:
        tid = uid()
        conn.execute(
            sa.text(
                "INSERT INTO encounter_templates (id, name, description, is_custom)"
                " VALUES (:id, :name, :desc, FALSE)"
            ),
            {"id": tid, "name": template_name, "desc": description},
        )
        for role_name, default_count, is_required, sort_order in slots:
            conn.execute(
                sa.text(
                    "INSERT INTO encounter_template_slots"
                    " (id, encounter_template_id, combat_role_archetype_id,"
                    "  default_count, is_required, sort_order)"
                    " VALUES (:id, :tid, :rid, :cnt, :req, :ord)"
                ),
                {
                    "id": uid(),
                    "tid": tid,
                    "rid": role_ids[role_name],
                    "cnt": default_count,
                    "req": is_required,
                    "ord": sort_order,
                },
            )


def downgrade() -> None:
    op.drop_table("saved_encounter_monsters")
    op.drop_table("saved_encounters")
    op.drop_table("monster_stat_blocks")
    op.drop_table("encounter_template_slots")
    op.drop_table("encounter_templates")
