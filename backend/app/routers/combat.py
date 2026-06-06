"""Character combat stats, skills, turn, and line-item endpoints.

Registered at: /characters/{character_id}/combat/...
"""
from __future__ import annotations

import math
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession, selectinload

from ..auth import get_current_user
from ..database import get_db
from ..models import (
    Character,
    CharacterCombatTurn,
    CharacterCombatTurnLineItem,
    CharacterSkill as CharacterSkillORM,
    CharacterStat as CharacterStatORM,
    SkillDefinition,
    StatDefinition,
    User,
)
from ..monster_factory.services.character_combat_service import (
    CharacterTurnSummary,
    TurnLineItemSummary,
    get_character_turns,
    load_character_combat_profile,
)
from ..rule_system_helpers import get_campaign_rule_system
from ..rule_systems.loader import get_rule_system

router = APIRouter()

# ── Schemas ───────────────────────────────────────────────────────────────────

class StatDefinitionBrief(BaseModel):
    id: int; slug: str; name: str; abbreviation: str; stat_type: str
    model_config = {"from_attributes": True}

class StatOut(BaseModel):
    stat_definition: StatDefinitionBrief
    value: int
    computed_modifier: int

class StatItemIn(BaseModel):
    stat_definition_id: int
    value: int
    override_modifier: Optional[int] = None

class SkillDefinitionBrief(BaseModel):
    id: int; slug: str; name: str; governing_stat_id: Optional[int]
    model_config = {"from_attributes": True}

class SkillOut(BaseModel):
    skill_definition: SkillDefinitionBrief
    proficiency_type: str
    additional_bonus: int
    computed_bonus: int

class SkillItemIn(BaseModel):
    skill_definition_id: int
    proficiency_type: str = "none"
    additional_bonus: int = 0

class CharacterCombatProfileOut(BaseModel):
    character_id: str
    character_name: str
    rule_system_slug: str
    max_hp: int
    armor_class: int
    stats: dict[str, int]
    modifiers: dict[str, int]
    skills: dict[str, str]
    nova_damage: float
    sustained_damage_per_round: float
    proficiency_bonus: int
    level: int

# ── Helpers ───────────────────────────────────────────────────────────────────

def _get_character_or_404(character_id: str, db: DBSession) -> Character:
    ch = db.query(Character).filter(Character.id == character_id).first()
    if not ch:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Character not found")
    return ch

def _compute_stat_modifier(
    slug: str, value: int, override: int | None, rule_system
) -> int:
    if override is not None:
        return override
    return rule_system.compute_modifier(slug, value)

def _compute_skill_bonus(
    proficiency_type: str,
    additional_bonus: int,
    governing_stat_id: int | None,
    stat_map: dict[int, CharacterStatORM],
    proficiency_bonus: int,
    rule_system,
) -> int:
    governing_mod = 0
    if governing_stat_id is not None and governing_stat_id in stat_map:
        rec = stat_map[governing_stat_id]
        governing_mod = _compute_stat_modifier(
            rec.stat_definition.slug, rec.value, rec.override_modifier, rule_system
        )
    prof_contribution = {
        "none":      0,
        "half":      math.floor(proficiency_bonus / 2),
        "full":      proficiency_bonus,
        "expertise": proficiency_bonus * 2,
    }.get(proficiency_type, 0)
    return governing_mod + prof_contribution + additional_bonus

# ── Combat Profile (read) ─────────────────────────────────────────────────────

@router.get("/profile", response_model=CharacterCombatProfileOut)
def get_combat_profile(
    character_id: str,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CharacterCombatProfileOut:
    _get_character_or_404(character_id, db)
    profile = load_character_combat_profile(character_id, db)
    return CharacterCombatProfileOut(
        character_id=profile.character_id,
        character_name=profile.character_name,
        rule_system_slug=profile.rule_system_slug,
        max_hp=profile.max_hp,
        armor_class=profile.armor_class,
        stats=profile.stats,
        modifiers=profile.modifiers,
        skills={k: v.value for k, v in profile.skills.items()},
        nova_damage=profile.nova_damage,
        sustained_damage_per_round=profile.sustained_damage_per_round,
        proficiency_bonus=profile.proficiency_bonus,
        level=profile.level,
    )

# ── Stats ─────────────────────────────────────────────────────────────────────

@router.get("/stats", response_model=list[StatOut])
def get_stats(
    character_id: str,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[StatOut]:
    ch = _get_character_or_404(character_id, db)
    rs_orm = get_campaign_rule_system(ch.campaign_id, db)
    rule_system = get_rule_system(rs_orm.slug)
    records = (
        db.query(CharacterStatORM)
        .options(selectinload(CharacterStatORM.stat_definition))
        .filter(CharacterStatORM.character_id == character_id)
        .all()
    )
    return [
        StatOut(
            stat_definition=StatDefinitionBrief.model_validate(r.stat_definition),
            value=r.value,
            computed_modifier=_compute_stat_modifier(
                r.stat_definition.slug, r.value, r.override_modifier, rule_system
            ),
        )
        for r in records
    ]


@router.put("/stats", response_model=list[StatOut])
def upsert_stats(
    character_id: str,
    body: list[StatItemIn],
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[StatOut]:
    ch = _get_character_or_404(character_id, db)
    rs_orm = get_campaign_rule_system(ch.campaign_id, db)
    rule_system = get_rule_system(rs_orm.slug)

    for item in body:
        stat_def = db.query(StatDefinition).filter(StatDefinition.id == item.stat_definition_id).first()
        if not stat_def:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Stat definition {item.stat_definition_id} not found")
        if stat_def.rule_system_id != rs_orm.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Stat definition {item.stat_definition_id!r} does not belong to "
                f"the campaign's rule system ({rs_orm.slug!r})",
            )
        existing = db.query(CharacterStatORM).filter(
            CharacterStatORM.character_id == character_id,
            CharacterStatORM.stat_definition_id == item.stat_definition_id,
        ).first()
        if existing:
            existing.value = item.value
            existing.override_modifier = item.override_modifier
        else:
            db.add(CharacterStatORM(
                character_id=character_id,
                stat_definition_id=item.stat_definition_id,
                value=item.value,
                override_modifier=item.override_modifier,
            ))

    db.commit()
    return get_stats(character_id, db=db, _=_)

# ── Skills ────────────────────────────────────────────────────────────────────

@router.get("/skills", response_model=list[SkillOut])
def get_skills(
    character_id: str,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SkillOut]:
    ch = _get_character_or_404(character_id, db)
    rs_orm = get_campaign_rule_system(ch.campaign_id, db)
    rule_system = get_rule_system(rs_orm.slug)
    prof_bonus = rule_system.compute_proficiency_bonus(ch.level)

    stat_records = (
        db.query(CharacterStatORM)
        .options(selectinload(CharacterStatORM.stat_definition))
        .filter(CharacterStatORM.character_id == character_id)
        .all()
    )
    stat_map: dict[int, CharacterStatORM] = {r.stat_definition_id: r for r in stat_records}

    skill_records = (
        db.query(CharacterSkillORM)
        .options(selectinload(CharacterSkillORM.skill_definition))
        .filter(CharacterSkillORM.character_id == character_id)
        .all()
    )
    return [
        SkillOut(
            skill_definition=SkillDefinitionBrief.model_validate(r.skill_definition),
            proficiency_type=r.proficiency_type,
            additional_bonus=r.additional_bonus,
            computed_bonus=_compute_skill_bonus(
                r.proficiency_type, r.additional_bonus,
                r.skill_definition.governing_stat_id, stat_map,
                prof_bonus, rule_system,
            ),
        )
        for r in skill_records
    ]


@router.put("/skills", response_model=list[SkillOut])
def upsert_skills(
    character_id: str,
    body: list[SkillItemIn],
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[SkillOut]:
    ch = _get_character_or_404(character_id, db)
    rs_orm = get_campaign_rule_system(ch.campaign_id, db)

    for item in body:
        skill_def = db.query(SkillDefinition).filter(SkillDefinition.id == item.skill_definition_id).first()
        if not skill_def:
            raise HTTPException(status.HTTP_404_NOT_FOUND, f"Skill definition {item.skill_definition_id} not found")
        if skill_def.rule_system_id != rs_orm.id:
            raise HTTPException(
                status.HTTP_400_BAD_REQUEST,
                f"Skill definition {item.skill_definition_id!r} does not belong to "
                f"the campaign's rule system ({rs_orm.slug!r})",
            )
        existing = db.query(CharacterSkillORM).filter(
            CharacterSkillORM.character_id == character_id,
            CharacterSkillORM.skill_definition_id == item.skill_definition_id,
        ).first()
        if existing:
            existing.proficiency_type = item.proficiency_type
            existing.additional_bonus = item.additional_bonus
        else:
            db.add(CharacterSkillORM(
                character_id=character_id,
                skill_definition_id=item.skill_definition_id,
                proficiency_type=item.proficiency_type,
                additional_bonus=item.additional_bonus,
            ))

    db.commit()
    return get_skills(character_id, db=db, _=_)


# ── Turn / Line-item schemas ───────────────────────────────────────────────────

class TurnIn(BaseModel):
    name: str
    turn_type: str          # nova | sustained | variant
    is_primary: bool = False
    notes: Optional[str] = None
    sort_order: int = 0

class LineItemIn(BaseModel):
    name: str
    dice_notation: Optional[str] = None
    average_damage: float
    is_bonus_action: bool = False
    notes: Optional[str] = None
    sort_order: int = 0

class ReorderItem(BaseModel):
    id: int
    sort_order: int

# ── Turn helpers ──────────────────────────────────────────────────────────────

def _get_turn_or_404(turn_id: int, character_id: str, db: DBSession) -> CharacterCombatTurn:
    """Fetch a turn and verify it belongs to the given character."""
    turn = db.query(CharacterCombatTurn).filter(
        CharacterCombatTurn.id == turn_id,
        CharacterCombatTurn.character_id == character_id,
    ).first()
    if not turn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Turn not found")
    return turn


def _enforce_primary(character_id: str, turn_type: str, exclude_id: int, db: DBSession) -> None:
    """Unset is_primary on all other turns of the same type for this character."""
    db.query(CharacterCombatTurn).filter(
        CharacterCombatTurn.character_id == character_id,
        CharacterCombatTurn.turn_type == turn_type,
        CharacterCombatTurn.id != exclude_id,
    ).update({"is_primary": False}, synchronize_session=False)


def _turn_to_summary(turn: CharacterCombatTurn) -> CharacterTurnSummary:
    items = sorted(turn.line_items, key=lambda li: (li.sort_order, li.id))
    return CharacterTurnSummary(
        id=turn.id,
        name=turn.name,
        turn_type=turn.turn_type,
        is_primary=turn.is_primary,
        notes=turn.notes,
        sort_order=turn.sort_order,
        line_items=[
            TurnLineItemSummary(
                id=li.id, name=li.name, dice_notation=li.dice_notation,
                average_damage=li.average_damage, is_bonus_action=li.is_bonus_action,
                notes=li.notes, sort_order=li.sort_order,
            )
            for li in items
        ],
        turn_total=sum(li.average_damage for li in items),
    )


def _reload_turn(turn_id: int, db: DBSession) -> CharacterTurnSummary:
    turn = (
        db.query(CharacterCombatTurn)
        .options(selectinload(CharacterCombatTurn.line_items))
        .filter(CharacterCombatTurn.id == turn_id)
        .first()
    )
    if not turn:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Turn not found after reload")
    return _turn_to_summary(turn)

# ── Turns: reorder (must come before /{turn_id} to avoid routing collision) ───

@router.put("/turns/reorder")
def reorder_turns(
    character_id: str,
    body: list[ReorderItem],
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    _get_character_or_404(character_id, db)
    updated = 0
    for item in body:
        rows = db.query(CharacterCombatTurn).filter(
            CharacterCombatTurn.id == item.id,
            CharacterCombatTurn.character_id == character_id,
        ).update({"sort_order": item.sort_order}, synchronize_session=False)
        updated += rows
    db.commit()
    return {"updated": updated}

# ── Turns CRUD ────────────────────────────────────────────────────────────────

@router.get("/turns", response_model=list[CharacterTurnSummary])
def get_turns(
    character_id: str,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[CharacterTurnSummary]:
    _get_character_or_404(character_id, db)
    return get_character_turns(character_id, db)


@router.post("/turns", response_model=CharacterTurnSummary, status_code=status.HTTP_201_CREATED)
def create_turn(
    character_id: str,
    body: TurnIn,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CharacterTurnSummary:
    _get_character_or_404(character_id, db)
    turn = CharacterCombatTurn(
        character_id=character_id,
        name=body.name,
        turn_type=body.turn_type,
        is_primary=body.is_primary,
        notes=body.notes,
        sort_order=body.sort_order,
    )
    db.add(turn)
    db.flush()
    if body.is_primary:
        _enforce_primary(character_id, body.turn_type, turn.id, db)
    db.commit()
    return _reload_turn(turn.id, db)


@router.put("/turns/{turn_id}", response_model=CharacterTurnSummary)
def update_turn(
    character_id: str,
    turn_id: int,
    body: TurnIn,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> CharacterTurnSummary:
    turn = _get_turn_or_404(turn_id, character_id, db)
    turn.name       = body.name
    turn.turn_type  = body.turn_type
    turn.is_primary = body.is_primary
    turn.notes      = body.notes
    turn.sort_order = body.sort_order
    if body.is_primary:
        _enforce_primary(character_id, body.turn_type, turn.id, db)
    db.commit()
    return _reload_turn(turn.id, db)


@router.delete("/turns/{turn_id}")
def delete_turn(
    character_id: str,
    turn_id: int,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    turn = _get_turn_or_404(turn_id, character_id, db)
    db.delete(turn)
    db.commit()
    return {"deleted": True, "id": turn_id}

# ── Line items: reorder (must come before /{item_id}) ────────────────────────

@router.put("/turns/{turn_id}/items/reorder")
def reorder_line_items(
    character_id: str,
    turn_id: int,
    body: list[ReorderItem],
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    _get_turn_or_404(turn_id, character_id, db)
    updated = 0
    for item in body:
        rows = db.query(CharacterCombatTurnLineItem).filter(
            CharacterCombatTurnLineItem.id == item.id,
            CharacterCombatTurnLineItem.turn_id == turn_id,
        ).update({"sort_order": item.sort_order}, synchronize_session=False)
        updated += rows
    db.commit()
    return {"updated": updated}

# ── Line items CRUD ───────────────────────────────────────────────────────────

@router.get("/turns/{turn_id}/items", response_model=list[TurnLineItemSummary])
def get_line_items(
    character_id: str,
    turn_id: int,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> list[TurnLineItemSummary]:
    _get_turn_or_404(turn_id, character_id, db)
    items = (
        db.query(CharacterCombatTurnLineItem)
        .filter(CharacterCombatTurnLineItem.turn_id == turn_id)
        .order_by(CharacterCombatTurnLineItem.sort_order, CharacterCombatTurnLineItem.id)
        .all()
    )
    return [
        TurnLineItemSummary(
            id=li.id, name=li.name, dice_notation=li.dice_notation,
            average_damage=li.average_damage, is_bonus_action=li.is_bonus_action,
            notes=li.notes, sort_order=li.sort_order,
        )
        for li in items
    ]


@router.post("/turns/{turn_id}/items", response_model=TurnLineItemSummary,
             status_code=status.HTTP_201_CREATED)
def create_line_item(
    character_id: str,
    turn_id: int,
    body: LineItemIn,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TurnLineItemSummary:
    _get_turn_or_404(turn_id, character_id, db)
    li = CharacterCombatTurnLineItem(
        turn_id=turn_id,
        name=body.name,
        dice_notation=body.dice_notation,
        average_damage=body.average_damage,
        is_bonus_action=body.is_bonus_action,
        notes=body.notes,
        sort_order=body.sort_order,
    )
    db.add(li)
    db.commit()
    db.refresh(li)
    return TurnLineItemSummary(
        id=li.id, name=li.name, dice_notation=li.dice_notation,
        average_damage=li.average_damage, is_bonus_action=li.is_bonus_action,
        notes=li.notes, sort_order=li.sort_order,
    )


@router.put("/turns/{turn_id}/items/{item_id}", response_model=TurnLineItemSummary)
def update_line_item(
    character_id: str,
    turn_id: int,
    item_id: int,
    body: LineItemIn,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> TurnLineItemSummary:
    _get_turn_or_404(turn_id, character_id, db)
    li = db.query(CharacterCombatTurnLineItem).filter(
        CharacterCombatTurnLineItem.id == item_id,
        CharacterCombatTurnLineItem.turn_id == turn_id,
    ).first()
    if not li:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Line item not found")
    li.name           = body.name
    li.dice_notation  = body.dice_notation
    li.average_damage = body.average_damage
    li.is_bonus_action = body.is_bonus_action
    li.notes          = body.notes
    li.sort_order     = body.sort_order
    db.commit()
    db.refresh(li)
    return TurnLineItemSummary(
        id=li.id, name=li.name, dice_notation=li.dice_notation,
        average_damage=li.average_damage, is_bonus_action=li.is_bonus_action,
        notes=li.notes, sort_order=li.sort_order,
    )


@router.delete("/turns/{turn_id}/items/{item_id}")
def delete_line_item(
    character_id: str,
    turn_id: int,
    item_id: int,
    db: DBSession = Depends(get_db),
    _: User = Depends(get_current_user),
) -> dict:
    _get_turn_or_404(turn_id, character_id, db)
    li = db.query(CharacterCombatTurnLineItem).filter(
        CharacterCombatTurnLineItem.id == item_id,
        CharacterCombatTurnLineItem.turn_id == turn_id,
    ).first()
    if not li:
        raise HTTPException(status.HTTP_404_NOT_FOUND, "Line item not found")
    db.delete(li)
    db.commit()
    return {"deleted": True, "id": item_id}
