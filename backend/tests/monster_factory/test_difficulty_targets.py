"""
Unit tests for the difficulty targets calculator.
Run from backend/ with:  pytest tests/monster_factory/test_difficulty_targets.py -v
"""

from dataclasses import dataclass, field

import pytest

from app.monster_factory.calculators.difficulty_targets import (
    DifficultyTargets,
    calculate_difficulty_targets,
)
from app.monster_factory.calculators.party_profile import PartyProfile


# ── Stub settings (balanced preset values) ───────────────────────────────────

@dataclass
class _Lethality:
    threat_turns_trivial: float = 6.0
    threat_turns_easy:    float = 5.0
    threat_turns_medium:  float = 3.5
    threat_turns_hard:    float = 2.25
    threat_turns_deadly:  float = 1.5
    hp_smoothing:         float = 1.10


@dataclass
class _CombatDuration:
    target_rounds_trivial:    float = 1.5
    target_rounds_easy:       float = 2.5
    target_rounds_medium:     float = 3.5
    target_rounds_hard:       float = 5.0
    target_rounds_deadly:     float = 6.0
    round_variance_tolerance: float = 1.0


@dataclass
class _ActionEconomy:
    multiplier_trivial: float = 0.6
    multiplier_easy:    float = 0.8
    multiplier_medium:  float = 1.0
    multiplier_hard:    float = 1.2
    multiplier_deadly:  float = 1.4


@dataclass
class _HitRate:
    monster_hit_rate_trivial: float = 0.40
    monster_hit_rate_easy:    float = 0.50
    monster_hit_rate_medium:  float = 0.60
    monster_hit_rate_hard:    float = 0.65
    monster_hit_rate_deadly:  float = 0.70
    player_hit_rate_trivial:  float = 0.75
    player_hit_rate_easy:     float = 0.65
    player_hit_rate_medium:   float = 0.55
    player_hit_rate_hard:     float = 0.50
    player_hit_rate_deadly:   float = 0.45


@dataclass
class _SavingThrow:
    save_dc_base:                int  = 8
    save_dc_proficiency_scaling: bool = True
    save_dc_difficulty_bonus:    int  = 1


@dataclass
class _GmSettings:
    lethality:       _Lethality       = field(default_factory=_Lethality)
    combat_duration: _CombatDuration  = field(default_factory=_CombatDuration)
    action_economy:  _ActionEconomy   = field(default_factory=_ActionEconomy)
    hit_rate:        _HitRate         = field(default_factory=_HitRate)
    saving_throw:    _SavingThrow     = field(default_factory=_SavingThrow)


# ── Fixtures ──────────────────────────────────────────────────────────────────

@pytest.fixture
def balanced_settings() -> _GmSettings:
    return _GmSettings()


@pytest.fixture
def standard_party() -> PartyProfile:
    """4-player level-5 party from the algorithm spec example (matches party_profile tests)."""
    return PartyProfile(
        party_size=4,
        avg_level=5,
        avg_hp=38.75,       # (40+52+35+28) / 4
        total_hp=155.0,
        lowest_hp=28,
        avg_ac=16.0,
        party_nova=134.0,
        party_sustained=43.5,
        proficiency_bonus=3,
        estimated_bonus_actions_per_round=2.0,  # 4 × 0.5
        avg_attack_bonus=5.0,
    )


# ── Parametrized test: all five difficulty tiers, all output fields ────────────
#
# party_action_equivalents = party_size + estimated_bonus_actions = 4 + 2.0 = 6.0
#
# Per-difficulty derivations (balanced settings, standard party):
#
#  Trivial: rounds=1.5,  threat=6.00,  mult=0.6,  m_hr=0.40,  p_hr=0.75
#           budget=6×0.6=3.6,  dmg/turn=38.75/6=6.458…,  hp=43.5×1.5×1.1=71.775
#           dc_idx=0,  dc=8+3+0=11
#
#  Easy:    rounds=2.5,  threat=5.00,  mult=0.8,  m_hr=0.50,  p_hr=0.65
#           budget=6×0.8=4.8,  dmg/turn=38.75/5=7.75,  hp=43.5×2.5×1.1=119.625
#           dc_idx=0,  dc=8+3+0=11
#
#  Medium:  rounds=3.5,  threat=3.50,  mult=1.0,  m_hr=0.60,  p_hr=0.55
#           budget=6×1.0=6.0,  dmg/turn=38.75/3.5=11.071…,  hp=43.5×3.5×1.1=167.475
#           dc_idx=1,  dc=8+3+1=12
#
#  Hard:    rounds=5.0,  threat=2.25,  mult=1.2,  m_hr=0.65,  p_hr=0.50
#           budget=6×1.2=7.2,  dmg/turn=38.75/2.25=17.222…,  hp=43.5×5×1.1=239.25
#           dc_idx=2,  dc=8+3+2=13
#
#  Deadly:  rounds=6.0,  threat=1.50,  mult=1.4,  m_hr=0.70,  p_hr=0.45
#           budget=6×1.4=8.4,  dmg/turn=38.75/1.5=25.833…,  hp=43.5×6×1.1=287.1
#           dc_idx=3,  dc=8+3+3=14

_EXPECTED: dict[str, dict] = {
    "trivial": {
        "target_rounds":                      1.5,
        "target_rounds_min":                  0.5,
        "target_rounds_max":                  2.5,
        "threat_turns":                       6.0,
        "action_economy_multiplier":          0.6,
        "monster_hit_rate":                   0.40,
        "player_hit_rate":                    0.75,
        "monster_action_budget":              3.6,
        "target_damage_per_turn_per_monster": 38.75 / 6.0,
        "target_total_monster_hp":            71.775,
        "save_dc":                            11,
    },
    "easy": {
        "target_rounds":                      2.5,
        "target_rounds_min":                  1.5,
        "target_rounds_max":                  3.5,
        "threat_turns":                       5.0,
        "action_economy_multiplier":          0.8,
        "monster_hit_rate":                   0.50,
        "player_hit_rate":                    0.65,
        "monster_action_budget":              4.8,
        "target_damage_per_turn_per_monster": 38.75 / 5.0,
        "target_total_monster_hp":            119.625,
        "save_dc":                            11,
    },
    "medium": {
        "target_rounds":                      3.5,
        "target_rounds_min":                  2.5,
        "target_rounds_max":                  4.5,
        "threat_turns":                       3.5,
        "action_economy_multiplier":          1.0,
        "monster_hit_rate":                   0.60,
        "player_hit_rate":                    0.55,
        "monster_action_budget":              6.0,
        "target_damage_per_turn_per_monster": 38.75 / 3.5,
        "target_total_monster_hp":            167.475,
        "save_dc":                            12,
    },
    "hard": {
        "target_rounds":                      5.0,
        "target_rounds_min":                  4.0,
        "target_rounds_max":                  6.0,
        "threat_turns":                       2.25,
        "action_economy_multiplier":          1.2,
        "monster_hit_rate":                   0.65,
        "player_hit_rate":                    0.50,
        "monster_action_budget":              7.2,
        "target_damage_per_turn_per_monster": 38.75 / 2.25,
        "target_total_monster_hp":            239.25,
        "save_dc":                            13,
    },
    "deadly": {
        "target_rounds":                      6.0,
        "target_rounds_min":                  5.0,
        "target_rounds_max":                  7.0,
        "threat_turns":                       1.5,
        "action_economy_multiplier":          1.4,
        "monster_hit_rate":                   0.70,
        "player_hit_rate":                    0.45,
        "monster_action_budget":              8.4,
        "target_damage_per_turn_per_monster": 38.75 / 1.5,
        "target_total_monster_hp":            287.1,
        "save_dc":                            14,
    },
}


@pytest.mark.parametrize("difficulty", ["trivial", "easy", "medium", "hard", "deadly"])
def test_all_fields(
    difficulty: str,
    standard_party: PartyProfile,
    balanced_settings: _GmSettings,
) -> None:
    result: DifficultyTargets = calculate_difficulty_targets(
        difficulty, standard_party, balanced_settings  # type: ignore[arg-type]
    )
    expected = _EXPECTED[difficulty]

    assert result.difficulty == difficulty

    for field_name, exp_val in expected.items():
        actual = getattr(result, field_name)
        assert actual == pytest.approx(exp_val, abs=1e-6), (
            f"[{difficulty}] {field_name}: expected {exp_val}, got {actual}"
        )


# ── Escalating save_dc across all five tiers ─────────────────────────────────

def test_save_dc_escalation(standard_party: PartyProfile, balanced_settings: _GmSettings) -> None:
    """trivial == easy (index 0) < medium < hard < deadly."""
    dcs = {
        d: calculate_difficulty_targets(d, standard_party, balanced_settings).save_dc  # type: ignore[arg-type]
        for d in ("trivial", "easy", "medium", "hard", "deadly")
    }
    assert dcs["trivial"] == dcs["easy"]
    assert dcs["easy"]    <  dcs["medium"]
    assert dcs["medium"]  <  dcs["hard"]
    assert dcs["hard"]    <  dcs["deadly"]


# ── Variance tolerance propagates symmetrically ───────────────────────────────

def test_round_range_symmetry(standard_party: PartyProfile, balanced_settings: _GmSettings) -> None:
    for diff in ("trivial", "easy", "medium", "hard", "deadly"):
        result = calculate_difficulty_targets(diff, standard_party, balanced_settings)  # type: ignore[arg-type]
        mid = result.target_rounds
        assert result.target_rounds_min == pytest.approx(mid - balanced_settings.combat_duration.round_variance_tolerance)
        assert result.target_rounds_max == pytest.approx(mid + balanced_settings.combat_duration.round_variance_tolerance)


# ── save_dc_proficiency_scaling=False omits proficiency bonus ─────────────────

def test_save_dc_no_proficiency_scaling(standard_party: PartyProfile) -> None:
    settings = _GmSettings(saving_throw=_SavingThrow(
        save_dc_base=8,
        save_dc_proficiency_scaling=False,
        save_dc_difficulty_bonus=1,
    ))
    result = calculate_difficulty_targets("medium", standard_party, settings)  # type: ignore[arg-type]
    # Without proficiency: 8 + 0 + (1×1) = 9  (proficiency_bonus=3 is excluded)
    assert result.save_dc == 9


# ── save_dc_difficulty_bonus=0 keeps DC flat across all tiers ─────────────────

def test_save_dc_flat_when_bonus_zero(standard_party: PartyProfile) -> None:
    settings = _GmSettings(saving_throw=_SavingThrow(
        save_dc_base=8,
        save_dc_proficiency_scaling=True,
        save_dc_difficulty_bonus=0,
    ))
    results = [
        calculate_difficulty_targets(d, standard_party, settings).save_dc  # type: ignore[arg-type]
        for d in ("trivial", "easy", "medium", "hard", "deadly")
    ]
    assert all(dc == results[0] for dc in results), (
        f"Expected flat DC=={results[0]} for all tiers, got {results}"
    )


# ── monster_action_budget scales with action economy multiplier ───────────────

def test_monster_action_budget_scaling(standard_party: PartyProfile) -> None:
    """Budget should strictly increase from trivial → deadly."""
    budgets = [
        calculate_difficulty_targets(d, standard_party, _GmSettings()).monster_action_budget  # type: ignore[arg-type]
        for d in ("trivial", "easy", "medium", "hard", "deadly")
    ]
    assert budgets == sorted(budgets), f"Budgets not monotonically increasing: {budgets}"


# ── larger party increases action budget proportionally ──────────────────────

def test_action_budget_scales_with_party_size(balanced_settings: _GmSettings) -> None:
    small = PartyProfile(
        party_size=2, avg_level=5, avg_hp=38.75, total_hp=77.5, lowest_hp=28,
        avg_ac=16.0, party_nova=67.0, party_sustained=21.75, proficiency_bonus=3,
        estimated_bonus_actions_per_round=1.0,  # 2 × 0.5
        avg_attack_bonus=5.0,
    )
    large = PartyProfile(
        party_size=6, avg_level=5, avg_hp=38.75, total_hp=232.5, lowest_hp=28,
        avg_ac=16.0, party_nova=201.0, party_sustained=65.25, proficiency_bonus=3,
        estimated_bonus_actions_per_round=3.0,  # 6 × 0.5
        avg_attack_bonus=5.0,
    )

    small_budget = calculate_difficulty_targets("medium", small, balanced_settings).monster_action_budget  # type: ignore[arg-type]
    large_budget = calculate_difficulty_targets("medium", large, balanced_settings).monster_action_budget  # type: ignore[arg-type]

    # small: (2+1.0)×1.0=3.0   large: (6+3.0)×1.0=9.0
    assert small_budget == pytest.approx(3.0)
    assert large_budget == pytest.approx(9.0)
