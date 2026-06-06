"""Service layer for character combat profiles.

Connects the DB layer to the rule system abstraction layer.
Nova and sustained damage are computed from the character's primary
turn templates (CharacterCombatTurn with is_primary=True).
"""
from __future__ import annotations

from dataclasses import dataclass, field

from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession, selectinload

from ...models import (
    Campaign,
    Character,
    CharacterCombatTurn,
    CharacterCombatTurnLineItem,
    CharacterSkill as CharacterSkillORM,
    CharacterStat as CharacterStatORM,
)
from ...rule_system_helpers import get_campaign_rule_system
from ...rule_systems.base import (
    CharacterCombatProfile,
    SkillProficiency,
)
from ...rule_systems.loader import get_rule_system


# ── Turn summary schemas ──────────────────────────────────────────────────────

class TurnLineItemSummary(BaseModel):
    id: int
    name: str
    dice_notation: str | None
    average_damage: float
    is_bonus_action: bool
    notes: str | None
    sort_order: int


class CharacterTurnSummary(BaseModel):
    id: int
    name: str
    turn_type: str
    is_primary: bool
    notes: str | None
    sort_order: int
    line_items: list[TurnLineItemSummary]
    turn_total: float   # sum of line_item.average_damage


# ── Party summary dataclass ───────────────────────────────────────────────────

@dataclass
class PartySummary:
    campaign_id: str
    rule_system_slug: str
    characters: list[CharacterCombatProfile]
    party_size: int
    avg_level: float
    avg_hp: float
    total_hp: int
    lowest_hp: int
    avg_ac: float
    party_nova: float
    party_sustained: float
    has_complete_data: bool
    incomplete_characters: list[str] = field(default_factory=list)


# ── Helpers ───────────────────────────────────────────────────────────────────

def _has_complete_data(character_id: str, db: DBSession) -> bool:
    """A character has complete data when they have a primary nova turn
    AND a primary sustained turn."""
    primary_turns = (
        db.query(CharacterCombatTurn)
        .filter(
            CharacterCombatTurn.character_id == character_id,
            CharacterCombatTurn.is_primary.is_(True),
        )
        .all()
    )
    types_with_primary = {t.turn_type for t in primary_turns}
    return "nova" in types_with_primary and "sustained" in types_with_primary


def _sum_primary_turn(
    turns: list[CharacterCombatTurn],
    turn_type: str,
) -> float:
    """Return the sum of average_damage for the primary turn of the given type."""
    for turn in turns:
        if turn.turn_type == turn_type and turn.is_primary:
            return sum(item.average_damage for item in turn.line_items)
    return 0.0


# ── Public functions ──────────────────────────────────────────────────────────

def get_character_turns(
    character_id: str,
    db: DBSession,
) -> list[CharacterTurnSummary]:
    """Return all combat turns for a character, ordered by sort_order."""
    turns = (
        db.query(CharacterCombatTurn)
        .options(selectinload(CharacterCombatTurn.line_items))
        .filter(CharacterCombatTurn.character_id == character_id)
        .order_by(CharacterCombatTurn.sort_order, CharacterCombatTurn.id)
        .all()
    )
    result: list[CharacterTurnSummary] = []
    for turn in turns:
        items = sorted(turn.line_items, key=lambda li: (li.sort_order, li.id))
        result.append(CharacterTurnSummary(
            id=turn.id,
            name=turn.name,
            turn_type=turn.turn_type,
            is_primary=turn.is_primary,
            notes=turn.notes,
            sort_order=turn.sort_order,
            line_items=[
                TurnLineItemSummary(
                    id=li.id,
                    name=li.name,
                    dice_notation=li.dice_notation,
                    average_damage=li.average_damage,
                    is_bonus_action=li.is_bonus_action,
                    notes=li.notes,
                    sort_order=li.sort_order,
                )
                for li in items
            ],
            turn_total=sum(li.average_damage for li in items),
        ))
    return result


def load_character_combat_profile(
    character_id: str,
    db: DBSession,
) -> CharacterCombatProfile:
    """Load and assemble a CharacterCombatProfile for a single character."""
    character = db.query(Character).filter(Character.id == character_id).first()
    if character is None:
        raise ValueError(f"Character not found: {character_id!r}")

    rs_orm = get_campaign_rule_system(character.campaign_id, db)
    rule_system = get_rule_system(rs_orm.slug)

    # Load ability scores and skill proficiencies
    stat_records = (
        db.query(CharacterStatORM)
        .options(selectinload(CharacterStatORM.stat_definition))
        .filter(CharacterStatORM.character_id == character_id)
        .all()
    )
    stat_values: dict[str, int] = {
        r.stat_definition.slug: r.value for r in stat_records
    }

    skill_records = (
        db.query(CharacterSkillORM)
        .options(selectinload(CharacterSkillORM.skill_definition))
        .filter(CharacterSkillORM.character_id == character_id)
        .all()
    )
    skill_proficiencies: dict[str, str] = {
        r.skill_definition.slug: r.proficiency_type for r in skill_records
    }

    # Load combat turns with line items
    turns = (
        db.query(CharacterCombatTurn)
        .options(selectinload(CharacterCombatTurn.line_items))
        .filter(CharacterCombatTurn.character_id == character_id)
        .all()
    )

    nova_damage      = _sum_primary_turn(turns, "nova")
    sustained_damage = _sum_primary_turn(turns, "sustained")

    return rule_system.build_character_combat_profile(
        character_id=character.id,
        character_name=character.name,
        level=character.level,
        max_hp=character.max_hp,
        armor_class=character.ac,
        stat_values=stat_values,
        skill_proficiencies=skill_proficiencies,
        nova_damage=nova_damage,
        sustained_damage=sustained_damage,
    )


def load_campaign_combat_profiles(
    campaign_id: str,
    db: DBSession,
) -> list[CharacterCombatProfile]:
    """Load combat profiles for all characters in a campaign, ordered by name."""
    characters = (
        db.query(Character)
        .filter(Character.campaign_id == campaign_id)
        .order_by(Character.name)
        .all()
    )
    return [load_character_combat_profile(c.id, db) for c in characters]


def get_campaign_party_summary(
    campaign_id: str,
    db: DBSession,
) -> PartySummary:
    """Compute a full PartySummary for a campaign's characters."""
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign is None:
        raise ValueError(f"Campaign not found: {campaign_id!r}")

    rs_orm = get_campaign_rule_system(campaign_id, db)
    rs_slug = rs_orm.slug

    characters = (
        db.query(Character)
        .filter(Character.campaign_id == campaign_id)
        .order_by(Character.name)
        .all()
    )

    if not characters:
        return PartySummary(
            campaign_id=campaign_id,
            rule_system_slug=rs_slug,
            characters=[],
            party_size=0,
            avg_level=0.0,
            avg_hp=0.0,
            total_hp=0,
            lowest_hp=0,
            avg_ac=0.0,
            party_nova=0.0,
            party_sustained=0.0,
            has_complete_data=False,
            incomplete_characters=[],
        )

    profiles: list[CharacterCombatProfile] = []
    incomplete: list[str] = []

    for char in characters:
        profile = load_character_combat_profile(char.id, db)
        profiles.append(profile)
        if not _has_complete_data(char.id, db):
            incomplete.append(char.name)

    n = len(profiles)
    total_hp  = sum(p.max_hp for p in profiles)
    total_ac  = sum(p.armor_class for p in profiles)
    total_lvl = sum(p.level for p in profiles)
    lowest_hp = min(p.max_hp for p in profiles)

    return PartySummary(
        campaign_id=campaign_id,
        rule_system_slug=rs_slug,
        characters=profiles,
        party_size=n,
        avg_level=total_lvl / n,
        avg_hp=total_hp / n,
        total_hp=total_hp,
        lowest_hp=lowest_hp,
        avg_ac=total_ac / n,
        party_nova=sum(p.nova_damage for p in profiles),
        party_sustained=sum(p.sustained_damage_per_round for p in profiles),
        has_complete_data=len(incomplete) == 0,
        incomplete_characters=incomplete,
    )
