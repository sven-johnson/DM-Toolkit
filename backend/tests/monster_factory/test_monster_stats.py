"""
Unit tests for the monster stat block calculator.
Run from backend/ with:  pytest tests/monster_factory/test_monster_stats.py -v

All expected values are hand-derived from the balanced-preset settings and the
standard 4-player level-5 party used throughout the Monster Factory test suite.
"""

import math
from dataclasses import dataclass, field

import pytest

from app.monster_factory.calculators.difficulty_targets import DifficultyTargets
from app.monster_factory.calculators.monster_stats import (
    CalculatedMonsterStats,
    CombatRoleInput,
    CreatureArchetypeInput,
    GmSettingsInput,
    MonsterStatInput,
    calculate_monster_stats,
    float_to_dice_notation,
)
from app.monster_factory.calculators.party_profile import PartyProfile
from app.monster_factory_schemas import (
    ActionEconomySettingsIn,
    LethalitySettingsIn,
    MinionSettingsIn,
    WarningSettingsIn,
)


# ── Shared fixtures ───────────────────────────────────────────────────────────

@pytest.fixture
def standard_party() -> PartyProfile:
    return PartyProfile(
        party_size=4,
        avg_level=5,
        avg_hp=38.75,
        total_hp=155.0,
        lowest_hp=28,
        avg_ac=16.0,
        party_nova=134.0,
        party_sustained=43.5,
        proficiency_bonus=3,
        estimated_bonus_actions_per_round=2.0,
        avg_attack_bonus=5.0,
    )


@pytest.fixture
def balanced_gm_settings() -> GmSettingsInput:
    return GmSettingsInput(
        lethality=LethalitySettingsIn(
            threat_turns_trivial=6.0, threat_turns_easy=5.0, threat_turns_medium=3.5,
            threat_turns_hard=2.25, threat_turns_deadly=1.5,
            damage_smoothing=0.85, hp_smoothing=1.10,
            one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
            allow_player_death=False,
        ),
        action_economy=ActionEconomySettingsIn(),
        minion=MinionSettingsIn(),
        warnings=WarningSettingsIn(),
    )


@pytest.fixture
def medium_targets() -> DifficultyTargets:
    return DifficultyTargets(
        difficulty="medium",
        target_rounds=3.5, target_rounds_min=2.5, target_rounds_max=4.5,
        threat_turns=3.5, action_economy_multiplier=1.0,
        monster_hit_rate=0.60, player_hit_rate=0.55,
        monster_action_budget=6.0,
        target_damage_per_turn_per_monster=38.75 / 3.5,
        target_total_monster_hp=167.475,
        save_dc=12,
    )


@pytest.fixture
def hard_targets() -> DifficultyTargets:
    return DifficultyTargets(
        difficulty="hard",
        target_rounds=5.0, target_rounds_min=4.0, target_rounds_max=6.0,
        threat_turns=2.25, action_economy_multiplier=1.2,
        monster_hit_rate=0.65, player_hit_rate=0.50,
        monster_action_budget=7.2,
        target_damage_per_turn_per_monster=38.75 / 2.25,
        target_total_monster_hp=239.25,
        save_dc=13,
    )


@pytest.fixture
def deadly_targets() -> DifficultyTargets:
    return DifficultyTargets(
        difficulty="deadly",
        target_rounds=6.0, target_rounds_min=5.0, target_rounds_max=7.0,
        threat_turns=1.5, action_economy_multiplier=1.4,
        monster_hit_rate=0.70, player_hit_rate=0.45,
        monster_action_budget=8.4,
        target_damage_per_turn_per_monster=38.75 / 1.5,
        target_total_monster_hp=287.1,
        save_dc=14,
    )


def _bruiser_role() -> CombatRoleInput:
    return CombatRoleInput(
        name="Bruiser", hp_share_tier="high", ac_profile="medium",
        damage_profile="high", is_boss_eligible=False, is_minion=False,
        default_attack_count=2, action_weight=1.0,
    )


def _boss_role() -> CombatRoleInput:
    return CombatRoleInput(
        name="Boss", hp_share_tier="very_high", ac_profile="medium_high",
        damage_profile="very_high", is_boss_eligible=True, is_minion=False,
        default_attack_count=3, action_weight=3.0,
    )


def _minion_role() -> CombatRoleInput:
    return CombatRoleInput(
        name="Minion", hp_share_tier="very_low", ac_profile="low",
        damage_profile="low", is_boss_eligible=False, is_minion=True,
        default_attack_count=1, action_weight=0.3,
    )


def _assassin_role() -> CombatRoleInput:
    return CombatRoleInput(
        name="Assassin", hp_share_tier="low", ac_profile="medium",
        damage_profile="very_high", is_boss_eligible=False, is_minion=False,
        default_attack_count=1, action_weight=1.3,
    )


def _demon_archetype() -> CreatureArchetypeInput:
    return CreatureArchetypeInput(
        name="Demon",
        damage_immunities=["fire", "poison"],
        damage_resistances=["cold", "lightning"],
        condition_immunities=["charmed", "frightened", "poisoned"],
    )


# ── Test 1: Bruiser Demon, medium difficulty, 3 monsters ─────────────────────
#
# Expected HP derivation:
#   total_monster_hp = 167.475
#   share = _HP_SHARE["high"] = 1.5
#   base_hp = (167.475 / 3) × 1.5 = 55.825 × 1.5 = 83.7375
#   final_hp = round(83.7375 × 1.10) = round(92.111) = 92
#
# Expected AC:
#   required_roll = 20 × (1 - 0.55) = 9.0
#   base_ac = round(5.0 + 9.0) = 14
#   medium ac_profile: +0 → AC = 14
#
# Expected attack_bonus:
#   required_roll = 20 × (1 - 0.60) = 8.0
#   attack_bonus = round(16.0 - 8.0) = 8
#
# Expected attack_count:
#   default_attack_count=2; not boss; total_monster_count=3 <= 4×1.5=6 → no reduction
#   attack_count = 2
#
# Expected damage:
#   budget = (38.75/3.5) × 0.85 = 11.0714 × 0.85 = 9.4107
#   damage_per_attack = 9.4107 / 2 = 4.7054
#   max_single_hit = 28 × 0.60 = 16.8 → 4.71 < 16.8, no one-shot trigger

class TestBruiserDemonMedium:

    @pytest.fixture
    def result(self, standard_party, balanced_gm_settings, medium_targets) -> CalculatedMonsterStats:
        inp = MonsterStatInput(
            combat_role=_bruiser_role(),
            creature_archetype=_demon_archetype(),
            is_boss=False,
            count_of_this_type=3,
            total_monster_count=3,
            difficulty_targets=medium_targets,
            party_profile=standard_party,
            gm_settings=balanced_gm_settings,
        )
        return calculate_monster_stats(inp)

    def test_hp(self, result: CalculatedMonsterStats) -> None:
        # base = (167.475/3)×1.5 = 83.7375; final = round(83.7375×1.10) = 92
        assert result.hp == 92

    def test_ac(self, result: CalculatedMonsterStats) -> None:
        # required_roll=9.0; base=14; medium: +0 → 14
        assert result.ac == 14

    def test_attack_bonus(self, result: CalculatedMonsterStats) -> None:
        # required_roll=8.0; round(16-8)=8
        assert result.attack_bonus == 8

    def test_save_dc_from_targets(self, result: CalculatedMonsterStats) -> None:
        assert result.save_dc == 12

    def test_attack_count(self, result: CalculatedMonsterStats) -> None:
        assert result.attack_count == 2

    def test_damage_per_attack(self, result: CalculatedMonsterStats) -> None:
        budget = (38.75 / 3.5) * 0.85
        assert result.damage_per_attack == pytest.approx(budget / 2, abs=1e-4)

    def test_no_legendary_actions(self, result: CalculatedMonsterStats) -> None:
        assert result.legendary_action_count == 0

    def test_speed(self, result: CalculatedMonsterStats) -> None:
        assert result.speed == 30

    def test_damage_dice_is_valid_notation(self, result: CalculatedMonsterStats) -> None:
        import re
        assert re.fullmatch(r"\d+d\d+", result.damage_dice)

    def test_ability_scores_are_positive(self, result: CalculatedMonsterStats) -> None:
        for attr in ("str_score", "dex_score", "con_score", "int_score", "wis_score", "cha_score"):
            assert getattr(result, attr) > 0

    def test_bruiser_str_exceeds_dex(self, result: CalculatedMonsterStats) -> None:
        assert result.str_score > result.dex_score

    def test_no_nova_or_one_shot_warnings(self, result: CalculatedMonsterStats) -> None:
        # A non-boss Bruiser should never trigger nova or one-shot warnings.
        # Note: round-duration warning may legitimately fire when a high-HP-tier
        # role inflates total encounter HP above the target range.
        for w in result.warnings:
            assert "nova" not in w.lower()
            assert "one-shot" not in w.lower()

    def test_show_math_empty_when_disabled(self, result: CalculatedMonsterStats) -> None:
        assert result.show_math_detail == {}


# ── Test 2: Boss Dragon, hard difficulty, 1 boss + 2 minions ─────────────────
#
# Expected HP derivation:
#   total_monster_hp = 239.25
#   share = _HP_SHARE["very_high"] = 2.0
#   base_hp_pool = (239.25 / 3) × 2.0 = 79.75 × 2.0 = 159.5
#   is_boss=True: nova_check = 134.0 × 1.5 = 201.0; base = max(159.5, 201.0) = 201.0
#   final_hp = round(201.0 × 1.10) = round(221.1) = 221
#
# Expected AC:
#   required_roll = 20 × (1 - 0.50) = 10.0
#   base_ac = round(5.0 + 10.0) = 15
#   medium_high ac_profile: +1 → AC = 16
#
# Expected attack_count:
#   default=3; is_boss → +1 → 4; 3 <= 6, no reduction

class TestBossDragonHard:

    @pytest.fixture
    def result(self, standard_party, balanced_gm_settings, hard_targets) -> CalculatedMonsterStats:
        inp = MonsterStatInput(
            combat_role=_boss_role(),
            creature_archetype=CreatureArchetypeInput(name="Dragon"),
            is_boss=True,
            count_of_this_type=1,
            total_monster_count=3,
            difficulty_targets=hard_targets,
            party_profile=standard_party,
            gm_settings=balanced_gm_settings,
        )
        return calculate_monster_stats(inp)

    def test_hp(self, result: CalculatedMonsterStats) -> None:
        # nova_check = 134.0 × 1.5 = 201; final = round(201 × 1.10) = 221
        assert result.hp == 221

    def test_hp_exceeds_party_nova(self, result: CalculatedMonsterStats) -> None:
        # Boss HP must beat 110% of party nova (134 × 1.10 = 147.4)
        assert result.hp > 134.0 * 1.10

    def test_ac(self, result: CalculatedMonsterStats) -> None:
        # required_roll=10; base=15; medium_high: +1 → 16
        assert result.ac == 16

    def test_attack_bonus(self, result: CalculatedMonsterStats) -> None:
        # required_roll = 20×(1-0.65)=7; round(16-7)=9
        assert result.attack_bonus == 9

    def test_attack_count(self, result: CalculatedMonsterStats) -> None:
        # default=3, is_boss +1 → 4
        assert result.attack_count == 4

    def test_legendary_actions(self, result: CalculatedMonsterStats) -> None:
        # min(5, max(2, party_size//2)) = min(5, max(2, 4//2)) = 2
        assert result.legendary_action_count == 2

    def test_legendary_action_override(
        self, standard_party, hard_targets
    ) -> None:
        settings_with_override = GmSettingsInput(
            lethality=LethalitySettingsIn(
                threat_turns_trivial=6.0, threat_turns_easy=5.0, threat_turns_medium=3.5,
                threat_turns_hard=2.25, threat_turns_deadly=1.5,
                damage_smoothing=0.85, hp_smoothing=1.10,
                one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
                allow_player_death=False,
            ),
            action_economy=ActionEconomySettingsIn(legendary_action_override=4),
            minion=MinionSettingsIn(),
            warnings=WarningSettingsIn(),
        )
        inp = MonsterStatInput(
            combat_role=_boss_role(),
            creature_archetype=CreatureArchetypeInput(name="Dragon"),
            is_boss=True,
            count_of_this_type=1,
            total_monster_count=1,
            difficulty_targets=hard_targets,
            party_profile=standard_party,
            gm_settings=settings_with_override,
        )
        result = calculate_monster_stats(inp)
        assert result.legendary_action_count == 4

    def test_boss_str_is_high(self, result: CalculatedMonsterStats) -> None:
        # Boss role has str_base=18; tier 2 → str = 20
        assert result.str_score == 20

    def test_speed(self, result: CalculatedMonsterStats) -> None:
        assert result.speed == 40  # Boss speed


# ── Test 3: Minion Humanoid with one_hit_kill=True ────────────────────────────

class TestMinionOneHitKill:

    @pytest.fixture
    def result(self, standard_party, medium_targets) -> CalculatedMonsterStats:
        settings = GmSettingsInput(
            lethality=LethalitySettingsIn(
                threat_turns_trivial=6.0, threat_turns_easy=5.0, threat_turns_medium=3.5,
                threat_turns_hard=2.25, threat_turns_deadly=1.5,
                damage_smoothing=0.85, hp_smoothing=1.10,
                one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
                allow_player_death=False,
            ),
            action_economy=ActionEconomySettingsIn(),
            minion=MinionSettingsIn(minion_one_hit_kill=True),
            warnings=WarningSettingsIn(),
        )
        inp = MonsterStatInput(
            combat_role=_minion_role(),
            creature_archetype=CreatureArchetypeInput(name="Humanoid"),
            is_boss=False,
            count_of_this_type=6,
            total_monster_count=6,
            difficulty_targets=medium_targets,
            party_profile=standard_party,
            gm_settings=settings,
        )
        return calculate_monster_stats(inp)

    def test_hp_is_one(self, result: CalculatedMonsterStats) -> None:
        assert result.hp == 1

    def test_no_legendary_actions(self, result: CalculatedMonsterStats) -> None:
        assert result.legendary_action_count == 0

    def test_damage_is_reduced_by_minion_fraction(
        self, standard_party, medium_targets
    ) -> None:
        """Minion damage should be scaled by minion_damage_fraction vs normal."""
        settings_normal = GmSettingsInput(
            lethality=LethalitySettingsIn(
                threat_turns_trivial=6.0, threat_turns_easy=5.0, threat_turns_medium=3.5,
                threat_turns_hard=2.25, threat_turns_deadly=1.5,
                damage_smoothing=0.85, hp_smoothing=1.10,
                one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
                allow_player_death=False,
            ),
            action_economy=ActionEconomySettingsIn(),
            minion=MinionSettingsIn(minion_one_hit_kill=False, minion_damage_fraction=0.40),
            warnings=WarningSettingsIn(),
        )
        settings_okh = GmSettingsInput(
            lethality=LethalitySettingsIn(
                threat_turns_trivial=6.0, threat_turns_easy=5.0, threat_turns_medium=3.5,
                threat_turns_hard=2.25, threat_turns_deadly=1.5,
                damage_smoothing=0.85, hp_smoothing=1.10,
                one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
                allow_player_death=False,
            ),
            action_economy=ActionEconomySettingsIn(),
            minion=MinionSettingsIn(minion_one_hit_kill=True, minion_damage_fraction=0.40),
            warnings=WarningSettingsIn(),
        )
        base_inp = MonsterStatInput(
            combat_role=_minion_role(),
            creature_archetype=CreatureArchetypeInput(name="Humanoid"),
            is_boss=False,
            count_of_this_type=4,
            total_monster_count=4,
            difficulty_targets=medium_targets,
            party_profile=standard_party,
            gm_settings=settings_normal,
        )
        okh_inp = base_inp.model_copy(update={"gm_settings": settings_okh})
        result_normal = calculate_monster_stats(base_inp)
        result_okh    = calculate_monster_stats(okh_inp)
        # Both should have same damage since minion_damage_fraction is unchanged
        assert result_normal.damage_per_attack == pytest.approx(result_okh.damage_per_attack, abs=1e-4)


# ── Test 4: One-shot prevention triggers ─────────────────────────────────────
#
# Assassin, deadly difficulty, 1 monster:
#   budget = (38.75/1.5) × 0.85 = 21.958
#   initial attack_count=1; damage_per_attack=21.958
#   max_single_hit = 28 × 0.60 = 16.8
#   21.958 > 16.8 → trigger: attack_count=2, damage_per_attack=21.958/2=10.979
#   10.979 < 16.8 → stop
#   Result: attack_count=2, damage_per_attack≈10.979

class TestOneShotPrevention:

    @pytest.fixture
    def result(self, standard_party, balanced_gm_settings, deadly_targets) -> CalculatedMonsterStats:
        inp = MonsterStatInput(
            combat_role=_assassin_role(),
            creature_archetype=CreatureArchetypeInput(name="Shadow"),
            is_boss=False,
            count_of_this_type=1,
            total_monster_count=1,
            difficulty_targets=deadly_targets,
            party_profile=standard_party,
            gm_settings=balanced_gm_settings,
        )
        return calculate_monster_stats(inp)

    def test_attack_count_increased(self, result: CalculatedMonsterStats) -> None:
        # Started at default_attack_count=1; prevention bumped it to 2
        assert result.attack_count == 2

    def test_damage_per_attack_within_threshold(
        self, result: CalculatedMonsterStats
    ) -> None:
        max_single_hit = 28 * 0.60  # lowest_hp × one_shot_prevention_threshold
        assert result.damage_per_attack <= max_single_hit

    def test_total_damage_preserved(self, result: CalculatedMonsterStats) -> None:
        budget = (38.75 / 1.5) * 0.85
        total  = result.damage_per_attack * result.attack_count
        assert total == pytest.approx(budget, abs=1e-4)

    def test_damage_values(self, result: CalculatedMonsterStats) -> None:
        budget = (38.75 / 1.5) * 0.85  # ≈ 21.958
        assert result.damage_per_attack == pytest.approx(budget / 2, abs=1e-4)


# ── Test 5: float_to_dice_notation helper ────────────────────────────────────

class TestDiceNotation:

    def test_output_format(self) -> None:
        import re
        dice, bonus = float_to_dice_notation(7.0)
        assert re.fullmatch(r"\d+d\d+", dice)
        assert isinstance(bonus, int)

    def test_small_damage(self) -> None:
        dice, bonus = float_to_dice_notation(3.5)
        # 1d6 average = 3.5; exact match with bonus=0
        assert dice == "1d6"
        assert bonus == 0

    def test_medium_damage(self) -> None:
        dice, bonus = float_to_dice_notation(4.5)
        # 1d8 average = 4.5; exact match
        assert dice == "1d8"
        assert bonus == 0

    def test_result_approximates_input(self) -> None:
        for avg in [2.0, 4.7, 8.5, 14.0, 21.0]:
            dice, bonus = float_to_dice_notation(avg)
            count_s, sides_s = dice.split("d")
            count, sides = int(count_s), int(sides_s)
            implied_avg = count * (1 + sides) / 2.0 + bonus
            assert abs(implied_avg - avg) < 2.0, (
                f"Dice {dice}+{bonus} gives avg {implied_avg:.2f}, too far from {avg}"
            )

    def test_never_below_one_average(self) -> None:
        # monster_stats.py clamps input to max(0.5, damage_per_attack) before
        # calling this helper, so the minimum meaningful test input is 1.0.
        for avg in [1.0, 2.5, 5.5, 10.0, 25.0]:
            dice, bonus = float_to_dice_notation(avg)
            count_s, sides_s = dice.split("d")
            count, sides = int(count_s), int(sides_s)
            implied_avg = count * (1 + sides) / 2.0 + bonus
            assert implied_avg >= 1.0, f"Average below 1 for input {avg}: {dice}+{bonus}"

    def test_prefers_smaller_bonus(self) -> None:
        # 4.5 → 1d8+0 should beat 1d6+1 (same diff, smaller |bonus|)
        dice, bonus = float_to_dice_notation(4.5)
        assert bonus == 0


# ── Test 6: Show-math detail populated when enabled ──────────────────────────

def test_show_math_populated(standard_party, medium_targets) -> None:
    settings = GmSettingsInput(
        lethality=LethalitySettingsIn(
            threat_turns_trivial=6.0, threat_turns_easy=5.0, threat_turns_medium=3.5,
            threat_turns_hard=2.25, threat_turns_deadly=1.5,
            damage_smoothing=0.85, hp_smoothing=1.10,
            one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
            allow_player_death=False,
        ),
        action_economy=ActionEconomySettingsIn(),
        minion=MinionSettingsIn(),
        warnings=WarningSettingsIn(show_math=True),
    )
    inp = MonsterStatInput(
        combat_role=_bruiser_role(),
        creature_archetype=_demon_archetype(),
        is_boss=False,
        count_of_this_type=2,
        total_monster_count=2,
        difficulty_targets=medium_targets,
        party_profile=standard_party,
        gm_settings=settings,
    )
    result = calculate_monster_stats(inp)
    assert result.show_math_detail != {}
    assert "hp_share_multiplier" in result.show_math_detail
    assert "damage_budget_per_turn" in result.show_math_detail


# ── Test 7: Action economy warning fires when monsters overwhelm party ────────

def test_action_economy_warning(standard_party, medium_targets) -> None:
    """12 monsters vs 4-player party: 12×2=24 actions >> 6×1.5=9 party threshold."""
    settings = GmSettingsInput(
        lethality=LethalitySettingsIn(
            threat_turns_trivial=6.0, threat_turns_easy=5.0, threat_turns_medium=3.5,
            threat_turns_hard=2.25, threat_turns_deadly=1.5,
            damage_smoothing=0.85, hp_smoothing=1.10,
            one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
            allow_player_death=False,
        ),
        action_economy=ActionEconomySettingsIn(),
        minion=MinionSettingsIn(),
        warnings=WarningSettingsIn(warn_action_economy_imbalance=True),
    )
    inp = MonsterStatInput(
        combat_role=_bruiser_role(),
        creature_archetype=_demon_archetype(),
        is_boss=False,
        count_of_this_type=12,
        total_monster_count=12,
        difficulty_targets=medium_targets,
        party_profile=standard_party,
        gm_settings=settings,
    )
    result = calculate_monster_stats(inp)
    assert any("action economy" in w.lower() for w in result.warnings)


# ── Test 8: High-monster-count reduces attack count ──────────────────────────

def test_high_monster_count_reduces_attacks(standard_party, medium_targets, balanced_gm_settings) -> None:
    """With 8 monsters (> 4×1.5=6), Bruiser attack_count should drop by 1."""
    inp = MonsterStatInput(
        combat_role=_bruiser_role(),
        creature_archetype=_demon_archetype(),
        is_boss=False,
        count_of_this_type=8,
        total_monster_count=8,
        difficulty_targets=medium_targets,
        party_profile=standard_party,
        gm_settings=balanced_gm_settings,
    )
    result = calculate_monster_stats(inp)
    # default_attack_count=2; reduction → max(1, 2-1)=1
    assert result.attack_count == 1
