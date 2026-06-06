"""Integration tests for the character combat profile service — turn-based.

Uses an in-memory SQLite database with minimal seed data.
Run from backend/ with:
  pytest tests/monster_factory/test_character_combat_service.py -v
"""
import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session as DBSession
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    Campaign,
    Character,
    CharacterCombatTurn,
    CharacterCombatTurnLineItem,
    CharacterStat as CharacterStatORM,
    RuleSystem,
    StatDefinition,
)
from app.monster_factory.services.character_combat_service import (
    get_campaign_party_summary,
    get_character_turns,
    load_character_combat_profile,
    load_campaign_combat_profiles,
)

# ── Test DB setup ─────────────────────────────────────────────────────────────

_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(_ENGINE, "connect")
def _fk(dbapi_conn, _rec):
    dbapi_conn.cursor().execute("PRAGMA foreign_keys=ON")


_Session = sessionmaker(autocommit=False, autoflush=False, bind=_ENGINE)


@pytest.fixture(autouse=True)
def _reset():
    Base.metadata.create_all(bind=_ENGINE)
    yield
    Base.metadata.drop_all(bind=_ENGINE)


@pytest.fixture
def db() -> DBSession:
    session = _Session()
    try:
        yield session
    finally:
        session.close()


# ── Seed helpers ──────────────────────────────────────────────────────────────

def _seed_rs(db: DBSession) -> tuple[RuleSystem, dict[str, StatDefinition]]:
    rs = RuleSystem(slug="dnd_5_5e", name="D&D 5.5e", version="2024", is_default=True)
    db.add(rs)
    db.flush()
    stat_data = [
        ("strength",    "Strength",    "STR", "ability_score", True),
        ("dexterity",   "Dexterity",   "DEX", "ability_score", True),
        ("constitution","Constitution","CON", "ability_score", True),
    ]
    stat_defs: dict[str, StatDefinition] = {}
    for i, (slug, name, abbr, stype, mod) in enumerate(stat_data):
        s = StatDefinition(
            rule_system_id=rs.id, slug=slug, name=name, abbreviation=abbr,
            stat_type=stype, has_modifier=mod,
            modifier_formula="floor((value - 10) / 2)" if mod else None,
            sort_order=i,
        )
        db.add(s)
        stat_defs[slug] = s
    db.flush()
    db.commit()
    return rs, stat_defs


def _campaign(db: DBSession) -> Campaign:
    c = Campaign(id=str(uuid.uuid4()), name="Test Campaign")
    db.add(c)
    db.commit()
    return c


def _character(db: DBSession, campaign_id: str, name: str = "Hero",
               level: int = 5, max_hp: int = 40, ac: int = 16) -> Character:
    ch = Character(
        id=str(uuid.uuid4()), campaign_id=campaign_id,
        name=name, level=level, max_hp=max_hp, ac=ac,
    )
    db.add(ch)
    db.commit()
    return ch


def _add_stat(db: DBSession, character_id: str, stat_def: StatDefinition, value: int):
    db.add(CharacterStatORM(character_id=character_id, stat_definition_id=stat_def.id, value=value))
    db.commit()


def _add_turn(
    db: DBSession,
    character_id: str,
    name: str,
    turn_type: str,
    is_primary: bool = False,
    notes: str | None = None,
    sort_order: int = 0,
) -> CharacterCombatTurn:
    turn = CharacterCombatTurn(
        character_id=character_id,
        name=name,
        turn_type=turn_type,
        is_primary=is_primary,
        notes=notes,
        sort_order=sort_order,
    )
    db.add(turn)
    db.commit()
    db.refresh(turn)
    return turn


def _add_line_item(
    db: DBSession,
    turn_id: int,
    name: str,
    average_damage: float,
    dice_notation: str | None = None,
    is_bonus_action: bool = False,
    sort_order: int = 0,
) -> CharacterCombatTurnLineItem:
    item = CharacterCombatTurnLineItem(
        turn_id=turn_id,
        name=name,
        average_damage=average_damage,
        dice_notation=dice_notation,
        is_bonus_action=is_bonus_action,
        sort_order=sort_order,
    )
    db.add(item)
    db.commit()
    return item


# ── Test 1: character with primary turns computes correct damage ──────────────

def test_primary_turns_compute_correct_nova_and_sustained(db: DBSession):
    """
    Nova turn: Inflict Wounds (16.5) + Spiritual Weapon (11.0) = 27.5
    Sustained turn: Flail (6.5) + Spiritual Weapon (16.5) = 23.0
    """
    _, stat_defs = _seed_rs(db)
    campaign = _campaign(db)
    char = _character(db, campaign.id, name="Dutch", level=6, max_hp=50, ac=18)
    _add_stat(db, char.id, stat_defs["strength"], 16)

    nova_turn = _add_turn(db, char.id, "Nova", "nova", is_primary=True)
    _add_line_item(db, nova_turn.id, "Inflict Wounds L3", 16.5, dice_notation="5d10")
    _add_line_item(db, nova_turn.id, "Spiritual Weapon L2", 11.0, dice_notation="3d8+3",
                   is_bonus_action=True)

    sustained_turn = _add_turn(db, char.id, "Sustained — Spirit Up", "sustained", is_primary=True)
    _add_line_item(db, sustained_turn.id, "Flail", 6.5, dice_notation="1d8+2")
    _add_line_item(db, sustained_turn.id, "Spiritual Weapon L2", 16.5, dice_notation="3d8+3",
                   is_bonus_action=True)

    profile = load_character_combat_profile(char.id, db)

    assert profile.character_name == "Dutch"
    assert profile.nova_damage == pytest.approx(27.5)
    assert profile.sustained_damage_per_round == pytest.approx(23.0)
    assert profile.proficiency_bonus == 3        # level 6 → +3
    assert profile.modifiers.get("strength") == 3  # (16-10)/2 = 3


# ── Test 2: multiple turns of same type — only primary one is used ────────────

def test_only_primary_turn_is_used_for_damage(db: DBSession):
    """Two nova turns — only the primary one contributes to nova_damage."""
    _seed_rs(db)
    campaign = _campaign(db)
    char = _character(db, campaign.id, name="Verso", level=6, max_hp=42, ac=14)

    primary_nova = _add_turn(db, char.id, "Nova — Spirit Active", "nova", is_primary=True)
    _add_line_item(db, primary_nova.id, "Burning Hands L3", 22.0)
    _add_line_item(db, primary_nova.id, "Wildfire Spirit", 17.5)

    non_primary_nova = _add_turn(db, char.id, "Nova — No Spirit", "nova", is_primary=False)
    _add_line_item(db, non_primary_nova.id, "Scorching Ray L3", 21.0)

    profile = load_character_combat_profile(char.id, db)

    # Only the primary turn's total (22.0 + 17.5 = 39.5)
    assert profile.nova_damage == pytest.approx(39.5)
    # No primary sustained turn → 0.0
    assert profile.sustained_damage_per_round == pytest.approx(0.0)


# ── Test 3: character with no primary turns is incomplete and has zero damage ─

def test_no_primary_turns_gives_zero_damage_and_marks_incomplete(db: DBSession):
    """A character with variant turns (no primary) gets nova=0, sustained=0, incomplete."""
    _seed_rs(db)
    campaign = _campaign(db)
    char = _character(db, campaign.id, name="NewPlayer", level=1, max_hp=10, ac=10)

    # Add a non-primary turn — should not be read
    variant_turn = _add_turn(db, char.id, "Experimental", "variant", is_primary=False)
    _add_line_item(db, variant_turn.id, "Punch", 3.5)

    profile = load_character_combat_profile(char.id, db)

    assert profile.nova_damage == pytest.approx(0.0)
    assert profile.sustained_damage_per_round == pytest.approx(0.0)

    summary = get_campaign_party_summary(campaign.id, db)
    assert "NewPlayer" in summary.incomplete_characters
    assert summary.has_complete_data is False


# ── Test 4: four-character campaign, all set up ───────────────────────────────

def test_party_summary_four_characters_all_complete(db: DBSession):
    """All four characters set up with primary turns → has_complete_data=True, correct sums."""
    _, stat_defs = _seed_rs(db)
    campaign = _campaign(db)

    nova_values      = [27.5, 30.0, 15.5, 21.0]
    sustained_values = [23.0, 30.0, 9.0,  15.5]
    hp_list          = [50, 42, 38, 44]

    for i in range(4):
        ch = _character(db, campaign.id, name=f"Char{i}", level=5, max_hp=hp_list[i], ac=15)
        _add_stat(db, ch.id, stat_defs["strength"], 10)

        nova_t = _add_turn(db, ch.id, "Nova", "nova", is_primary=True)
        _add_line_item(db, nova_t.id, "Attack", nova_values[i])

        sust_t = _add_turn(db, ch.id, "Sustained", "sustained", is_primary=True)
        _add_line_item(db, sust_t.id, "Attack", sustained_values[i])

    summary = get_campaign_party_summary(campaign.id, db)

    assert summary.party_size == 4
    assert summary.has_complete_data is True
    assert summary.incomplete_characters == []
    assert summary.party_nova == pytest.approx(sum(nova_values))
    assert summary.party_sustained == pytest.approx(sum(sustained_values))
    assert summary.lowest_hp == min(hp_list)
    assert summary.total_hp == sum(hp_list)


# ── Test 5: get_character_turns returns correct structure ─────────────────────

def test_get_character_turns_structure(db: DBSession):
    """get_character_turns returns turns with nested line items and correct turn_total."""
    _seed_rs(db)
    campaign = _campaign(db)
    char = _character(db, campaign.id, name="Tom", level=5, max_hp=36, ac=15)

    turn = _add_turn(db, char.id, "Nova", "nova", is_primary=True, sort_order=0)
    _add_line_item(db, turn.id, "Dagger 1", 6.5, dice_notation="1d4+4", sort_order=0)
    _add_line_item(db, turn.id, "Dagger 2", 6.5, dice_notation="1d4+4", sort_order=1)
    _add_line_item(db, turn.id, "Sneak Attack", 10.5, dice_notation="3d6", sort_order=2)

    turns = get_character_turns(char.id, db)

    assert len(turns) == 1
    t = turns[0]
    assert t.name == "Nova"
    assert t.turn_type == "nova"
    assert t.is_primary is True
    assert len(t.line_items) == 3
    assert t.turn_total == pytest.approx(6.5 + 6.5 + 10.5)
    assert t.line_items[0].name == "Dagger 1"
    assert t.line_items[0].dice_notation == "1d4+4"
