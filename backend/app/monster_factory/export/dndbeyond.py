"""D&D Beyond homebrew export formatter.

Pure Python — no database access. Converts a GeneratedMonster into
pre-formatted text sections ready to paste into D&D Beyond's
homebrew monster creation form.
"""
from __future__ import annotations

import math
import re

from pydantic import BaseModel

from ..calculators.ability_assignment import AssignedAbility, MonsterAbilitySet
from ..calculators.encounter_orchestrator import GeneratedMonster
from ..calculators.monster_stats import CalculatedMonsterStats


# ── Output schema ─────────────────────────────────────────────────────────────

class DnDBeyondExport(BaseModel):
    name: str
    meta_line: str           # e.g. "Large Undead (Shadow), Unaligned"
    cr_suggestion: str       # "—" — Monster Factory doesn't calculate CR
    is_legendary: bool

    # Numeric fields — copy these directly into D&D Beyond's stat block inputs
    hp: int
    hp_dice: str             # e.g. "18d10 + 90"
    ac: int
    speed: str               # e.g. "30 ft."
    str_score: int
    dex_score: int
    con_score: int
    int_score: int
    wis_score: int
    cha_score: int

    # Text sections — paste each into the matching D&D Beyond text field
    special_traits_text: str
    actions_text: str
    bonus_actions_text: str  # "" if none
    reactions_text: str      # "" if none
    legendary_actions_text: str
    lair_actions_text: str
    characteristics_text: str


# ── Helpers ───────────────────────────────────────────────────────────────────

def _size_label(hp: int) -> str:
    if hp < 36:  return "Small"
    if hp < 100: return "Medium"
    if hp < 200: return "Large"
    return "Huge"


def _die_for_hp(hp: int) -> tuple[int, float]:
    """Return (die_sides, average_roll) for an appropriate hit die."""
    if hp < 36:  return 6,  3.5
    if hp < 100: return 8,  4.5
    if hp < 200: return 10, 5.5
    return 12, 6.5


def _hp_dice(hp: int, con_score: int) -> str:
    """Approximate hit dice notation from HP and CON score."""
    die, avg_die = _die_for_hp(hp)
    con_mod = math.floor((con_score - 10) / 2)
    denom   = avg_die + con_mod
    if denom <= 0:
        num_dice = max(1, round(hp / avg_die))
    else:
        num_dice = max(1, round(hp / denom))
    flat = num_dice * con_mod
    base = f"{num_dice}d{die}"
    if flat > 0:  return f"{base} + {flat}"
    if flat < 0:  return f"{base} - {abs(flat)}"
    return base


def _replace_save_dc(text: str) -> str:
    """Replace 'DC N' with D&D Beyond rollable save tag [[/save N]]."""
    return re.sub(r'DC (\d+)', r'[[/save \1]]', text)


def _dice_tag(dice_str: str, bonus: int) -> str:
    """Build a D&D Beyond rollable damage tag: [[/r 2d6+3]]."""
    if dice_str == "—":
        return ""
    notation = dice_str
    if bonus > 0:  notation += f"+{bonus}"
    elif bonus < 0: notation += str(bonus)
    return f"[[/r {notation}]]"


def _format_action(action: AssignedAbility) -> str:
    tag = _dice_tag(action.damage_dice, action.damage_bonus)
    if not tag:
        # Non-damage action — use description directly
        return f"***{action.name}.*** {_replace_save_dc(action.description)}"

    range_type = "Melee" if "melee" in action.range.lower() else "Ranged"
    return (
        f"***{action.name}.*** "
        f"{range_type} Weapon Attack: +{action.attack_bonus} to hit, {action.range}. "
        f"Hit: {tag} {action.damage_type} damage."
    )


def _format_legendary(action: AssignedAbility) -> str:
    cost_str = f" (Costs {action.action_cost} Actions)" if action.action_cost > 1 else ""
    desc = _replace_save_dc(action.description)
    tag  = _dice_tag(action.damage_dice, action.damage_bonus)
    if tag:
        desc = re.sub(
            r'\d+d\d+(?:[+-]\d+)?',
            tag,
            desc,
            count=1,
        )
    return f"***{action.name}{cost_str}.*** {desc}"


def _format_special_traits(traits: list[str]) -> str:
    parts: list[str] = []
    for trait in traits:
        dot = trait.find('.')
        if dot >= 0:
            name = trait[:dot]
            desc = trait[dot + 1:].strip()
            parts.append(f"***{name}.*** {desc}")
        else:
            parts.append(trait)
    return "\n\n".join(parts)


def _format_actions(abilities: MonsterAbilitySet) -> str:
    parts: list[str] = []
    if abilities.multiattack_description:
        parts.append(f"***Multiattack.*** {abilities.multiattack_description}")
    for action in abilities.standard_actions:
        parts.append(_format_action(action))
    return "\n\n".join(parts)


def _format_legendary_actions(
    abilities: MonsterAbilitySet,
    stats: CalculatedMonsterStats,
    name: str,
) -> str:
    if not abilities.legendary_actions:
        return ""
    intro = (
        f"The {name} can take {stats.legendary_action_count} legendary action(s), "
        "choosing from the options below. Only one legendary action option can be "
        "used at a time and only at the end of another creature's turn. "
        f"The {name} regains spent legendary actions at the start of its turn."
    )
    lines = [intro]
    for action in abilities.legendary_actions:
        lines.append(_format_legendary(action))
    return "\n\n".join(lines)


def _format_lair_actions(abilities: MonsterAbilitySet, name: str) -> str:
    if not abilities.lair_actions:
        return ""
    intro = (
        f"On initiative count 20 (losing initiative ties), the {name} "
        "can take a lair action to cause one of the following effects:"
    )
    bullets = [f"• {_replace_save_dc(a.description)}" for a in abilities.lair_actions]
    return "\n\n".join([intro] + bullets)


# ── Public function ───────────────────────────────────────────────────────────

def generate_dndbeyond_export(monster: GeneratedMonster) -> DnDBeyondExport:
    stats     = monster.stats
    abilities = monster.abilities
    name      = monster.creature_archetype_name
    size      = _size_label(stats.hp)

    return DnDBeyondExport(
        name=name,
        meta_line=f"{size} {name}, Unaligned",
        cr_suggestion="—",
        is_legendary=bool(abilities.legendary_actions),
        hp=stats.hp,
        hp_dice=_hp_dice(stats.hp, stats.con_score),
        ac=stats.ac,
        speed=f"{stats.speed} ft.",
        str_score=stats.str_score,
        dex_score=stats.dex_score,
        con_score=stats.con_score,
        int_score=stats.int_score,
        wis_score=stats.wis_score,
        cha_score=stats.cha_score,
        special_traits_text=_format_special_traits(abilities.special_traits),
        actions_text=_format_actions(abilities),
        bonus_actions_text="",
        reactions_text="",
        legendary_actions_text=_format_legendary_actions(abilities, stats, name),
        lair_actions_text=_format_lair_actions(abilities, name),
        characteristics_text=(
            f"A fearsome {name} ({monster.combat_role_name} archetype) "
            "generated by Monster Factory."
        ),
    )
