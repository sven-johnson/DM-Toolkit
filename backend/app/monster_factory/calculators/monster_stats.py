from __future__ import annotations

import math
from typing import Any

from pydantic import BaseModel, Field

from ...monster_factory_schemas import (
    ActionEconomySettingsIn,
    LethalitySettingsIn,
    MinionSettingsIn,
    WarningSettingsIn,
)
from .difficulty_targets import DifficultyTargets
from .party_profile import PartyProfile


# ── Input sub-models ──────────────────────────────────────────────────────────

class CombatRoleInput(BaseModel):
    name: str
    hp_share_tier:       str    # very_low / low / medium / high / very_high
    ac_profile:          str    # low / medium_low / medium / medium_high / high
    damage_profile:      str    # very_low / low / medium / high / very_high (unused in current formulas)
    is_boss_eligible:    bool
    is_minion:           bool
    default_attack_count: int
    action_weight:       float


class CreatureArchetypeInput(BaseModel):
    name: str
    damage_immunities:   list[str] | None = None
    damage_resistances:  list[str] | None = None
    condition_immunities: list[str] | None = None


class GmSettingsInput(BaseModel):
    lethality:     LethalitySettingsIn
    action_economy: ActionEconomySettingsIn
    minion:        MinionSettingsIn
    warnings:      WarningSettingsIn


class MonsterStatInput(BaseModel):
    combat_role:         CombatRoleInput
    creature_archetype:  CreatureArchetypeInput | None = None
    is_boss:             bool = False
    count_of_this_type:  int = Field(1, ge=1)
    total_monster_count: int = Field(1, ge=1)
    difficulty_targets:  DifficultyTargets
    party_profile:       PartyProfile
    gm_settings:         GmSettingsInput


# ── Output schema ─────────────────────────────────────────────────────────────

class CalculatedMonsterStats(BaseModel):
    hp:                    int
    ac:                    int
    attack_bonus:          int
    save_dc:               int
    damage_per_attack:     float
    attack_count:          int
    damage_dice:           str
    damage_bonus:          int
    speed:                 int
    str_score:             int
    dex_score:             int
    con_score:             int
    int_score:             int
    wis_score:             int
    cha_score:             int
    legendary_action_count: int
    warnings:              list[str]
    show_math_detail:      dict[str, Any]


# ── Constants ─────────────────────────────────────────────────────────────────

_HP_SHARE: dict[str, float] = {
    "very_low": 0.4, "low": 0.6, "medium": 1.0, "high": 1.5, "very_high": 2.0,
}

_AC_ADJUST: dict[str, int] = {
    "low": -2, "medium_low": -1, "medium": 0, "medium_high": 1, "high": 2,
}

_ROLE_SPEED: dict[str, int] = {
    "Bruiser":    30, "Tank":       30, "Skirmisher": 40, "Archer":  35,
    "Caster":     30, "Controller": 30, "Assassin":   35, "Support": 30,
    "Minion":     25, "Boss":       40, "Elite":      35,
}

# Base ability scores at level tier 1 (levels 1-4); CON is overridden by HP back-calc
_ROLE_ABILITY_BASES: dict[str, dict[str, int]] = {
    "Bruiser":    {"str": 16, "dex": 10, "int":  8, "wis": 10, "cha":  8},
    "Tank":       {"str": 14, "dex":  8, "int":  8, "wis": 10, "cha":  8},
    "Skirmisher": {"str": 12, "dex": 16, "int": 10, "wis": 12, "cha":  8},
    "Archer":     {"str": 10, "dex": 16, "int": 10, "wis": 12, "cha":  8},
    "Caster":     {"str":  8, "dex": 12, "int": 16, "wis": 14, "cha": 12},
    "Controller": {"str": 10, "dex": 12, "int": 14, "wis": 14, "cha": 10},
    "Assassin":   {"str": 12, "dex": 16, "int": 12, "wis": 12, "cha": 10},
    "Support":    {"str": 10, "dex": 12, "int": 12, "wis": 16, "cha": 12},
    "Minion":     {"str": 10, "dex": 10, "int":  6, "wis":  8, "cha":  6},
    "Boss":       {"str": 18, "dex": 10, "int": 14, "wis": 12, "cha": 14},
    "Elite":      {"str": 16, "dex": 12, "int": 10, "wis": 10, "cha": 10},
}
_DEFAULT_ROLE_ABILITY: dict[str, int] = {
    "str": 10, "dex": 10, "int": 10, "wis": 10, "cha": 10,
}

# Added to every non-CON ability score per tier above 1
_TIER_SCORE_BONUS: dict[int, int] = {1: 0, 2: 2, 3: 4, 4: 6}

_DICE_SIDES = [4, 6, 8, 10, 12]
_DICE_AVG: dict[int, float] = {s: (1 + s) / 2.0 for s in _DICE_SIDES}


# ── Helpers ───────────────────────────────────────────────────────────────────

def _level_tier(avg_level: float) -> int:
    if avg_level <= 4:  return 1
    if avg_level <= 10: return 2
    if avg_level <= 16: return 3
    return 4


def float_to_dice_notation(avg_damage: float) -> tuple[str, int]:
    """
    Return (dice_string, bonus) whose expected value is closest to avg_damage.
    Tries all combos of 1–6 dice × d4/d6/d8/d10/d12; prefers smaller |bonus| as
    tiebreaker; result is never negative on average.
    """
    best_str   = "1d4"
    best_bonus = max(0, round(avg_damage - 2.5))
    best_diff  = abs((2.5 + best_bonus) - avg_damage)
    best_bonus_abs = abs(best_bonus)

    for sides in _DICE_SIDES:
        die_avg = _DICE_AVG[sides]
        for count in range(1, 7):
            pool_avg = count * die_avg
            bonus    = round(avg_damage - pool_avg)
            # Require the expected value to be at least 1 (minimum die face is 1)
            if pool_avg + bonus < 1.0:
                continue
            diff = abs((pool_avg + bonus) - avg_damage)
            better = diff < best_diff or (
                diff == best_diff and abs(bonus) < best_bonus_abs
            )
            if better:
                best_diff      = diff
                best_bonus_abs = abs(bonus)
                best_str       = f"{count}d{sides}"
                best_bonus     = bonus

    return best_str, best_bonus


def _compute_hp(
    inp: MonsterStatInput,
    hp_smoothing: float,
    boss_nova_multiplier: float,
) -> int:
    role  = inp.combat_role
    dt    = inp.difficulty_targets
    pp    = inp.party_profile
    m     = inp.gm_settings.minion

    share = _HP_SHARE.get(role.hp_share_tier, 1.0)
    base  = (dt.target_total_monster_hp / inp.total_monster_count) * share

    if inp.is_boss:
        base = max(base, pp.party_nova * boss_nova_multiplier)

    if role.is_minion and m.minion_one_hit_kill:
        return 1
    if role.is_minion:
        return max(1, round(base * m.minion_hp_fraction * hp_smoothing))

    return max(1, round(base * hp_smoothing))


def _compute_ac(
    avg_attack_bonus: float,
    player_hit_rate: float,
    ac_profile: str,
) -> int:
    required_roll = 20.0 * (1.0 - player_hit_rate)
    base_ac       = round(avg_attack_bonus + required_roll)
    return base_ac + _AC_ADJUST.get(ac_profile, 0)


def _compute_attack_bonus(avg_ac: float, monster_hit_rate: float) -> int:
    required_roll = 20.0 * (1.0 - monster_hit_rate)
    return round(avg_ac - required_roll)


def _compute_damage(
    inp: MonsterStatInput,
    base_attack_count: int,
    damage_smoothing: float,
    one_shot_threshold: float,
) -> tuple[float, int]:
    """Return (damage_per_attack, final_attack_count) after one-shot check."""
    dt = inp.difficulty_targets
    pp = inp.party_profile

    budget = dt.target_damage_per_turn_per_monster * damage_smoothing
    if inp.combat_role.is_minion:
        budget *= inp.gm_settings.minion.minion_damage_fraction

    attack_count = base_attack_count
    dmg_per_atk  = budget / max(1, attack_count)

    # One-shot prevention: if a single attack exceeds the threshold, spread damage
    max_single_hit = pp.lowest_hp * one_shot_threshold
    while dmg_per_atk > max_single_hit and attack_count < 4:
        attack_count += 1
        dmg_per_atk  = budget / attack_count

    return dmg_per_atk, attack_count


def _compute_ability_scores(
    role_name: str,
    final_hp: int,
    avg_level: float,
) -> dict[str, int]:
    tier   = _level_tier(avg_level)
    bonus  = _TIER_SCORE_BONUS[tier]
    bases  = _ROLE_ABILITY_BASES.get(role_name, _DEFAULT_ROLE_ABILITY)

    str_s  = bases["str"] + bonus
    dex_s  = bases["dex"] + bonus
    int_s  = bases["int"] + bonus
    wis_s  = bases["wis"] + bonus
    cha_s  = bases["cha"] + bonus

    # CON: back-calculate from final HP.
    # Assume ~2 hit dice per party level (monsters have more HD than PCs at same tier).
    # Average d8 = 4.5; CON_mod = HP/HD - 4.5
    effective_hd = max(1, avg_level * 2)
    raw_con_mod  = (final_hp / effective_hd) - 4.5
    con_mod      = max(-4, min(5, round(raw_con_mod)))
    con_s        = max(6, min(22, 10 + 2 * con_mod))

    return {
        "str": str_s, "dex": dex_s, "con": con_s,
        "int": int_s, "wis": wis_s, "cha": cha_s,
    }


def _compute_legendary_actions(
    is_boss: bool,
    party_size: int,
    legendary_action_override: int | None,
) -> int:
    if not is_boss:
        return 0
    if legendary_action_override is not None:
        return legendary_action_override
    return min(5, max(2, party_size // 2))


def _generate_warnings(
    inp: MonsterStatInput,
    final_hp: int,
    damage_per_attack: float,
    attack_count: int,
) -> list[str]:
    w   = inp.gm_settings.warnings
    lth = inp.gm_settings.lethality
    dt  = inp.difficulty_targets
    pp  = inp.party_profile
    msgs: list[str] = []

    if w.warn_nova_threshold and inp.is_boss:
        threshold = pp.party_nova * 1.10
        if final_hp < threshold:
            msgs.append(
                f"Boss HP ({final_hp}) is below 110% of combined party nova "
                f"({threshold:.0f}). Boss may be burst-killed on round one."
            )

    if w.warn_one_shot_risk:
        max_hit = pp.lowest_hp * lth.one_shot_prevention_threshold
        if damage_per_attack > max_hit:
            msgs.append(
                f"Single-attack damage ({damage_per_attack:.1f}) exceeds "
                f"one-shot threshold ({max_hit:.1f}) for the lowest-HP character "
                f"({pp.lowest_hp} HP)."
            )

    if w.warn_action_economy_imbalance:
        party_actions   = pp.party_size + pp.estimated_bonus_actions_per_round
        monster_actions = inp.total_monster_count * attack_count
        limit = party_actions * 1.5
        if monster_actions > limit:
            msgs.append(
                f"Estimated total monster actions ({monster_actions}) exceeds "
                f"1.5× party actions ({limit:.1f}). Action economy heavily "
                "favors monsters."
            )

    if w.warn_round_duration_deviation:
        # Estimate total encounter HP and compare implied duration to target range
        estimated_total_hp = final_hp * inp.total_monster_count
        expected_rounds    = estimated_total_hp / max(0.1, pp.party_sustained)
        if expected_rounds < dt.target_rounds_min or expected_rounds > dt.target_rounds_max:
            msgs.append(
                f"Estimated encounter duration ({expected_rounds:.1f} rounds) is "
                f"outside target range [{dt.target_rounds_min:.1f}, "
                f"{dt.target_rounds_max:.1f}]."
            )

    return msgs


# ── Main calculator ───────────────────────────────────────────────────────────

def calculate_monster_stats(inp: MonsterStatInput) -> CalculatedMonsterStats:
    """
    Calculate the full numeric stat block for one monster type given its role,
    the encounter context, and the active GM profile settings.

    All computation is pure — no database access.
    """
    role  = inp.combat_role
    dt    = inp.difficulty_targets
    pp    = inp.party_profile
    lth   = inp.gm_settings.lethality
    ae    = inp.gm_settings.action_economy

    # ── HP ────────────────────────────────────────────────────────────────────
    final_hp = _compute_hp(inp, lth.hp_smoothing, lth.boss_nova_multiplier)

    # ── AC ────────────────────────────────────────────────────────────────────
    monster_ac = _compute_ac(pp.avg_attack_bonus, dt.player_hit_rate, role.ac_profile)

    # ── Attack bonus ──────────────────────────────────────────────────────────
    attack_bonus = _compute_attack_bonus(pp.avg_ac, dt.monster_hit_rate)

    # ── Attack count (base, before one-shot prevention) ───────────────────────
    base_attack_count = role.default_attack_count
    if inp.is_boss:
        base_attack_count += 1
    if inp.total_monster_count > pp.party_size * 1.5:
        base_attack_count = max(1, base_attack_count - 1)

    # ── Damage ────────────────────────────────────────────────────────────────
    damage_per_attack, attack_count = _compute_damage(
        inp, base_attack_count, lth.damage_smoothing, lth.one_shot_prevention_threshold
    )

    # ── Dice notation ─────────────────────────────────────────────────────────
    damage_dice, damage_bonus = float_to_dice_notation(max(0.5, damage_per_attack))

    # ── Speed ─────────────────────────────────────────────────────────────────
    speed = _ROLE_SPEED.get(role.name, 30)

    # ── Ability scores ────────────────────────────────────────────────────────
    scores = _compute_ability_scores(role.name, final_hp, pp.avg_level)

    # ── Legendary actions ─────────────────────────────────────────────────────
    legendary_count = _compute_legendary_actions(
        inp.is_boss, pp.party_size, ae.legendary_action_override
    )

    # ── Warnings ──────────────────────────────────────────────────────────────
    warnings = _generate_warnings(inp, final_hp, damage_per_attack, attack_count)

    # ── Show-math detail ──────────────────────────────────────────────────────
    show_math: dict[str, Any] = {}
    if inp.gm_settings.warnings.show_math:
        share_mult = _HP_SHARE.get(role.hp_share_tier, 1.0)
        budget     = dt.target_damage_per_turn_per_monster * lth.damage_smoothing
        show_math  = {
            "hp_share_multiplier":          share_mult,
            "base_hp_before_smoothing":     (dt.target_total_monster_hp / inp.total_monster_count) * share_mult,
            "hp_smoothing_applied":         lth.hp_smoothing,
            "boss_nova_check":              inp.is_boss,
            "damage_budget_per_turn":       budget,
            "base_attack_count":            base_attack_count,
            "one_shot_max_hit":             pp.lowest_hp * lth.one_shot_prevention_threshold,
            "ac_base":                      monster_ac - _AC_ADJUST.get(role.ac_profile, 0),
            "ac_profile_adjustment":        _AC_ADJUST.get(role.ac_profile, 0),
            "required_roll_to_hit_party":   20.0 * (1.0 - dt.player_hit_rate),
            "required_roll_to_hit_monster": 20.0 * (1.0 - dt.monster_hit_rate),
        }

    return CalculatedMonsterStats(
        hp=final_hp,
        ac=monster_ac,
        attack_bonus=attack_bonus,
        save_dc=dt.save_dc,
        damage_per_attack=damage_per_attack,
        attack_count=attack_count,
        damage_dice=damage_dice,
        damage_bonus=damage_bonus,
        speed=speed,
        str_score=scores["str"],
        dex_score=scores["dex"],
        con_score=scores["con"],
        int_score=scores["int"],
        wis_score=scores["wis"],
        cha_score=scores["cha"],
        legendary_action_count=legendary_count,
        warnings=warnings,
        show_math_detail=show_math,
    )
