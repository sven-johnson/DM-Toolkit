"""migrate all primary keys and foreign keys from INT to VARCHAR(36) UUIDs

Revision ID: 0008
Revises: 0007
Create Date: 2026-05-03

"""
import json

import sqlalchemy as sa
from alembic import op

revision = "0008"
down_revision = "0007"
branch_labels = None
depends_on = None


def upgrade() -> None:
    conn = op.get_bind()
    conn.execute(sa.text("SET FOREIGN_KEY_CHECKS = 0"))

    # -------------------------------------------------------------------------
    # Step 1: Add new_id and new FK columns, populate them
    # -------------------------------------------------------------------------

    # campaigns: new_id from existing uuid column (COALESCE handles any nulls)
    conn.execute(sa.text("ALTER TABLE campaigns ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE campaigns SET new_id = COALESCE(uuid, UUID())"))

    # storylines: new_id from uuid; new_campaign_id via JOIN
    conn.execute(sa.text("ALTER TABLE storylines ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE storylines ADD COLUMN new_campaign_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE storylines SET new_id = COALESCE(uuid, UUID())"))
    conn.execute(sa.text(
        "UPDATE storylines sl JOIN campaigns c ON c.id = sl.campaign_id SET sl.new_campaign_id = c.new_id"
    ))

    # sessions: new_id from uuid; new_campaign_id; new_active_storyline_id
    conn.execute(sa.text("ALTER TABLE sessions ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE sessions ADD COLUMN new_campaign_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE sessions ADD COLUMN new_active_storyline_id VARCHAR(36) NULL"))
    conn.execute(sa.text("UPDATE sessions SET new_id = COALESCE(uuid, UUID())"))
    conn.execute(sa.text(
        "UPDATE sessions s JOIN campaigns c ON c.id = s.campaign_id SET s.new_campaign_id = c.new_id"
    ))
    conn.execute(sa.text(
        "UPDATE sessions s JOIN storylines sl ON sl.id = s.active_storyline_id "
        "SET s.new_active_storyline_id = sl.new_id WHERE s.active_storyline_id IS NOT NULL"
    ))

    # scenes: new_id from uuid; new_storyline_id via JOIN
    conn.execute(sa.text("ALTER TABLE scenes ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE scenes ADD COLUMN new_storyline_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE scenes SET new_id = COALESCE(uuid, UUID())"))
    conn.execute(sa.text(
        "UPDATE scenes sc JOIN storylines sl ON sl.id = sc.storyline_id SET sc.new_storyline_id = sl.new_id"
    ))

    # session_scenes: new_id via UUID(); new_session_id; new_scene_id
    conn.execute(sa.text("ALTER TABLE session_scenes ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE session_scenes ADD COLUMN new_session_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE session_scenes ADD COLUMN new_scene_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE session_scenes SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE session_scenes ss JOIN sessions s ON s.id = ss.session_id SET ss.new_session_id = s.new_id"
    ))
    conn.execute(sa.text(
        "UPDATE session_scenes ss JOIN scenes sc ON sc.id = ss.scene_id SET ss.new_scene_id = sc.new_id"
    ))

    # scene_enemies: new_id via UUID(); new_scene_id
    conn.execute(sa.text("ALTER TABLE scene_enemies ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE scene_enemies ADD COLUMN new_scene_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE scene_enemies SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE scene_enemies se JOIN scenes sc ON sc.id = se.scene_id SET se.new_scene_id = sc.new_id"
    ))

    # scene_shop_items: new_id via UUID(); new_scene_id
    conn.execute(sa.text("ALTER TABLE scene_shop_items ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE scene_shop_items ADD COLUMN new_scene_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE scene_shop_items SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE scene_shop_items si JOIN scenes sc ON sc.id = si.scene_id SET si.new_scene_id = sc.new_id"
    ))

    # characters: new_id via UUID(); new_campaign_id
    conn.execute(sa.text("ALTER TABLE characters ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE characters ADD COLUMN new_campaign_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE characters SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE characters ch JOIN campaigns c ON c.id = ch.campaign_id SET ch.new_campaign_id = c.new_id"
    ))

    # wiki_articles: new_id via UUID(); new_campaign_id
    conn.execute(sa.text("ALTER TABLE wiki_articles ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE wiki_articles ADD COLUMN new_campaign_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE wiki_articles SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE wiki_articles wa JOIN campaigns c ON c.id = wa.campaign_id SET wa.new_campaign_id = c.new_id"
    ))

    # wiki_associations: new_id via UUID(); new_source; new_target
    conn.execute(sa.text("ALTER TABLE wiki_associations ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE wiki_associations ADD COLUMN new_source_article_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE wiki_associations ADD COLUMN new_target_article_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE wiki_associations SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE wiki_associations wa JOIN wiki_articles src ON src.id = wa.source_article_id "
        "SET wa.new_source_article_id = src.new_id"
    ))
    conn.execute(sa.text(
        "UPDATE wiki_associations wa JOIN wiki_articles tgt ON tgt.id = wa.target_article_id "
        "SET wa.new_target_article_id = tgt.new_id"
    ))

    # checks: new_id via UUID(); new_scene_id
    conn.execute(sa.text("ALTER TABLE checks ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE checks ADD COLUMN new_scene_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE checks SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE checks ck JOIN scenes sc ON sc.id = ck.scene_id SET ck.new_scene_id = sc.new_id"
    ))

    # rolls: new_id via UUID(); new_check_id; new_character_id
    conn.execute(sa.text("ALTER TABLE rolls ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE rolls ADD COLUMN new_check_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("ALTER TABLE rolls ADD COLUMN new_character_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE rolls SET new_id = UUID()"))
    conn.execute(sa.text(
        "UPDATE rolls r JOIN checks ck ON ck.id = r.check_id SET r.new_check_id = ck.new_id"
    ))
    conn.execute(sa.text(
        "UPDATE rolls r JOIN characters ch ON ch.id = r.character_id SET r.new_character_id = ch.new_id"
    ))

    # users: new_id via UUID()
    conn.execute(sa.text("ALTER TABLE users ADD COLUMN new_id VARCHAR(36) NOT NULL DEFAULT ''"))
    conn.execute(sa.text("UPDATE users SET new_id = UUID()"))

    # -------------------------------------------------------------------------
    # Step 2: Migrate Check.character_ids JSON arrays: int IDs -> string UUIDs
    # -------------------------------------------------------------------------
    char_rows = list(conn.execute(sa.text("SELECT id, new_id FROM characters")))
    char_map = {row[0]: row[1] for row in char_rows}

    check_rows = list(conn.execute(sa.text("SELECT id, character_ids FROM checks")))
    for check_id, char_ids_raw in check_rows:
        if not char_ids_raw:
            continue
        try:
            old_ids = json.loads(char_ids_raw) if isinstance(char_ids_raw, str) else char_ids_raw
        except (json.JSONDecodeError, TypeError):
            continue
        if not old_ids:
            continue
        new_ids = [char_map.get(int(cid), str(cid)) for cid in old_ids]
        conn.execute(
            sa.text("UPDATE checks SET character_ids = :new_ids WHERE id = :check_id"),
            {"new_ids": json.dumps(new_ids), "check_id": check_id},
        )

    # -------------------------------------------------------------------------
    # Step 3a: Drop ALL FK constraints (must happen before dropping unique indexes
    # that back those FK constraints — FOREIGN_KEY_CHECKS=0 doesn't bypass this)
    # -------------------------------------------------------------------------
    fk_rows = list(conn.execute(sa.text(
        "SELECT TABLE_NAME, CONSTRAINT_NAME "
        "FROM information_schema.TABLE_CONSTRAINTS "
        "WHERE TABLE_SCHEMA = DATABASE() "
        "AND CONSTRAINT_TYPE = 'FOREIGN KEY'"
    )))
    for fk_table, fk_name in fk_rows:
        conn.execute(sa.text(f"ALTER TABLE `{fk_table}` DROP FOREIGN KEY `{fk_name}`"))

    # -------------------------------------------------------------------------
    # Step 3b: Drop unique constraints (find by INFORMATION_SCHEMA)
    # -------------------------------------------------------------------------
    constraint_rows = list(conn.execute(sa.text(
        "SELECT CONSTRAINT_NAME, TABLE_NAME "
        "FROM information_schema.TABLE_CONSTRAINTS "
        "WHERE TABLE_SCHEMA = DATABASE() "
        "AND CONSTRAINT_TYPE = 'UNIQUE' "
        "AND TABLE_NAME IN ('session_scenes', 'rolls', 'wiki_articles', 'wiki_associations')"
    )))
    for constraint_name, table_name in constraint_rows:
        conn.execute(sa.text(f"ALTER TABLE `{table_name}` DROP INDEX `{constraint_name}`"))

    # -------------------------------------------------------------------------
    # Step 4: Swap PKs and FK columns for every table
    # -------------------------------------------------------------------------

    # campaigns
    conn.execute(sa.text("ALTER TABLE campaigns MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE campaigns DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE campaigns DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE campaigns DROP COLUMN uuid"))
    conn.execute(sa.text("ALTER TABLE campaigns CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE campaigns ADD PRIMARY KEY (id)"))

    # storylines
    conn.execute(sa.text("ALTER TABLE storylines MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE storylines DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE storylines DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE storylines DROP COLUMN uuid"))
    conn.execute(sa.text("ALTER TABLE storylines CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE storylines DROP COLUMN campaign_id"))
    conn.execute(sa.text("ALTER TABLE storylines CHANGE COLUMN new_campaign_id campaign_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE storylines ADD PRIMARY KEY (id)"))

    # sessions
    conn.execute(sa.text("ALTER TABLE sessions MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE sessions DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE sessions DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE sessions DROP COLUMN uuid"))
    conn.execute(sa.text("ALTER TABLE sessions CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE sessions DROP COLUMN campaign_id"))
    conn.execute(sa.text("ALTER TABLE sessions CHANGE COLUMN new_campaign_id campaign_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE sessions DROP COLUMN active_storyline_id"))
    conn.execute(sa.text("ALTER TABLE sessions CHANGE COLUMN new_active_storyline_id active_storyline_id VARCHAR(36) NULL"))
    conn.execute(sa.text("ALTER TABLE sessions ADD PRIMARY KEY (id)"))

    # scenes
    conn.execute(sa.text("ALTER TABLE scenes MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scenes DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE scenes DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE scenes DROP COLUMN uuid"))
    conn.execute(sa.text("ALTER TABLE scenes CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scenes DROP COLUMN storyline_id"))
    conn.execute(sa.text("ALTER TABLE scenes CHANGE COLUMN new_storyline_id storyline_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scenes ADD PRIMARY KEY (id)"))

    # session_scenes
    conn.execute(sa.text("ALTER TABLE session_scenes MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE session_scenes DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE session_scenes DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE session_scenes CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE session_scenes DROP COLUMN session_id"))
    conn.execute(sa.text("ALTER TABLE session_scenes CHANGE COLUMN new_session_id session_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE session_scenes DROP COLUMN scene_id"))
    conn.execute(sa.text("ALTER TABLE session_scenes CHANGE COLUMN new_scene_id scene_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE session_scenes ADD PRIMARY KEY (id)"))

    # scene_enemies
    conn.execute(sa.text("ALTER TABLE scene_enemies MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scene_enemies DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE scene_enemies DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE scene_enemies CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scene_enemies DROP COLUMN scene_id"))
    conn.execute(sa.text("ALTER TABLE scene_enemies CHANGE COLUMN new_scene_id scene_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scene_enemies ADD PRIMARY KEY (id)"))

    # scene_shop_items
    conn.execute(sa.text("ALTER TABLE scene_shop_items MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scene_shop_items DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE scene_shop_items DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE scene_shop_items CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scene_shop_items DROP COLUMN scene_id"))
    conn.execute(sa.text("ALTER TABLE scene_shop_items CHANGE COLUMN new_scene_id scene_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE scene_shop_items ADD PRIMARY KEY (id)"))

    # characters
    conn.execute(sa.text("ALTER TABLE characters MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE characters DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE characters DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE characters CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE characters DROP COLUMN campaign_id"))
    conn.execute(sa.text("ALTER TABLE characters CHANGE COLUMN new_campaign_id campaign_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE characters ADD PRIMARY KEY (id)"))

    # wiki_articles
    conn.execute(sa.text("ALTER TABLE wiki_articles MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE wiki_articles DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE wiki_articles DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE wiki_articles CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE wiki_articles DROP COLUMN campaign_id"))
    conn.execute(sa.text("ALTER TABLE wiki_articles CHANGE COLUMN new_campaign_id campaign_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE wiki_articles ADD PRIMARY KEY (id)"))

    # wiki_associations
    conn.execute(sa.text("ALTER TABLE wiki_associations MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE wiki_associations DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE wiki_associations DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE wiki_associations CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE wiki_associations DROP COLUMN source_article_id"))
    conn.execute(sa.text("ALTER TABLE wiki_associations CHANGE COLUMN new_source_article_id source_article_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE wiki_associations DROP COLUMN target_article_id"))
    conn.execute(sa.text("ALTER TABLE wiki_associations CHANGE COLUMN new_target_article_id target_article_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE wiki_associations ADD PRIMARY KEY (id)"))

    # checks
    conn.execute(sa.text("ALTER TABLE checks MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE checks DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE checks DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE checks CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE checks DROP COLUMN scene_id"))
    conn.execute(sa.text("ALTER TABLE checks CHANGE COLUMN new_scene_id scene_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE checks ADD PRIMARY KEY (id)"))

    # rolls
    conn.execute(sa.text("ALTER TABLE rolls MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE rolls DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE rolls DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE rolls CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE rolls DROP COLUMN check_id"))
    conn.execute(sa.text("ALTER TABLE rolls CHANGE COLUMN new_check_id check_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE rolls DROP COLUMN character_id"))
    conn.execute(sa.text("ALTER TABLE rolls CHANGE COLUMN new_character_id character_id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE rolls ADD PRIMARY KEY (id)"))

    # users
    conn.execute(sa.text("ALTER TABLE users MODIFY COLUMN id INT NOT NULL"))
    conn.execute(sa.text("ALTER TABLE users DROP PRIMARY KEY"))
    conn.execute(sa.text("ALTER TABLE users DROP COLUMN id"))
    conn.execute(sa.text("ALTER TABLE users CHANGE COLUMN new_id id VARCHAR(36) NOT NULL"))
    conn.execute(sa.text("ALTER TABLE users ADD PRIMARY KEY (id)"))

    # -------------------------------------------------------------------------
    # Step 5: Re-add foreign key constraints
    # -------------------------------------------------------------------------
    op.create_foreign_key("fk_storylines_campaign", "storylines", "campaigns", ["campaign_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_sessions_campaign", "sessions", "campaigns", ["campaign_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_sessions_storyline", "sessions", "storylines", ["active_storyline_id"], ["id"], ondelete="SET NULL")
    op.create_foreign_key("fk_session_scenes_session", "session_scenes", "sessions", ["session_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_session_scenes_scene", "session_scenes", "scenes", ["scene_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_scenes_storyline", "scenes", "storylines", ["storyline_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_scene_enemies_scene", "scene_enemies", "scenes", ["scene_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_scene_shop_items_scene", "scene_shop_items", "scenes", ["scene_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_characters_campaign", "characters", "campaigns", ["campaign_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_wiki_articles_campaign", "wiki_articles", "campaigns", ["campaign_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_wiki_assoc_source", "wiki_associations", "wiki_articles", ["source_article_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_wiki_assoc_target", "wiki_associations", "wiki_articles", ["target_article_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_checks_scene", "checks", "scenes", ["scene_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_rolls_check", "rolls", "checks", ["check_id"], ["id"], ondelete="CASCADE")
    op.create_foreign_key("fk_rolls_character", "rolls", "characters", ["character_id"], ["id"], ondelete="CASCADE")

    # -------------------------------------------------------------------------
    # Step 6: Re-add unique constraints
    # -------------------------------------------------------------------------
    op.create_unique_constraint("uq_session_scenes", "session_scenes", ["session_id", "scene_id"])
    op.create_unique_constraint("uq_rolls", "rolls", ["check_id", "character_id"])
    op.create_unique_constraint("uq_wiki_articles_title", "wiki_articles", ["campaign_id", "title"])
    op.create_unique_constraint("uq_wiki_assoc", "wiki_associations", ["source_article_id", "target_article_id", "association_label"])

    conn.execute(sa.text("SET FOREIGN_KEY_CHECKS = 1"))


def downgrade() -> None:
    raise NotImplementedError("Downgrade not supported for GUID migration")
