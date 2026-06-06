"""
Encounter Orchestrator — Task 2.5

Coordinates all Monster Factory calculators into a complete GeneratedEncounter.
This is the only calculator module that accesses the database.
"""
from __future__ import annotations

from typing import Any

from pydantic import BaseModel, Field
from sqlalchemy.orm import Session as DBSession, selectinload

from ...models import (
    AbilityFlavor,
    CombatRoleArchetype,
    CreatureArchetype,
    GMProfile,
)
from ...monster_factory_schemas import (
    ActionEconomySettingsIn,
    LethalitySettingsIn,
    MinionSettingsIn,
    WarningSettingsIn,
)
from .ability_assignment import (
    AbilityFlavorInput,
    CombatRoleAbilityInput,
    CreatureArchetypeAbilityInput,
    MonsterAbilitySet,
    assign_abilities,
)
from .difficulty_targets import Difficulty, DifficultyTargets, calculate_difficulty_targets
from .monster_stats import (
    CalculatedMonsterStats,
    CombatRoleInput,
    CreatureArchetypeInput,
    GmSettingsInput,
    MonsterStatInput,
    calculate_monster_stats,
)
from .party_profile import (
    PartyMember,
    PartyProfile,
    PartyProfileInput,
    calculate_party_profile,
)


# ── Input schemas ─────────────────────────────────────────────────────────────


class EncounterCompositionSlot(BaseModel):
    combat_role_id: str
    creature_archetype_id: str
    count: int = Field(..., ge=1, le=20)
    is_boss: bool
    override_lair_actions: bool | None = None


class GenerateEncounterInput(BaseModel):
    party_members: list[PartyMember] = Field(..., min_length=1, max_length=12)
    party_level: int = Field(..., ge=1, le=20)
    difficulty: Difficulty
    composition: list[EncounterCompositionSlot] = Field(..., min_length=1)
    gm_profile_id: str
    encounter_name: str = "Unnamed Encounter"
    lair_actions_enabled: bool = False


# ── Output schemas ────────────────────────────────────────────────────────────


class GeneratedMonster(BaseModel):
    slot_index: int
    combat_role_name: str
    creature_archetype_name: str
    count: int
    is_boss: bool
    stats: CalculatedMonsterStats
    abilities: MonsterAbilitySet


class GeneratedEncounter(BaseModel):
    encounter_name: str
    difficulty: str
    party_profile: PartyProfile
    difficulty_targets: DifficultyTargets
    monsters: list[GeneratedMonster]
    total_monster_count: int
    total_monster_hp: int
    total_monster_actions_per_round: float
    expected_rounds: float
    expected_rounds_min: float
    expected_rounds_max: float
    all_warnings: list[str]
    math_detail: dict[str, Any]


# ── Private helpers ───────────────────────────────────────────────────────────


def _profile_to_monster_settings(profile: GMProfile) -> GmSettingsInput:
    """Convert loaded GMProfile ORM to the settings bundle monster_stats needs."""
    return GmSettingsInput(
        lethality=LethalitySettingsIn.model_validate(profile.lethality, from_attributes=True),
        action_economy=ActionEconomySettingsIn.model_validate(profile.action_economy, from_attributes=True),
        minion=MinionSettingsIn.model_validate(profile.minion, from_attributes=True),
        warnings=WarningSettingsIn.model_validate(profile.warnings, from_attributes=True),
    )


def _flavor_to_input(flavor: AbilityFlavor) -> AbilityFlavorInput:
    """Convert an ORM AbilityFlavor (with relationships loaded) to AbilityFlavorInput."""
    return AbilityFlavorInput(
        id=flavor.id,
        name=flavor.name,
        damage_type=flavor.damage_type,
        role_ids=[m.combat_role_archetype_id for m in flavor.role_mappings],
        creature_ids=[m.creature_archetype_id for m in flavor.creature_mappings],
    )


def _slot_lair_enabled(
    slot: EncounterCompositionSlot,
    inp: GenerateEncounterInput,
    profile: GMProfile,
) -> bool:
    """Resolve per-slot lair action enablement with override support."""
    if slot.override_lair_actions is not None:
        return slot.override_lair_actions
    return inp.lair_actions_enabled and profile.action_economy.lair_actions_enabled


def _load_profile(gm_profile_id: str, db: DBSession) -> GMProfile:
    profile: GMProfile | None = (
        db.query(GMProfile)
        .options(
            selectinload(GMProfile.lethality),
            selectinload(GMProfile.combat_duration),
            selectinload(GMProfile.action_economy),
            selectinload(GMProfile.hit_rate),
            selectinload(GMProfile.saving_throw),
            selectinload(GMProfile.minion),
            selectinload(GMProfile.warnings),
        )
        .filter(GMProfile.id == gm_profile_id)
        .first()
    )
    if profile is None:
        raise ValueError(f"GM profile not found: id={gm_profile_id!r}")
    return profile


def _load_archetypes(
    composition: list[EncounterCompositionSlot],
    db: DBSession,
) -> tuple[dict[str, CombatRoleArchetype], dict[str, CreatureArchetype]]:
    """
    Load all referenced role and creature archetypes in two bulk queries.
    Raises ValueError before any calculation if any referenced ID is missing.
    """
    role_ids = list({s.combat_role_id for s in composition})
    creature_ids = list({s.creature_archetype_id for s in composition})

    roles: dict[str, CombatRoleArchetype] = {
        r.id: r
        for r in db.query(CombatRoleArchetype).filter(CombatRoleArchetype.id.in_(role_ids)).all()
    }
    creatures: dict[str, CreatureArchetype] = {
        c.id: c
        for c in db.query(CreatureArchetype).filter(CreatureArchetype.id.in_(creature_ids)).all()
    }

    missing_roles = [rid for rid in role_ids if rid not in roles]
    missing_creatures = [cid for cid in creature_ids if cid not in creatures]

    errors: list[str] = []
    if missing_roles:
        errors.append(f"Unknown combat_role_id(s): {missing_roles}")
    if missing_creatures:
        errors.append(f"Unknown creature_archetype_id(s): {missing_creatures}")
    if errors:
        raise ValueError("Invalid composition — " + "; ".join(errors))

    return roles, creatures


def _load_flavors(db: DBSession) -> list[AbilityFlavorInput]:
    flavors: list[AbilityFlavor] = (
        db.query(AbilityFlavor)
        .options(
            selectinload(AbilityFlavor.role_mappings),
            selectinload(AbilityFlavor.creature_mappings),
        )
        .all()
    )
    return [_flavor_to_input(f) for f in flavors]


# ── Public API ────────────────────────────────────────────────────────────────


def generate_encounter(inp: GenerateEncounterInput, db: DBSession) -> GeneratedEncounter:
    """
    Run all calculators in order and return a complete GeneratedEncounter.

    Step 1: Load GM profile (all settings).
    Step 2: Load and validate archetypes for all slots.
    Step 3: Load AbilityFlavor library.
    Step 4: Calculate party profile.
    Step 5: Calculate difficulty targets.
    Step 6: Sum total_monster_count.
    Step 7: Per-slot: stats → abilities → minion HP override.
    Step 8: Encounter-level aggregates.
    Step 9: Collect and deduplicate warnings.
    Step 10: Populate math_detail when show_math=True.
    Step 11: Return GeneratedEncounter.
    """
    # Step 1 — GM profile
    profile = _load_profile(inp.gm_profile_id, db)

    # Step 2 — Archetypes (validates all IDs before any calculation)
    roles, creatures = _load_archetypes(inp.composition, db)

    # Step 3 — Flavor library
    available_flavors = _load_flavors(db)

    # Step 4 — Party profile
    party_profile = calculate_party_profile(
        PartyProfileInput(members=inp.party_members, level=inp.party_level),
        profile.action_economy,
    )

    # Step 5 — Difficulty targets (GMProfile satisfies the GmSettings Protocol)
    difficulty_targets = calculate_difficulty_targets(inp.difficulty, party_profile, profile)

    # Step 6 — Total monster count
    total_monster_count = sum(s.count for s in inp.composition)

    # Step 7 — Per-slot calculation
    monster_gm_settings = _profile_to_monster_settings(profile)
    monsters: list[GeneratedMonster] = []

    for idx, slot in enumerate(inp.composition):
        role_orm = roles[slot.combat_role_id]
        creature_orm = creatures[slot.creature_archetype_id]

        # Build calculator input objects
        role_input = CombatRoleInput(
            name=role_orm.name,
            hp_share_tier=role_orm.hp_share_tier,
            ac_profile=role_orm.ac_profile,
            damage_profile=role_orm.damage_profile,
            is_boss_eligible=role_orm.is_boss_eligible,
            is_minion=role_orm.is_minion,
            default_attack_count=role_orm.default_attack_count,
            action_weight=role_orm.action_weight,
        )
        creature_input = CreatureArchetypeInput(
            name=creature_orm.name,
            damage_immunities=creature_orm.damage_immunities,
            damage_resistances=creature_orm.damage_resistances,
            condition_immunities=creature_orm.condition_immunities,
        )

        # 7a — Monster stats
        stats = calculate_monster_stats(MonsterStatInput(
            combat_role=role_input,
            creature_archetype=creature_input,
            is_boss=slot.is_boss,
            count_of_this_type=slot.count,
            total_monster_count=total_monster_count,
            difficulty_targets=difficulty_targets,
            party_profile=party_profile,
            gm_settings=monster_gm_settings,
        ))

        # 7b — Ability assignment
        role_ability_input = CombatRoleAbilityInput(
            id=role_orm.id,
            name=role_orm.name,
            is_minion=role_orm.is_minion,
            default_attack_count=role_orm.default_attack_count,
        )
        creature_ability_input = CreatureArchetypeAbilityInput(
            id=creature_orm.id,
            name=creature_orm.name,
            typical_traits=creature_orm.typical_traits or [],
        )
        lair_enabled = _slot_lair_enabled(slot, inp, profile)

        abilities = assign_abilities(
            combat_role=role_ability_input,
            creature_archetype=creature_ability_input,
            calculated_stats=stats,
            is_boss=slot.is_boss,
            available_flavors=available_flavors,
            gm_settings=MinionSettingsIn.model_validate(profile.minion, from_attributes=True),
            lair_actions_enabled=lair_enabled,
        )

        # 7c — Minion one-hit-kill override (HP set to 1 after assignment)
        if role_orm.is_minion and profile.minion.minion_one_hit_kill:
            stats = stats.model_copy(update={"hp": 1})

        monsters.append(GeneratedMonster(
            slot_index=idx,
            combat_role_name=role_orm.name,
            creature_archetype_name=creature_orm.name,
            count=slot.count,
            is_boss=slot.is_boss,
            stats=stats,
            abilities=abilities,
        ))

    # Step 8 — Encounter-level aggregates
    total_monster_hp = sum(m.stats.hp * m.count for m in monsters)

    total_monster_actions_per_round = sum(
        roles[slot.combat_role_id].action_weight * slot.count
        for slot in inp.composition
    )

    party_sustained = party_profile.party_sustained
    if party_sustained > 0:
        expected_rounds = total_monster_hp / party_sustained
    else:
        expected_rounds = difficulty_targets.target_rounds

    round_variance = profile.combat_duration.round_variance_tolerance
    expected_rounds_min = max(0.0, expected_rounds - round_variance)
    expected_rounds_max = expected_rounds + round_variance

    # Step 9 — Deduplicated warnings
    seen: set[str] = set()
    all_warnings: list[str] = []
    for monster in monsters:
        for w in monster.stats.warnings:
            if w not in seen:
                seen.add(w)
                all_warnings.append(w)

    # Step 10 — Math detail
    math_detail: dict[str, Any] = {}
    if profile.warnings.show_math:
        math_detail = {
            "party_profile": party_profile.model_dump(),
            "difficulty_targets": difficulty_targets.model_dump(),
            "total_monster_count": total_monster_count,
            "total_monster_hp": total_monster_hp,
            "total_monster_actions_per_round": total_monster_actions_per_round,
            "expected_rounds": expected_rounds,
            "per_slot": [
                {
                    "slot_index": m.slot_index,
                    "combat_role": m.combat_role_name,
                    "creature_archetype": m.creature_archetype_name,
                    "count": m.count,
                    "hp": m.stats.hp,
                    "ac": m.stats.ac,
                    "attack_bonus": m.stats.attack_bonus,
                    "damage_dice": m.stats.damage_dice,
                    "stat_math": m.stats.show_math_detail,
                }
                for m in monsters
            ],
        }

    # Step 11 — Return
    return GeneratedEncounter(
        encounter_name=inp.encounter_name,
        difficulty=inp.difficulty,
        party_profile=party_profile,
        difficulty_targets=difficulty_targets,
        monsters=monsters,
        total_monster_count=total_monster_count,
        total_monster_hp=total_monster_hp,
        total_monster_actions_per_round=total_monster_actions_per_round,
        expected_rounds=expected_rounds,
        expected_rounds_min=expected_rounds_min,
        expected_rounds_max=expected_rounds_max,
        all_warnings=all_warnings,
        math_detail=math_detail,
    )


def rebalance_encounter(
    existing: GeneratedEncounter,
    new_composition: list[EncounterCompositionSlot] | None,
    new_party_members: list[PartyMember] | None,
    new_party_level: int | None,
    new_difficulty: str | None,
    gm_profile_id: str,
    db: DBSession,
) -> GeneratedEncounter:
    """
    Recompute an encounter with changed inputs.
    Any argument passed as None uses the existing encounter's values.
    The encounter_name is always preserved.
    Returns a fresh GeneratedEncounter; never mutates existing.
    """
    # Reconstruct composition from existing if not provided
    if new_composition is None:
        new_composition = [
            EncounterCompositionSlot(
                combat_role_id=_find_role_id_by_name(m.combat_role_name, db),
                creature_archetype_id=_find_creature_id_by_name(m.creature_archetype_name, db),
                count=m.count,
                is_boss=m.is_boss,
            )
            for m in existing.monsters
        ]

    # Reconstruct party members from existing profile if not provided
    if new_party_members is None:
        new_party_members = _party_members_from_profile(existing.party_profile)

    rebuild_input = GenerateEncounterInput(
        party_members=new_party_members,
        party_level=new_party_level if new_party_level is not None else existing.party_profile.avg_level,
        difficulty=new_difficulty if new_difficulty is not None else existing.difficulty,
        composition=new_composition,
        gm_profile_id=gm_profile_id,
        encounter_name=existing.encounter_name,
    )

    return generate_encounter(rebuild_input, db)


# ── Rebalance helpers ─────────────────────────────────────────────────────────


def _find_role_id_by_name(name: str, db: DBSession) -> str:
    role = db.query(CombatRoleArchetype).filter(CombatRoleArchetype.name == name).first()
    if role is None:
        raise ValueError(f"Cannot rebalance: combat role not found by name {name!r}")
    return role.id


def _find_creature_id_by_name(name: str, db: DBSession) -> str:
    creature = db.query(CreatureArchetype).filter(CreatureArchetype.name == name).first()
    if creature is None:
        raise ValueError(f"Cannot rebalance: creature archetype not found by name {name!r}")
    return creature.id


def _party_members_from_profile(profile: PartyProfile) -> list[PartyMember]:
    """
    Reconstruct a minimal list of PartyMember objects from an existing PartyProfile.
    Individual member stats are not stored in PartyProfile, so we synthesise
    party_size members whose averages reproduce the stored totals.
    """
    n = profile.party_size
    per_member_sustained = profile.party_sustained / n if n else 0.0
    per_member_nova = profile.party_nova / n if n else 0.0
    return [
        PartyMember(
            max_hp=round(profile.avg_hp),
            ac=round(profile.avg_ac),
            nova_damage=per_member_nova,
            sustained_damage_per_round=per_member_sustained,
        )
        for _ in range(n)
    ]
