"""
Ability Assignment Engine — Task 2.4
Pure functions only; no database access.

Selects named abilities from the flavor library for a generated monster
and assembles standard actions, legendary actions, lair actions, and
special traits into a complete MonsterAbilitySet.
"""
from __future__ import annotations

import random
from typing import Literal

from pydantic import BaseModel, Field

from ...monster_factory_schemas import MinionSettingsIn
from .monster_stats import CalculatedMonsterStats


# ── Input schemas ─────────────────────────────────────────────────────────────


class AbilityFlavorInput(BaseModel):
    """Lightweight view of an AbilityFlavor with pre-resolved mapping IDs."""
    id: str
    name: str
    damage_type: str
    role_ids: list[str] = Field(default_factory=list)
    creature_ids: list[str] = Field(default_factory=list)


class CombatRoleAbilityInput(BaseModel):
    """Fields from CombatRoleArchetype needed for ability assignment."""
    id: str
    name: str
    is_minion: bool = False
    default_attack_count: int = 1


class CreatureArchetypeAbilityInput(BaseModel):
    """Fields from CreatureArchetype needed for ability assignment."""
    id: str
    name: str
    typical_traits: list[str] = Field(default_factory=list)


# ── Output schemas ────────────────────────────────────────────────────────────


class AssignedAbility(BaseModel):
    name: str
    damage_dice: str
    damage_bonus: int
    damage_type: str
    attack_bonus: int
    range: str
    description: str
    is_legendary: bool = False
    action_cost: int = 1


class MonsterAbilitySet(BaseModel):
    standard_actions: list[AssignedAbility]
    legendary_actions: list[AssignedAbility]
    lair_actions: list[AssignedAbility]
    special_traits: list[str]
    multiattack_description: str


# ── Constants ─────────────────────────────────────────────────────────────────

# Generic fallbacks keyed by broad role category
_MELEE_ROLES   = {"bruiser", "tank", "guardian"}
_RANGED_ROLES  = {"archer", "skirmisher"}
_CASTER_ROLES  = {"caster", "controller", "support"}

_FALLBACK_MELEE  = AbilityFlavorInput(id="fallback_melee",  name="Strike",  damage_type="bludgeoning", role_ids=[], creature_ids=[])
_FALLBACK_RANGED = AbilityFlavorInput(id="fallback_ranged", name="Bolt",    damage_type="piercing",    role_ids=[], creature_ids=[])
_FALLBACK_CASTER = AbilityFlavorInput(id="fallback_caster", name="Hex",     damage_type="necrotic",    role_ids=[], creature_ids=[])

# Legendary special options keyed by role name keywords (lower-case)
_LEGENDARY_SPECIALS: dict[str, tuple[str, str]] = {
    "bruiser": (
        "Shove",
        "One creature within 5 ft must succeed on a Strength saving throw "
        "(DC {save_dc}) or be pushed 15 ft and knocked prone.",
    ),
    "tank": (
        "Shove",
        "One creature within 5 ft must succeed on a Strength saving throw "
        "(DC {save_dc}) or be pushed 15 ft and knocked prone.",
    ),
    "controller": (
        "Unravel",
        "One creature within 60 ft must succeed on a Wisdom saving throw "
        "(DC {save_dc}) or become incapacitated until the end of its next turn.",
    ),
    "caster": (
        "Unravel",
        "One creature within 60 ft must succeed on a Wisdom saving throw "
        "(DC {save_dc}) or become incapacitated until the end of its next turn.",
    ),
    "assassin": (
        "Vanish",
        "The creature takes the Hide action and moves up to half its speed.",
    ),
    "skirmisher": (
        "Vanish",
        "The creature takes the Hide action and moves up to half its speed.",
    ),
    "archer": (
        "Suppressing Fire",
        "One creature within range must succeed on a Dexterity saving throw "
        "(DC {save_dc}) or have disadvantage on attack rolls until the end of "
        "its next turn.",
    ),
    "support": (
        "Bolster",
        "One allied creature within 30 ft regains hit points equal to {save_dc}.",
    ),
}

# Lair action themes keyed by creature archetype name keywords (lower-case)
_LAIR_THEMES: dict[str, list[str]] = {
    "shadow": [
        "Unnatural Darkness. Magical darkness fills a 20-ft radius sphere "
        "centered on a point the creature can see until initiative count 20 "
        "of the next round.",
        "Spectral Grasp. Each creature of the creature's choice within 30 ft "
        "must succeed on a Strength saving throw (DC {save_dc}) or be "
        "restrained until initiative count 20 of the next round.",
        "Whisper of Dread. Each creature of the creature's choice within 60 ft "
        "must succeed on a Wisdom saving throw (DC {save_dc}) or become "
        "frightened until initiative count 20 of the next round.",
    ],
    "undead": [
        "Grave Chill. A 10-ft radius area of necrotic cold erupts at a point "
        "the creature chooses within 60 ft, making that area difficult terrain "
        "until initiative count 20 of the next round.",
        "Rattle the Bones. Each creature within 30 ft must succeed on a "
        "Wisdom saving throw (DC {save_dc}) or be frightened until initiative "
        "count 20 of the next round.",
        "Necrotic Surge. The ground in a 20-ft square the creature chooses "
        "within 60 ft becomes difficult terrain and is wreathed in dim green "
        "light until initiative count 20 of the next round.",
    ],
    "demon": [
        "Brimstone Fissure. A 10-ft radius area within 60 ft erupts with "
        "sulfurous fumes, becoming difficult terrain until initiative count 20 "
        "of the next round.",
        "Corrupting Ground. The floor in a 15-ft radius within 60 ft becomes "
        "supernaturally slick with corrupted ichor, making it difficult terrain "
        "until initiative count 20 of the next round.",
        "Infernal Howl. Each creature within 30 ft must succeed on a "
        "Constitution saving throw (DC {save_dc}) or be deafened until "
        "initiative count 20 of the next round.",
    ],
    "dragon": [
        "Elemental Surge. A gust of elemental energy sweeps through a 30-ft "
        "line, making it difficult terrain until initiative count 20 of the "
        "next round.",
        "Wing Buffet. Each creature within 15 ft must succeed on a Strength "
        "saving throw (DC {save_dc}) or be pushed 10 ft away from the creature.",
        "Scorched Earth. A 15-ft radius area within 60 ft becomes difficult "
        "terrain covered in scorched stone until initiative count 20 of the "
        "next round.",
    ],
    "beast": [
        "Tremorsense Alert. The ground trembles in a 30-ft radius; each "
        "creature in that area must succeed on a Dexterity saving throw "
        "(DC {save_dc}) or fall prone.",
        "Entangling Vegetation. Roots and vines erupt from the ground in a "
        "20-ft radius within 60 ft, making that area difficult terrain until "
        "initiative count 20 of the next round.",
        "Animal Call. The creature summons a swarm of small animals that harass "
        "one creature the creature can see within 60 ft; that creature has "
        "disadvantage on attack rolls until initiative count 20 of the next round.",
    ],
    "plant": [
        "Entangling Roots. Grasping roots erupt in a 15-ft radius within "
        "60 ft, making that area difficult terrain until initiative count 20 "
        "of the next round.",
        "Spore Cloud. Toxic spores fill a 10-ft radius sphere centered on a "
        "point the creature chooses within 60 ft; the area is lightly obscured "
        "until initiative count 20 of the next round.",
        "Bark Barrier. A wall of twisted wood 10 ft long and 5 ft high erupts "
        "from the ground at a point the creature chooses within 60 ft, "
        "providing three-quarters cover.",
    ],
    "elemental": [
        "Environmental Flux. Wind, water, or stone surges through a 20-ft "
        "square the creature chooses within 60 ft, making it difficult terrain "
        "until initiative count 20 of the next round.",
        "Elemental Vortex. Each creature within 30 ft must succeed on a "
        "Strength saving throw (DC {save_dc}) or be pulled 10 ft toward the "
        "creature.",
        "Rift. A crack in the elemental plane opens in a 10-ft radius within "
        "60 ft; the area becomes difficult terrain and is lightly obscured "
        "until initiative count 20 of the next round.",
    ],
}

_LAIR_DEFAULT = [
    "Falling Debris. Chunks of stone rain down in a 10-ft radius within 60 ft; "
    "each creature in that area must succeed on a Dexterity saving throw "
    "(DC {save_dc}) or be knocked prone.",
    "Blinding Flash. A burst of searing light fills a 20-ft radius centered on "
    "a point the creature chooses within 60 ft; each creature there must "
    "succeed on a Constitution saving throw (DC {save_dc}) or be blinded "
    "until initiative count 20 of the next round.",
    "Rumbling Tremors. The floor shakes violently in a 30-ft radius centered "
    "on the creature; that area becomes difficult terrain until initiative "
    "count 20 of the next round.",
]


# ── Helpers ───────────────────────────────────────────────────────────────────


def _role_category(role_name: str) -> Literal["melee", "ranged", "caster"]:
    lower = role_name.lower()
    if any(k in lower for k in _RANGED_ROLES):
        return "ranged"
    if any(k in lower for k in _CASTER_ROLES):
        return "caster"
    return "melee"


def _default_range(role_name: str) -> str:
    cat = _role_category(role_name)
    if cat == "ranged":
        return "ranged 60/120 ft"
    return "melee 5 ft"


def _generic_fallback(role_name: str) -> AbilityFlavorInput:
    cat = _role_category(role_name)
    if cat == "ranged":
        return _FALLBACK_RANGED
    if cat == "caster":
        return _FALLBACK_CASTER
    return _FALLBACK_MELEE


def _select_flavors(
    role_id: str,
    creature_id: str,
    attack_count: int,
    available_flavors: list[AbilityFlavorInput],
    role_name: str,
) -> list[AbilityFlavorInput]:
    """
    Priority:
      1. Matches both this role AND this creature
      2. Matches this role only
      3. Generic fallback
    Selects up to attack_count flavors, preferring damage-type variety.
    """
    both   = [f for f in available_flavors if role_id in f.role_ids and creature_id in f.creature_ids]
    role_only = [f for f in available_flavors if role_id in f.role_ids and f not in both]

    candidates = both if both else (role_only if role_only else [_generic_fallback(role_name)])

    # Pick up to attack_count, preferring variety of damage types
    selected: list[AbilityFlavorInput] = []
    used_types: set[str] = set()

    # First pass: unique damage types
    for flavor in candidates:
        if len(selected) >= attack_count:
            break
        if flavor.damage_type not in used_types:
            selected.append(flavor)
            used_types.add(flavor.damage_type)

    # Second pass: fill remaining slots (allow repeats if not enough variety)
    if len(selected) < attack_count:
        for flavor in candidates:
            if len(selected) >= attack_count:
                break
            if flavor not in selected:
                selected.append(flavor)

    # If still short (attack_count > available), repeat last
    while len(selected) < attack_count:
        selected.append(selected[-1])

    return selected[:attack_count]


def _build_standard_actions(
    selected_flavors: list[AbilityFlavorInput],
    calculated_stats: CalculatedMonsterStats,
    role_name: str,
) -> list[AssignedAbility]:
    range_str = _default_range(role_name)
    return [
        AssignedAbility(
            name=flavor.name,
            damage_dice=calculated_stats.damage_dice,
            damage_bonus=calculated_stats.damage_bonus,
            damage_type=flavor.damage_type,
            attack_bonus=calculated_stats.attack_bonus,
            range=range_str,
            description=(
                f"{flavor.name} attack. Melee or ranged weapon attack: "
                f"+{calculated_stats.attack_bonus} to hit. "
                f"Hit: {calculated_stats.damage_dice} + "
                f"{calculated_stats.damage_bonus} {flavor.damage_type} damage."
            ),
        )
        for flavor in selected_flavors
    ]


def _build_multiattack_description(
    attack_count: int,
    archetype_name: str,
    action_names: list[str],
) -> str:
    if attack_count <= 1:
        return ""
    names_str = ", ".join(action_names)
    return (
        f"The {archetype_name} makes {attack_count} attacks: {names_str}."
    )


def _build_special_traits(typical_traits: list[str]) -> list[str]:
    """
    Format each typical_traits entry as a named passive trait block.
    Entries are expected to be in the form "Trait Name: description" or
    plain strings.  We normalise them to "Trait Name. Description."
    """
    results: list[str] = []
    for trait in typical_traits:
        if ": " in trait:
            name, desc = trait.split(": ", 1)
            desc = desc.rstrip(".")
            results.append(f"{name}. {desc}.")
        else:
            results.append(trait if trait.endswith(".") else f"{trait}.")
    return results


def _build_legendary_actions(
    combat_role: CombatRoleAbilityInput,
    calculated_stats: CalculatedMonsterStats,
    standard_actions: list[AssignedAbility],
    legendary_action_count: int,
) -> list[AssignedAbility]:
    save_dc = calculated_stats.save_dc
    actions: list[AssignedAbility] = []

    # Always: Move (cost 1)
    actions.append(AssignedAbility(
        name="Move",
        damage_dice="—",
        damage_bonus=0,
        damage_type="none",
        attack_bonus=0,
        range="self",
        description="The creature moves up to its speed without provoking opportunity attacks.",
        is_legendary=True,
        action_cost=1,
    ))

    # Always: Attack (cost 1) — reuse first standard action
    if standard_actions:
        base = standard_actions[0]
        actions.append(AssignedAbility(
            name=base.name,
            damage_dice=base.damage_dice,
            damage_bonus=base.damage_bonus,
            damage_type=base.damage_type,
            attack_bonus=base.attack_bonus,
            range=base.range,
            description=base.description,
            is_legendary=True,
            action_cost=1,
        ))

    # Role-specific special (cost 2)
    role_lower = combat_role.name.lower()
    special_name, special_desc_template = _LEGENDARY_SPECIALS.get(
        next((k for k in _LEGENDARY_SPECIALS if k in role_lower), "controller"),
        _LEGENDARY_SPECIALS["controller"],
    )
    special_desc = special_desc_template.format(save_dc=save_dc)
    actions.append(AssignedAbility(
        name=special_name,
        damage_dice="—",
        damage_bonus=0,
        damage_type="none",
        attack_bonus=0,
        range="special",
        description=special_desc,
        is_legendary=True,
        action_cost=2,
    ))

    return actions


def _build_lair_actions(
    creature_archetype: CreatureArchetypeAbilityInput,
    save_dc: int,
) -> list[AssignedAbility]:
    name_lower = creature_archetype.name.lower()
    theme_key = next(
        (k for k in _LAIR_THEMES if k in name_lower),
        None,
    )
    raw_descriptions = _LAIR_THEMES[theme_key] if theme_key else _LAIR_DEFAULT

    return [
        AssignedAbility(
            name="Lair Action",
            damage_dice="—",
            damage_bonus=0,
            damage_type="none",
            attack_bonus=0,
            range="special",
            description=desc.format(save_dc=save_dc),
            is_legendary=False,
            action_cost=0,
        )
        for desc in raw_descriptions[:3]
    ]


# ── Public API ────────────────────────────────────────────────────────────────


def assign_abilities(
    combat_role: CombatRoleAbilityInput,
    creature_archetype: CreatureArchetypeAbilityInput,
    calculated_stats: CalculatedMonsterStats,
    is_boss: bool,
    available_flavors: list[AbilityFlavorInput],
    gm_settings: MinionSettingsIn,
    lair_actions_enabled: bool = False,
) -> MonsterAbilitySet:
    """
    Select and assemble all abilities for a generated monster.

    Pure function — no database access.  The caller (encounter orchestrator)
    is responsible for converting ORM objects to the *Input schemas and
    pre-loading relationship IDs into AbilityFlavorInput.
    """
    attack_count = calculated_stats.attack_count

    # ── Standard actions ──────────────────────────────────────────────────────
    selected_flavors = _select_flavors(
        role_id=combat_role.id,
        creature_id=creature_archetype.id,
        attack_count=attack_count,
        available_flavors=available_flavors,
        role_name=combat_role.name,
    )
    standard_actions = _build_standard_actions(
        selected_flavors, calculated_stats, combat_role.name
    )

    # ── Multiattack ───────────────────────────────────────────────────────────
    multiattack_description = _build_multiattack_description(
        attack_count=attack_count,
        archetype_name=creature_archetype.name,
        action_names=[a.name for a in standard_actions],
    )

    # ── Special traits ────────────────────────────────────────────────────────
    special_traits = _build_special_traits(creature_archetype.typical_traits)

    # ── Legendary actions (boss only) ─────────────────────────────────────────
    legendary_actions: list[AssignedAbility] = []
    if is_boss and calculated_stats.legendary_action_count > 0:
        legendary_actions = _build_legendary_actions(
            combat_role=combat_role,
            calculated_stats=calculated_stats,
            standard_actions=standard_actions,
            legendary_action_count=calculated_stats.legendary_action_count,
        )

    # ── Lair actions ──────────────────────────────────────────────────────────
    lair_actions: list[AssignedAbility] = []
    if lair_actions_enabled:
        lair_actions = _build_lair_actions(
            creature_archetype=creature_archetype,
            save_dc=calculated_stats.save_dc,
        )

    return MonsterAbilitySet(
        standard_actions=standard_actions,
        legendary_actions=legendary_actions,
        lair_actions=lair_actions,
        special_traits=special_traits,
        multiattack_description=multiattack_description,
    )
