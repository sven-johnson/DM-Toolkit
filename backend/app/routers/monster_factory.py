import uuid

from fastapi import APIRouter, Depends, HTTPException, Query, Response
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field
from sqlalchemy.orm import Session, selectinload

from ..database import get_db
from ..models import (
    AbilityFlavor,
    ActionEconomySettings,
    CombatDurationSettings,
    CombatRoleArchetype,
    CreatureArchetype,
    EncounterTemplate,
    EncounterTemplateSlot,
    GMProfile,
    HitRateSettings,
    LethalitySettings,
    MinionSettings,
    MonsterStatBlock,
    SavingThrowSettings,
    SavedEncounter,
    SavedEncounterMonster,
    WarningSettings,
)
from ..monster_factory_schemas import (
    AbilityFlavorCreate,
    AbilityFlavorOut,
    CombatRoleArchetypeOut,
    CreatureArchetypeOut,
    EncounterTemplateOut,
    EncounterTemplateSlotOut,
    GMProfileCreate,
    GMProfileOut,
    GMProfileUpdate,
    MonsterStatBlockOut,
    PagedEncountersOut,
    PagedTemplatesOut,
    PresetOut,
    ProfileFromPresetIn,
    SavedEncounterMonsterOut,
    SavedEncounterOut,
    SavedEncounterSummaryOut,
)
from ..monster_factory.calculators.encounter_orchestrator import (
    EncounterCompositionSlot,
    GenerateEncounterInput,
    GeneratedEncounter,
    GeneratedMonster,
    generate_encounter,
    rebalance_encounter,
)
from ..monster_factory.calculators.party_profile import PartyMember
from ..monster_factory.export.dndbeyond import DnDBeyondExport, generate_dndbeyond_export


# ── Request schemas for new endpoints ─────────────────────────────────────────

class ExportDnDBeyondIn(BaseModel):
    monster: GeneratedMonster


class RebalanceChangesIn(BaseModel):
    composition: list[EncounterCompositionSlot] | None = None
    party_members: list[PartyMember] | None = None
    party_level: int | None = Field(None, ge=1, le=20)
    difficulty: str | None = None


class RebalanceEncounterIn(BaseModel):
    existing_encounter: GeneratedEncounter
    changes: RebalanceChangesIn
    gm_profile_id: str


class SaveEncounterIn(BaseModel):
    encounter: GeneratedEncounter
    name: str
    gm_profile_id: str | None = None


class SaveMonsterTemplateIn(BaseModel):
    monster: GeneratedMonster
    name: str
    party_avg_level: int = Field(5, ge=1, le=20)

router = APIRouter()

# ── Preset definitions ────────────────────────────────────────────────────────

_PRESETS: dict[str, dict] = {
    "New Players": {
        "description": "Forgiving settings for new players. Longer fights, reduced lethality, higher player hit rates.",
        "lethality": {
            "threat_turns_trivial": 8.0, "threat_turns_easy": 6.0,
            "threat_turns_medium": 5.0, "threat_turns_hard": 3.5, "threat_turns_deadly": 2.5,
            "damage_smoothing": 0.80, "hp_smoothing": 1.20,
            "one_shot_prevention_threshold": 0.75, "boss_nova_multiplier": 1.2,
            "allow_player_death": False,
        },
        "combat_duration": {
            "target_rounds_trivial": 2.0, "target_rounds_easy": 3.0,
            "target_rounds_medium": 4.0, "target_rounds_hard": 6.0, "target_rounds_deadly": 8.0,
            "round_variance_tolerance": 1.5,
        },
        "action_economy": {
            "multiplier_trivial": 0.5, "multiplier_easy": 0.7, "multiplier_medium": 0.9,
            "multiplier_hard": 1.1, "multiplier_deadly": 1.3,
            "bonus_action_estimate": 0.5, "legendary_action_override": None, "lair_actions_enabled": True,
        },
        "hit_rate": {
            "monster_hit_rate_trivial": 0.35, "monster_hit_rate_easy": 0.45,
            "monster_hit_rate_medium": 0.50, "monster_hit_rate_hard": 0.55, "monster_hit_rate_deadly": 0.60,
            "player_hit_rate_trivial": 0.80, "player_hit_rate_easy": 0.70,
            "player_hit_rate_medium": 0.65, "player_hit_rate_hard": 0.55, "player_hit_rate_deadly": 0.50,
        },
        "saving_throw": {"save_dc_base": 8, "save_dc_proficiency_scaling": True, "save_dc_difficulty_bonus": 0},
        "minion": {"minion_one_hit_kill": False, "minion_hp_fraction": 0.30, "minion_damage_fraction": 0.35},
        "warnings": {
            "warn_nova_threshold": True, "warn_one_shot_risk": True,
            "warn_action_economy_imbalance": True, "warn_round_duration_deviation": True, "show_math": False,
        },
    },
    "Balanced": {
        "description": "The default settings from the algorithm spec. Suitable for most groups.",
        "lethality": {
            "threat_turns_trivial": 6.0, "threat_turns_easy": 5.0,
            "threat_turns_medium": 3.5, "threat_turns_hard": 2.25, "threat_turns_deadly": 1.5,
            "damage_smoothing": 0.85, "hp_smoothing": 1.10,
            "one_shot_prevention_threshold": 0.60, "boss_nova_multiplier": 1.5,
            "allow_player_death": False,
        },
        "combat_duration": {
            "target_rounds_trivial": 1.5, "target_rounds_easy": 2.5,
            "target_rounds_medium": 3.5, "target_rounds_hard": 5.0, "target_rounds_deadly": 6.0,
            "round_variance_tolerance": 1.0,
        },
        "action_economy": {
            "multiplier_trivial": 0.6, "multiplier_easy": 0.8, "multiplier_medium": 1.0,
            "multiplier_hard": 1.2, "multiplier_deadly": 1.4,
            "bonus_action_estimate": 0.5, "legendary_action_override": None, "lair_actions_enabled": True,
        },
        "hit_rate": {
            "monster_hit_rate_trivial": 0.40, "monster_hit_rate_easy": 0.50,
            "monster_hit_rate_medium": 0.60, "monster_hit_rate_hard": 0.65, "monster_hit_rate_deadly": 0.70,
            "player_hit_rate_trivial": 0.75, "player_hit_rate_easy": 0.65,
            "player_hit_rate_medium": 0.55, "player_hit_rate_hard": 0.50, "player_hit_rate_deadly": 0.45,
        },
        "saving_throw": {"save_dc_base": 8, "save_dc_proficiency_scaling": True, "save_dc_difficulty_bonus": 1},
        "minion": {"minion_one_hit_kill": False, "minion_hp_fraction": 0.25, "minion_damage_fraction": 0.40},
        "warnings": {
            "warn_nova_threshold": True, "warn_one_shot_risk": True,
            "warn_action_economy_imbalance": True, "warn_round_duration_deviation": True, "show_math": False,
        },
    },
    "Heroic": {
        "description": "Swift, decisive combat where players feel powerful. Shorter fights, strong player agency.",
        "lethality": {
            "threat_turns_trivial": 5.0, "threat_turns_easy": 4.0,
            "threat_turns_medium": 3.0, "threat_turns_hard": 2.0, "threat_turns_deadly": 1.25,
            "damage_smoothing": 0.90, "hp_smoothing": 1.0,
            "one_shot_prevention_threshold": 0.65, "boss_nova_multiplier": 1.5,
            "allow_player_death": False,
        },
        "combat_duration": {
            "target_rounds_trivial": 1.0, "target_rounds_easy": 2.0,
            "target_rounds_medium": 3.0, "target_rounds_hard": 4.0, "target_rounds_deadly": 5.0,
            "round_variance_tolerance": 0.75,
        },
        "action_economy": {
            "multiplier_trivial": 0.6, "multiplier_easy": 0.8, "multiplier_medium": 1.0,
            "multiplier_hard": 1.2, "multiplier_deadly": 1.4,
            "bonus_action_estimate": 0.5, "legendary_action_override": None, "lair_actions_enabled": True,
        },
        "hit_rate": {
            "monster_hit_rate_trivial": 0.40, "monster_hit_rate_easy": 0.50,
            "monster_hit_rate_medium": 0.60, "monster_hit_rate_hard": 0.65, "monster_hit_rate_deadly": 0.70,
            "player_hit_rate_trivial": 0.80, "player_hit_rate_easy": 0.70,
            "player_hit_rate_medium": 0.60, "player_hit_rate_hard": 0.55, "player_hit_rate_deadly": 0.50,
        },
        "saving_throw": {"save_dc_base": 8, "save_dc_proficiency_scaling": True, "save_dc_difficulty_bonus": 1},
        "minion": {"minion_one_hit_kill": True, "minion_hp_fraction": 0.20, "minion_damage_fraction": 0.40},
        "warnings": {
            "warn_nova_threshold": True, "warn_one_shot_risk": True,
            "warn_action_economy_imbalance": True, "warn_round_duration_deviation": True, "show_math": False,
        },
    },
    "Optimizer Table": {
        "description": "Calibrated for experienced min-maxers. Higher monster effectiveness; show-math enabled.",
        "lethality": {
            "threat_turns_trivial": 4.0, "threat_turns_easy": 3.5,
            "threat_turns_medium": 2.5, "threat_turns_hard": 1.75, "threat_turns_deadly": 1.25,
            "damage_smoothing": 0.85, "hp_smoothing": 1.05,
            "one_shot_prevention_threshold": 0.55, "boss_nova_multiplier": 1.75,
            "allow_player_death": True,
        },
        "combat_duration": {
            "target_rounds_trivial": 1.5, "target_rounds_easy": 2.5,
            "target_rounds_medium": 3.5, "target_rounds_hard": 5.0, "target_rounds_deadly": 6.0,
            "round_variance_tolerance": 0.75,
        },
        "action_economy": {
            "multiplier_trivial": 0.6, "multiplier_easy": 0.9, "multiplier_medium": 1.1,
            "multiplier_hard": 1.3, "multiplier_deadly": 1.5,
            "bonus_action_estimate": 0.6, "legendary_action_override": None, "lair_actions_enabled": True,
        },
        "hit_rate": {
            "monster_hit_rate_trivial": 0.45, "monster_hit_rate_easy": 0.55,
            "monster_hit_rate_medium": 0.65, "monster_hit_rate_hard": 0.70, "monster_hit_rate_deadly": 0.75,
            "player_hit_rate_trivial": 0.70, "player_hit_rate_easy": 0.60,
            "player_hit_rate_medium": 0.50, "player_hit_rate_hard": 0.45, "player_hit_rate_deadly": 0.40,
        },
        "saving_throw": {"save_dc_base": 8, "save_dc_proficiency_scaling": True, "save_dc_difficulty_bonus": 2},
        "minion": {"minion_one_hit_kill": False, "minion_hp_fraction": 0.20, "minion_damage_fraction": 0.45},
        "warnings": {
            "warn_nova_threshold": True, "warn_one_shot_risk": True,
            "warn_action_economy_imbalance": True, "warn_round_duration_deviation": True, "show_math": True,
        },
    },
    "Meat Grinder": {
        "description": "Brutal and unforgiving. Short, lethal fights where every decision matters.",
        "lethality": {
            "threat_turns_trivial": 4.0, "threat_turns_easy": 3.0,
            "threat_turns_medium": 2.0, "threat_turns_hard": 1.5, "threat_turns_deadly": 1.0,
            "damage_smoothing": 1.0, "hp_smoothing": 0.90,
            "one_shot_prevention_threshold": 0.40, "boss_nova_multiplier": 2.0,
            "allow_player_death": True,
        },
        "combat_duration": {
            "target_rounds_trivial": 1.0, "target_rounds_easy": 1.5,
            "target_rounds_medium": 2.5, "target_rounds_hard": 4.0, "target_rounds_deadly": 5.0,
            "round_variance_tolerance": 0.5,
        },
        "action_economy": {
            "multiplier_trivial": 0.7, "multiplier_easy": 0.9, "multiplier_medium": 1.1,
            "multiplier_hard": 1.4, "multiplier_deadly": 1.6,
            "bonus_action_estimate": 0.5, "legendary_action_override": None, "lair_actions_enabled": True,
        },
        "hit_rate": {
            "monster_hit_rate_trivial": 0.50, "monster_hit_rate_easy": 0.60,
            "monster_hit_rate_medium": 0.65, "monster_hit_rate_hard": 0.70, "monster_hit_rate_deadly": 0.75,
            "player_hit_rate_trivial": 0.65, "player_hit_rate_easy": 0.55,
            "player_hit_rate_medium": 0.50, "player_hit_rate_hard": 0.45, "player_hit_rate_deadly": 0.40,
        },
        "saving_throw": {"save_dc_base": 10, "save_dc_proficiency_scaling": True, "save_dc_difficulty_bonus": 2},
        "minion": {"minion_one_hit_kill": True, "minion_hp_fraction": 0.15, "minion_damage_fraction": 0.50},
        "warnings": {
            "warn_nova_threshold": True, "warn_one_shot_risk": True,
            "warn_action_economy_imbalance": True, "warn_round_duration_deviation": True, "show_math": False,
        },
    },
}

# ── Helpers ───────────────────────────────────────────────────────────────────

_PROFILE_LOAD_OPTIONS = [
    selectinload(GMProfile.lethality),
    selectinload(GMProfile.combat_duration),
    selectinload(GMProfile.action_economy),
    selectinload(GMProfile.hit_rate),
    selectinload(GMProfile.saving_throw),
    selectinload(GMProfile.minion),
    selectinload(GMProfile.warnings),
]


def _get_profile_or_404(db: Session, profile_id: str) -> GMProfile:
    profile = (
        db.query(GMProfile)
        .options(*_PROFILE_LOAD_OPTIONS)
        .filter(GMProfile.id == profile_id)
        .first()
    )
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return profile


def _attach_settings(db: Session, profile_id: str, body: GMProfileCreate | GMProfileUpdate) -> None:
    db.add(LethalitySettings(id=str(uuid.uuid4()), gm_profile_id=profile_id, **body.lethality.model_dump()))
    db.add(CombatDurationSettings(id=str(uuid.uuid4()), gm_profile_id=profile_id, **body.combat_duration.model_dump()))
    db.add(ActionEconomySettings(id=str(uuid.uuid4()), gm_profile_id=profile_id, **body.action_economy.model_dump()))
    db.add(HitRateSettings(id=str(uuid.uuid4()), gm_profile_id=profile_id, **body.hit_rate.model_dump()))
    db.add(SavingThrowSettings(id=str(uuid.uuid4()), gm_profile_id=profile_id, **body.saving_throw.model_dump()))
    db.add(MinionSettings(id=str(uuid.uuid4()), gm_profile_id=profile_id, **body.minion.model_dump()))
    db.add(WarningSettings(id=str(uuid.uuid4()), gm_profile_id=profile_id, **body.warnings.model_dump()))


def _update_settings(profile: GMProfile, body: GMProfileUpdate) -> None:
    for field, value in body.lethality.model_dump().items():
        setattr(profile.lethality, field, value)
    for field, value in body.combat_duration.model_dump().items():
        setattr(profile.combat_duration, field, value)
    for field, value in body.action_economy.model_dump().items():
        setattr(profile.action_economy, field, value)
    for field, value in body.hit_rate.model_dump().items():
        setattr(profile.hit_rate, field, value)
    for field, value in body.saving_throw.model_dump().items():
        setattr(profile.saving_throw, field, value)
    for field, value in body.minion.model_dump().items():
        setattr(profile.minion, field, value)
    for field, value in body.warnings.model_dump().items():
        setattr(profile.warnings, field, value)


# ── GM Profile endpoints ──────────────────────────────────────────────────────

@router.get("/profiles/presets", response_model=list[PresetOut])
def list_presets() -> list[PresetOut]:
    return [
        PresetOut(name=name, **data)
        for name, data in _PRESETS.items()
    ]


@router.post("/profiles/from-preset", response_model=GMProfileOut, status_code=201)
def create_from_preset(body: ProfileFromPresetIn, db: Session = Depends(get_db)) -> GMProfileOut:
    if body.preset_name not in _PRESETS:
        raise HTTPException(status_code=404, detail=f"Preset '{body.preset_name}' not found")

    preset = _PRESETS[body.preset_name]
    create_body = GMProfileCreate(
        name=body.profile_name,
        is_default=body.is_default,
        **{k: v for k, v in preset.items() if k != "description"},
    )
    return _do_create_profile(db, create_body)


@router.get("/profiles", response_model=list[GMProfileOut])
def list_profiles(db: Session = Depends(get_db)) -> list[GMProfileOut]:
    return (
        db.query(GMProfile)
        .options(*_PROFILE_LOAD_OPTIONS)
        .order_by(GMProfile.created_at)
        .all()
    )


@router.post("/profiles", response_model=GMProfileOut, status_code=201)
def create_profile(body: GMProfileCreate, db: Session = Depends(get_db)) -> GMProfileOut:
    return _do_create_profile(db, body)


@router.get("/profiles/{profile_id}", response_model=GMProfileOut)
def get_profile(profile_id: str, db: Session = Depends(get_db)) -> GMProfileOut:
    return _get_profile_or_404(db, profile_id)


@router.put("/profiles/{profile_id}", response_model=GMProfileOut)
def update_profile(profile_id: str, body: GMProfileUpdate, db: Session = Depends(get_db)) -> GMProfileOut:
    profile = _get_profile_or_404(db, profile_id)
    profile.name = body.name
    _update_settings(profile, body)
    db.commit()
    db.refresh(profile)
    return profile


@router.delete("/profiles/{profile_id}", status_code=204)
def delete_profile(profile_id: str, db: Session = Depends(get_db)) -> Response:
    profile = _get_profile_or_404(db, profile_id)

    if profile.is_default:
        raise HTTPException(status_code=400, detail="Cannot delete the default profile. Set another profile as default first.")

    total = db.query(GMProfile).count()
    if total <= 1:
        raise HTTPException(status_code=400, detail="Cannot delete the only profile.")

    db.delete(profile)
    db.commit()
    return Response(status_code=204)


@router.post("/profiles/{profile_id}/set-default", response_model=GMProfileOut)
def set_default_profile(profile_id: str, db: Session = Depends(get_db)) -> GMProfileOut:
    profile = _get_profile_or_404(db, profile_id)

    db.query(GMProfile).filter(GMProfile.is_default == True).update(  # noqa: E712
        {"is_default": False}, synchronize_session=False
    )
    profile.is_default = True
    db.commit()
    db.refresh(profile)
    return profile


def _do_create_profile(db: Session, body: GMProfileCreate) -> GMProfile:
    if body.is_default:
        db.query(GMProfile).filter(GMProfile.is_default == True).update(  # noqa: E712
            {"is_default": False}, synchronize_session=False
        )

    profile_id = str(uuid.uuid4())
    profile = GMProfile(id=profile_id, name=body.name, is_default=body.is_default)
    db.add(profile)
    _attach_settings(db, profile_id, body)
    db.commit()
    return _get_profile_or_404(db, profile_id)


# ── Archetype reference endpoints ─────────────────────────────────────────────

@router.get("/creature-archetypes", response_model=list[CreatureArchetypeOut])
def list_creature_archetypes(db: Session = Depends(get_db)) -> list[CreatureArchetypeOut]:
    return db.query(CreatureArchetype).order_by(CreatureArchetype.name).all()


@router.get("/combat-roles", response_model=list[CombatRoleArchetypeOut])
def list_combat_roles(db: Session = Depends(get_db)) -> list[CombatRoleArchetypeOut]:
    return db.query(CombatRoleArchetype).order_by(CombatRoleArchetype.name).all()


@router.get("/encounter-templates", response_model=list[EncounterTemplateOut])
def list_encounter_templates(db: Session = Depends(get_db)) -> list[EncounterTemplateOut]:
    return db.query(EncounterTemplate).order_by(EncounterTemplate.name).all()


@router.get("/encounter-templates/{template_id}/slots", response_model=list[EncounterTemplateSlotOut])
def list_template_slots(template_id: str, db: Session = Depends(get_db)) -> list[EncounterTemplateSlotOut]:
    template = db.query(EncounterTemplate).filter(EncounterTemplate.id == template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Encounter template not found")

    return (
        db.query(EncounterTemplateSlot)
        .options(selectinload(EncounterTemplateSlot.combat_role))
        .filter(EncounterTemplateSlot.encounter_template_id == template_id)
        .order_by(EncounterTemplateSlot.sort_order)
        .all()
    )


@router.get("/ability-flavors", response_model=list[AbilityFlavorOut])
def list_ability_flavors(db: Session = Depends(get_db)) -> list[AbilityFlavorOut]:
    return db.query(AbilityFlavor).order_by(AbilityFlavor.name).all()


# ── Custom ability flavor endpoints ───────────────────────────────────────────

@router.post("/ability-flavors", response_model=AbilityFlavorOut, status_code=201)
def create_ability_flavor(body: AbilityFlavorCreate, db: Session = Depends(get_db)) -> AbilityFlavorOut:
    flavor = AbilityFlavor(
        id=str(uuid.uuid4()),
        name=body.name,
        damage_type=body.damage_type,
        is_custom=True,
    )
    db.add(flavor)
    db.commit()
    db.refresh(flavor)
    return flavor


@router.delete("/ability-flavors/{flavor_id}", status_code=204)
def delete_ability_flavor(flavor_id: str, db: Session = Depends(get_db)) -> Response:
    flavor = db.query(AbilityFlavor).filter(AbilityFlavor.id == flavor_id).first()
    if not flavor:
        raise HTTPException(status_code=404, detail="Ability flavor not found")
    if not flavor.is_custom:
        raise HTTPException(status_code=403, detail="Cannot delete seeded ability flavors.")

    db.delete(flavor)
    db.commit()
    return Response(status_code=204)


# ── Encounter template detail (full with slots) ───────────────────────────────

@router.get("/encounter-templates/{template_id}", response_model=EncounterTemplateOut)
def get_encounter_template(template_id: str, db: Session = Depends(get_db)) -> EncounterTemplateOut:
    template = (
        db.query(EncounterTemplate)
        .options(selectinload(EncounterTemplate.slots).selectinload(EncounterTemplateSlot.combat_role))
        .filter(EncounterTemplate.id == template_id)
        .first()
    )
    if not template:
        raise HTTPException(status_code=404, detail="Encounter template not found")
    return template


# ── Calculation endpoints (no persistence) ───────────────────────────────────

@router.post("/generate", response_model=GeneratedEncounter)
def generate(body: GenerateEncounterInput, db: Session = Depends(get_db)):
    try:
        return generate_encounter(body, db)
    except ValueError as exc:
        return _mf_error(400, "INVALID_INPUT", str(exc))


@router.post("/rebalance", response_model=GeneratedEncounter)
def rebalance(body: RebalanceEncounterIn, db: Session = Depends(get_db)):
    try:
        return rebalance_encounter(
            existing=body.existing_encounter,
            new_composition=body.changes.composition,
            new_party_members=body.changes.party_members,
            new_party_level=body.changes.party_level,
            new_difficulty=body.changes.difficulty,
            gm_profile_id=body.gm_profile_id,
            db=db,
        )
    except ValueError as exc:
        return _mf_error(400, "INVALID_INPUT", str(exc))


# ── Persistence: Saved Encounters ─────────────────────────────────────────────

_ENCOUNTER_LOAD = [
    selectinload(SavedEncounter.encounter_monsters)
    .selectinload(SavedEncounterMonster.monster_stat_block)
]


@router.post("/encounters", response_model=SavedEncounterOut, status_code=201)
def save_encounter(body: SaveEncounterIn, db: Session = Depends(get_db)):
    enc = body.encounter

    # Bulk-load role and creature ORM records by name
    role_names    = list({m.combat_role_name for m in enc.monsters})
    creature_names = list({m.creature_archetype_name for m in enc.monsters})

    roles = {
        r.name: r
        for r in db.query(CombatRoleArchetype)
        .filter(CombatRoleArchetype.name.in_(role_names)).all()
    }
    creatures = {
        c.name: c
        for c in db.query(CreatureArchetype)
        .filter(CreatureArchetype.name.in_(creature_names)).all()
    }

    encounter_id = str(uuid.uuid4())
    saved_enc = SavedEncounter(
        id=encounter_id,
        name=body.name,
        gm_profile_id=body.gm_profile_id,
        difficulty=enc.difficulty,
        party_size=enc.party_profile.party_size,
        party_avg_level=enc.party_profile.avg_level,
        party_avg_hp=enc.party_profile.avg_hp,
        party_total_hp=enc.party_profile.total_hp,
        party_lowest_hp=enc.party_profile.lowest_hp,
        party_avg_ac=enc.party_profile.avg_ac,
        party_nova_damage=enc.party_profile.party_nova,
        party_sustained_damage=enc.party_profile.party_sustained,
        expected_rounds=enc.expected_rounds,
        expected_rounds_min=enc.expected_rounds_min,
        expected_rounds_max=enc.expected_rounds_max,
    )
    db.add(saved_enc)

    for sort_idx, monster in enumerate(enc.monsters):
        role = roles.get(monster.combat_role_name)
        if not role:
            db.rollback()
            return _mf_error(400, "ROLE_NOT_FOUND",
                             f"Combat role {monster.combat_role_name!r} not found in database")

        creature = creatures.get(monster.creature_archetype_name)
        stat_block = _build_stat_block(
            name=monster.creature_archetype_name,
            monster=monster,
            party_avg_level=enc.party_profile.avg_level,
            combat_role_id=role.id,
            creature_archetype_id=creature.id if creature else None,
            creature_orm=creature,
            gm_profile_id=body.gm_profile_id,
            is_template=False,
        )
        db.add(stat_block)
        db.flush()

        db.add(SavedEncounterMonster(
            id=str(uuid.uuid4()),
            saved_encounter_id=encounter_id,
            monster_stat_block_id=stat_block.id,
            count=monster.count,
            sort_order=sort_idx,
        ))

    db.commit()
    return (
        db.query(SavedEncounter)
        .options(*_ENCOUNTER_LOAD)
        .filter(SavedEncounter.id == encounter_id)
        .first()
    )


@router.get("/encounters", response_model=PagedEncountersOut)
def list_encounters(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PagedEncountersOut:
    offset = (page - 1) * per_page
    total  = db.query(SavedEncounter).count()
    rows   = (
        db.query(SavedEncounter)
        .options(*_ENCOUNTER_LOAD)
        .order_by(SavedEncounter.created_at.desc())
        .offset(offset).limit(per_page)
        .all()
    )
    items = [
        SavedEncounterSummaryOut(
            id=r.id,
            name=r.name,
            difficulty=r.difficulty,
            party_size=r.party_size,
            party_avg_level=r.party_avg_level,
            expected_rounds=r.expected_rounds,
            total_monster_count=sum(m.count for m in r.encounter_monsters),
            created_at=r.created_at,
        )
        for r in rows
    ]
    return PagedEncountersOut(items=items, total=total, page=page, per_page=per_page)


@router.get("/encounters/{encounter_id}", response_model=SavedEncounterOut)
def get_encounter(encounter_id: str, db: Session = Depends(get_db)):
    encounter = (
        db.query(SavedEncounter)
        .options(*_ENCOUNTER_LOAD)
        .filter(SavedEncounter.id == encounter_id)
        .first()
    )
    if not encounter:
        return _mf_error(404, "ENCOUNTER_NOT_FOUND", f"Encounter {encounter_id!r} not found")
    return encounter


@router.delete("/encounters/{encounter_id}", status_code=204)
def delete_encounter(encounter_id: str, db: Session = Depends(get_db)) -> Response:
    encounter = (
        db.query(SavedEncounter)
        .options(*_ENCOUNTER_LOAD)
        .filter(SavedEncounter.id == encounter_id)
        .first()
    )
    if not encounter:
        return _mf_error(404, "ENCOUNTER_NOT_FOUND", f"Encounter {encounter_id!r} not found")

    # Collect non-template stat block IDs before the cascade wipes the join rows
    non_template_ids = [
        m.monster_stat_block_id
        for m in encounter.encounter_monsters
        if not m.monster_stat_block.is_saved_template
    ]

    db.delete(encounter)   # cascades to SavedEncounterMonster rows
    db.flush()

    if non_template_ids:
        db.query(MonsterStatBlock).filter(
            MonsterStatBlock.id.in_(non_template_ids)
        ).delete(synchronize_session=False)

    db.commit()
    return Response(status_code=204)


# ── Persistence: Monster Templates ────────────────────────────────────────────

@router.post("/monsters/templates", response_model=MonsterStatBlockOut, status_code=201)
def save_monster_template(body: SaveMonsterTemplateIn, db: Session = Depends(get_db)):
    monster  = body.monster
    role     = db.query(CombatRoleArchetype).filter(CombatRoleArchetype.name == monster.combat_role_name).first()
    creature = db.query(CreatureArchetype).filter(CreatureArchetype.name == monster.creature_archetype_name).first()

    if not role:
        return _mf_error(400, "ROLE_NOT_FOUND",
                         f"Combat role {monster.combat_role_name!r} not found in database")

    stat_block = _build_stat_block(
        name=body.name,
        monster=monster,
        party_avg_level=body.party_avg_level,
        combat_role_id=role.id,
        creature_archetype_id=creature.id if creature else None,
        creature_orm=creature,
        gm_profile_id=None,
        is_template=True,
    )
    db.add(stat_block)
    db.commit()
    db.refresh(stat_block)
    return stat_block


@router.get("/monsters/templates", response_model=PagedTemplatesOut)
def list_monster_templates(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    db: Session = Depends(get_db),
) -> PagedTemplatesOut:
    offset = (page - 1) * per_page
    q      = db.query(MonsterStatBlock).filter(MonsterStatBlock.is_saved_template == True)  # noqa: E712
    total  = q.count()
    rows   = q.order_by(MonsterStatBlock.created_at.desc()).offset(offset).limit(per_page).all()
    return PagedTemplatesOut(
        items=[MonsterStatBlockOut.model_validate(r) for r in rows],
        total=total,
        page=page,
        per_page=per_page,
    )


@router.get("/monsters/templates/{template_id}", response_model=MonsterStatBlockOut)
def get_monster_template(template_id: str, db: Session = Depends(get_db)):
    template = db.query(MonsterStatBlock).filter(MonsterStatBlock.id == template_id).first()
    if not template:
        return _mf_error(404, "TEMPLATE_NOT_FOUND", f"Template {template_id!r} not found")
    return template


@router.delete("/monsters/templates/{template_id}", status_code=204)
def delete_monster_template(template_id: str, db: Session = Depends(get_db)) -> Response:
    template = db.query(MonsterStatBlock).filter(MonsterStatBlock.id == template_id).first()
    if not template:
        return _mf_error(404, "TEMPLATE_NOT_FOUND", f"Template {template_id!r} not found")
    if not template.is_saved_template:
        return _mf_error(400, "NOT_A_TEMPLATE",
                         f"Stat block {template_id!r} is not a saved template and cannot be deleted here.")

    db.delete(template)
    db.commit()
    return Response(status_code=204)


# ── Private helpers ───────────────────────────────────────────────────────────

def _mf_error(status: int, code: str, detail: str, warnings: list[str] | None = None) -> JSONResponse:
    return JSONResponse(
        status_code=status,
        content={"error": code, "detail": detail, "warnings": warnings or []},
    )


def _level_tier(avg_level: int) -> int:
    if avg_level <= 4:  return 1
    if avg_level <= 10: return 2
    if avg_level <= 16: return 3
    return 4


@router.post("/export/dndbeyond", response_model=DnDBeyondExport)
def export_dndbeyond(body: ExportDnDBeyondIn) -> DnDBeyondExport:
    """Format a GeneratedMonster for pasting into D&D Beyond's homebrew creator.

    Pure computation — no database access.
    """
    return generate_dndbeyond_export(body.monster)


def _build_stat_block(
    name: str,
    monster: GeneratedMonster,
    party_avg_level: int,
    combat_role_id: str,
    creature_archetype_id: str | None,
    creature_orm: CreatureArchetype | None,
    gm_profile_id: str | None,
    is_template: bool,
) -> MonsterStatBlock:
    return MonsterStatBlock(
        id=str(uuid.uuid4()),
        name=name,
        creature_archetype_id=creature_archetype_id,
        combat_role_archetype_id=combat_role_id,
        gm_profile_id=gm_profile_id,
        is_boss=monster.is_boss,
        level_tier=_level_tier(party_avg_level),
        hp=monster.stats.hp,
        ac=monster.stats.ac,
        attack_bonus=monster.stats.attack_bonus,
        save_dc=monster.stats.save_dc,
        speed=monster.stats.speed,
        str_score=monster.stats.str_score,
        dex_score=monster.stats.dex_score,
        con_score=monster.stats.con_score,
        int_score=monster.stats.int_score,
        wis_score=monster.stats.wis_score,
        cha_score=monster.stats.cha_score,
        damage_immunities=creature_orm.damage_immunities if creature_orm else None,
        damage_resistances=creature_orm.damage_resistances if creature_orm else None,
        condition_immunities=creature_orm.condition_immunities if creature_orm else None,
        has_legendary_actions=len(monster.abilities.legendary_actions) > 0,
        legendary_action_count=monster.stats.legendary_action_count,
        has_lair_actions=len(monster.abilities.lair_actions) > 0,
        actions=[a.model_dump() for a in monster.abilities.standard_actions],
        legendary_actions=[a.model_dump() for a in monster.abilities.legendary_actions],
        lair_actions=[a.model_dump() for a in monster.abilities.lair_actions],
        is_saved_template=is_template,
    )
