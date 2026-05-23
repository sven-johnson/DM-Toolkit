import uuid

from fastapi import APIRouter, Depends, HTTPException, Response
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
    SavingThrowSettings,
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
    PresetOut,
    ProfileFromPresetIn,
)

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
