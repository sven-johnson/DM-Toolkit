"""finish schema migration

Revision ID: 0004
Revises: 0003
Create Date: 2026-04-05 00:00:00.000000

"""

import uuid as uuid_lib

import sqlalchemy as sa
from alembic import op

revision = "0004"
down_revision = "0003"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    inspector = sa.inspect(conn)

    # ------------------------------------------------------------------
    # 1. Add new columns to scenes
    # ------------------------------------------------------------------
    existing_scene_cols = [c["name"] for c in inspector.get_columns("scenes")]

    if "uuid" not in existing_scene_cols:
        op.add_column("scenes", sa.Column("uuid", sa.String(36), nullable=True))
    if "storyline_id" not in existing_scene_cols:
        op.add_column("scenes", sa.Column("storyline_id", sa.Integer(), nullable=True))
    if "dm_notes" not in existing_scene_cols:
        op.add_column("scenes", sa.Column("dm_notes", sa.Text(), nullable=True))
    if "scene_type" not in existing_scene_cols:
        op.add_column(
            "scenes",
            sa.Column("scene_type", sa.String(20), nullable=False, server_default="story"),
        )
    if "puzzle_clues" not in existing_scene_cols:
        op.add_column("scenes", sa.Column("puzzle_clues", sa.Text(), nullable=True))
    if "puzzle_solution" not in existing_scene_cols:
        op.add_column("scenes", sa.Column("puzzle_solution", sa.Text(), nullable=True))

    # Populate UUIDs for existing scenes
    scene_ids = [row[0] for row in conn.execute(sa.text("SELECT id FROM scenes")).fetchall()]
    for scid in scene_ids:
        conn.execute(sa.text(f"UPDATE scenes SET uuid = '{uuid_lib.uuid4()}' WHERE id = {scid}"))

    # Assign all existing scenes to Default Storyline (id=1)
    conn.execute(sa.text("UPDATE scenes SET storyline_id = 1 WHERE storyline_id IS NULL"))

    # Make storyline_id NOT NULL and add FK
    op.alter_column("scenes", "storyline_id", existing_type=sa.Integer(), nullable=False)
    existing_fks = [fk["name"] for fk in inspector.get_foreign_keys("scenes")]
    if "fk_scenes_storyline" not in existing_fks:
        op.create_foreign_key(
            "fk_scenes_storyline", "scenes", "storylines", ["storyline_id"], ["id"],
            ondelete="CASCADE",
        )

    # ------------------------------------------------------------------
    # 2. session_scenes junction table
    # ------------------------------------------------------------------
    all_tables = inspector.get_table_names()
    if "session_scenes" not in all_tables:
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

        # Populate from existing scenes.session_id
        rows = conn.execute(
            sa.text("SELECT id, session_id, order_index FROM scenes WHERE session_id IS NOT NULL")
        ).fetchall()
        for scene_id, session_id, order_index in rows:
            conn.execute(
                sa.text(
                    f"INSERT INTO session_scenes (session_id, scene_id, order_index) "
                    f"VALUES ({session_id}, {scene_id}, {order_index})"
                )
            )

    # ------------------------------------------------------------------
    # 3. Drop session_id from scenes
    # ------------------------------------------------------------------
    existing_scene_cols = [c["name"] for c in inspector.get_columns("scenes")]
    if "session_id" in existing_scene_cols:
        fks = inspector.get_foreign_keys("scenes")
        for fk in fks:
            if "session_id" in fk.get("constrained_columns", []):
                op.drop_constraint(fk["name"], "scenes", type_="foreignkey")
                break
        op.drop_column("scenes", "session_id")

    # ------------------------------------------------------------------
    # 4. Add campaign_id to characters
    # ------------------------------------------------------------------
    existing_char_cols = [c["name"] for c in inspector.get_columns("characters")]
    if "campaign_id" not in existing_char_cols:
        op.add_column("characters", sa.Column("campaign_id", sa.Integer(), nullable=True))
        conn.execute(sa.text("UPDATE characters SET campaign_id = 1"))
        op.alter_column("characters", "campaign_id", existing_type=sa.Integer(), nullable=False)
        op.create_foreign_key(
            "fk_characters_campaign", "characters", "campaigns", ["campaign_id"], ["id"],
            ondelete="CASCADE",
        )

    # ------------------------------------------------------------------
    # 5. scene_enemies table
    # ------------------------------------------------------------------
    if "scene_enemies" not in all_tables:
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
    # 6. scene_shop_items table
    # ------------------------------------------------------------------
    if "scene_shop_items" not in all_tables:
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
    op.add_column("scenes", sa.Column("session_id", sa.Integer(), nullable=True))
    op.create_foreign_key(None, "scenes", "sessions", ["session_id"], ["id"], ondelete="CASCADE")
    conn = op.get_bind()
    rows = conn.execute(sa.text("SELECT session_id, scene_id FROM session_scenes")).fetchall()
    for session_id, scene_id in rows:
        conn.execute(sa.text(f"UPDATE scenes SET session_id = {session_id} WHERE id = {scene_id}"))
    op.drop_index("ix_session_scenes_id", table_name="session_scenes")
    op.drop_table("session_scenes")
    op.drop_constraint("fk_scenes_storyline", "scenes", type_="foreignkey")
    op.drop_column("scenes", "puzzle_solution")
    op.drop_column("scenes", "puzzle_clues")
    op.drop_column("scenes", "scene_type")
    op.drop_column("scenes", "dm_notes")
    op.drop_column("scenes", "storyline_id")
    op.drop_column("scenes", "uuid")
