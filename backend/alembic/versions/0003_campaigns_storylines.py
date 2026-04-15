"""campaigns storylines scene types

Revision ID: 0003
Revises: 0002
Create Date: 2026-04-04 00:00:00.000000

"""

import uuid as uuid_lib

import sqlalchemy as sa
from alembic import op

revision = "0003"
down_revision = "0002"
branch_labels = None
depends_on = None


def upgrade() -> None:
    # ------------------------------------------------------------------
    # 1. campaigns
    # ------------------------------------------------------------------
    op.create_table(
        "campaigns",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(36), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_index("ix_campaigns_id", "campaigns", ["id"])

    default_campaign_uuid = str(uuid_lib.uuid4())
    op.execute(
        f"INSERT INTO campaigns (uuid, name) VALUES ('{default_campaign_uuid}', 'Default Campaign')"
    )

    # ------------------------------------------------------------------
    # 2. storylines
    # ------------------------------------------------------------------
    op.create_table(
        "storylines",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("uuid", sa.String(36), nullable=False),
        sa.Column("campaign_id", sa.Integer(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("created_at", sa.DateTime(), server_default=sa.text("NOW()"), nullable=False),
        sa.ForeignKeyConstraint(["campaign_id"], ["campaigns.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("uuid"),
    )
    op.create_index("ix_storylines_id", "storylines", ["id"])

    default_storyline_uuid = str(uuid_lib.uuid4())
    op.execute(
        f"INSERT INTO storylines (uuid, campaign_id, title) VALUES ('{default_storyline_uuid}', 1, 'Default Storyline')"
    )

    # ------------------------------------------------------------------
    # 3. Add new columns to sessions
    # ------------------------------------------------------------------
    op.add_column("sessions", sa.Column("uuid", sa.String(36), nullable=True))
    op.add_column("sessions", sa.Column("campaign_id", sa.Integer(), nullable=True))
    op.add_column("sessions", sa.Column("recap_notes", sa.Text(), nullable=True))
    op.add_column("sessions", sa.Column("active_storyline_id", sa.Integer(), nullable=True))

    # Populate UUIDs for existing sessions
    conn = op.get_bind()
    session_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM sessions")).fetchall()]
    for sid in session_ids:
        op.execute(f"UPDATE sessions SET uuid = '{uuid_lib.uuid4()}' WHERE id = {sid}")

    op.execute("UPDATE sessions SET campaign_id = 1")
    op.execute("UPDATE sessions SET active_storyline_id = 1")

    op.alter_column("sessions", "campaign_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        "fk_sessions_campaign", "sessions", "campaigns", ["campaign_id"], ["id"],
        ondelete="CASCADE",
    )
    op.create_foreign_key(
        "fk_sessions_storyline", "sessions", "storylines",
        ["active_storyline_id"], ["id"], ondelete="SET NULL",
    )

    # ------------------------------------------------------------------
    # 4. Add new columns to scenes
    # ------------------------------------------------------------------
    op.add_column("scenes", sa.Column("uuid", sa.String(36), nullable=True))
    op.add_column("scenes", sa.Column("storyline_id", sa.Integer(), nullable=True))
    op.add_column("scenes", sa.Column("dm_notes", sa.Text(), nullable=True))
    op.add_column(
        "scenes",
        sa.Column("scene_type", sa.String(20), nullable=False, server_default="story"),
    )
    op.add_column("scenes", sa.Column("puzzle_clues", sa.Text(), nullable=True))
    op.add_column("scenes", sa.Column("puzzle_solution", sa.Text(), nullable=True))

    # Populate UUIDs for existing scenes
    scene_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM scenes")).fetchall()]
    for scid in scene_ids:
        op.execute(f"UPDATE scenes SET uuid = '{uuid_lib.uuid4()}' WHERE id = {scid}")

    op.execute("UPDATE scenes SET storyline_id = 1")
    op.alter_column("scenes", "storyline_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        "fk_scenes_storyline", "scenes", "storylines", ["storyline_id"], ["id"],
        ondelete="CASCADE",
    )

    # ------------------------------------------------------------------
    # 5. session_scenes junction table
    # ------------------------------------------------------------------
    op.create_table(
        "session_scenes",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("session_id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["session_id"], ["sessions.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("session_id", "scene_id"),
    )
    op.create_index("ix_session_scenes_id", "session_scenes", ["id"])

    # Populate session_scenes from existing scenes.session_id
    rows = conn.execute(
        sa.text("SELECT id, session_id, order_index FROM scenes WHERE session_id IS NOT NULL")
    ).fetchall()
    for scene_id, session_id, order_index in rows:
        op.execute(
            f"INSERT INTO session_scenes (session_id, scene_id, order_index) "
            f"VALUES ({session_id}, {scene_id}, {order_index})"
        )

    # ------------------------------------------------------------------
    # 6. Drop session_id from scenes
    # ------------------------------------------------------------------
    # Find and drop the FK constraint on scenes.session_id
    inspector = sa.inspect(conn)
    fks = inspector.get_foreign_keys("scenes")
    for fk in fks:
        if "session_id" in fk.get("constrained_columns", []):
            op.drop_constraint(fk["name"], "scenes", type_="foreignkey")
            break
    op.drop_column("scenes", "session_id")

    # ------------------------------------------------------------------
    # 7. Add campaign_id to characters
    # ------------------------------------------------------------------
    op.add_column("characters", sa.Column("campaign_id", sa.Integer(), nullable=True))
    op.execute("UPDATE characters SET campaign_id = 1")
    op.alter_column("characters", "campaign_id", existing_type=sa.Integer(), nullable=False)
    op.create_foreign_key(
        "fk_characters_campaign", "characters", "campaigns", ["campaign_id"], ["id"],
        ondelete="CASCADE",
    )

    # ------------------------------------------------------------------
    # 8. scene_enemies table
    # ------------------------------------------------------------------
    op.create_table(
        "scene_enemies",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("quantity", sa.Integer(), nullable=False, server_default=sa.text("1")),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scene_enemies_id", "scene_enemies", ["id"])

    # ------------------------------------------------------------------
    # 9. scene_shop_items table
    # ------------------------------------------------------------------
    op.create_table(
        "scene_shop_items",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("scene_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False, server_default=""),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("price", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.Column("currency", sa.String(10), nullable=False, server_default="gold"),
        sa.Column("order_index", sa.Integer(), nullable=False, server_default=sa.text("0")),
        sa.ForeignKeyConstraint(["scene_id"], ["scenes.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_scene_shop_items_id", "scene_shop_items", ["id"])


def downgrade() -> None:
    op.drop_index("ix_scene_shop_items_id", table_name="scene_shop_items")
    op.drop_table("scene_shop_items")
    op.drop_index("ix_scene_enemies_id", table_name="scene_enemies")
    op.drop_table("scene_enemies")
    op.drop_constraint("fk_characters_campaign", "characters", type_="foreignkey")
    op.drop_column("characters", "campaign_id")
    op.add_column(
        "scenes",
        sa.Column("session_id", sa.Integer(), nullable=True),
    )
    op.create_foreign_key(None, "scenes", "sessions", ["session_id"], ["id"], ondelete="CASCADE")
    # Restore session_id from session_scenes
    conn = op.get_bind()
    rows = conn.execute(
        sa.text("SELECT session_id, scene_id FROM session_scenes")
    ).fetchall()
    for session_id, scene_id in rows:
        op.execute(f"UPDATE scenes SET session_id = {session_id} WHERE id = {scene_id}")
    op.drop_index("ix_session_scenes_id", table_name="session_scenes")
    op.drop_table("session_scenes")
    op.drop_constraint("fk_scenes_storyline", "scenes", type_="foreignkey")
    op.drop_column("scenes", "puzzle_solution")
    op.drop_column("scenes", "puzzle_clues")
    op.drop_column("scenes", "scene_type")
    op.drop_column("scenes", "dm_notes")
    op.drop_column("scenes", "storyline_id")
    op.drop_column("scenes", "uuid")
    op.drop_constraint("fk_sessions_storyline", "sessions", type_="foreignkey")
    op.drop_constraint("fk_sessions_campaign", "sessions", type_="foreignkey")
    op.drop_column("sessions", "active_storyline_id")
    op.drop_column("sessions", "recap_notes")
    op.drop_column("sessions", "campaign_id")
    op.drop_column("sessions", "uuid")
    op.drop_index("ix_storylines_id", table_name="storylines")
    op.drop_table("storylines")
    op.drop_index("ix_campaigns_id", table_name="campaigns")
    op.drop_table("campaigns")
