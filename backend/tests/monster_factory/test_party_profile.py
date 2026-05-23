"""
Unit tests for the party profile calculator.
Run from backend/ with:  pytest tests/monster_factory/test_party_profile.py -v
"""

from dataclasses import dataclass

import pytest

from app.monster_factory.calculators.party_profile import (
    PartyMember,
    PartyProfile,
    PartyProfileInput,
    calculate_party_profile,
    proficiency_bonus_for_level,
)


# ── Minimal settings stub ─────────────────────────────────────────────────────

@dataclass
class _Settings:
    bonus_action_estimate: float


DEFAULT_SETTINGS = _Settings(bonus_action_estimate=0.5)


# ── Proficiency bonus table ───────────────────────────────────────────────────

class TestProficiencyBonusTable:
    def test_tier_1_boundaries(self) -> None:
        assert proficiency_bonus_for_level(1) == 2
        assert proficiency_bonus_for_level(4) == 2

    def test_tier_2_boundaries(self) -> None:
        assert proficiency_bonus_for_level(5) == 3
        assert proficiency_bonus_for_level(8) == 3

    def test_tier_3_boundaries(self) -> None:
        assert proficiency_bonus_for_level(9) == 4
        assert proficiency_bonus_for_level(12) == 4

    def test_tier_4_boundaries(self) -> None:
        assert proficiency_bonus_for_level(13) == 5
        assert proficiency_bonus_for_level(16) == 5

    def test_tier_5_boundaries(self) -> None:
        assert proficiency_bonus_for_level(17) == 6
        assert proficiency_bonus_for_level(20) == 6

    def test_midpoints(self) -> None:
        assert proficiency_bonus_for_level(3) == 2
        assert proficiency_bonus_for_level(6) == 3
        assert proficiency_bonus_for_level(11) == 4
        assert proficiency_bonus_for_level(14) == 5
        assert proficiency_bonus_for_level(19) == 6


# ── Single-player party ───────────────────────────────────────────────────────

class TestSinglePlayerParty:
    """A lone adventurer at level 3."""

    @pytest.fixture
    def result(self) -> PartyProfile:
        member = PartyMember(max_hp=30, ac=16, nova_damage=18.0, sustained_damage_per_round=9.0)
        inp = PartyProfileInput(members=[member], level=3)
        return calculate_party_profile(inp, DEFAULT_SETTINGS)

    def test_party_size(self, result: PartyProfile) -> None:
        assert result.party_size == 1

    def test_avg_level(self, result: PartyProfile) -> None:
        assert result.avg_level == 3

    def test_hp_aggregates(self, result: PartyProfile) -> None:
        assert result.total_hp == 30.0
        assert result.avg_hp == 30.0
        assert result.lowest_hp == 30

    def test_avg_ac(self, result: PartyProfile) -> None:
        assert result.avg_ac == 16.0

    def test_damage_aggregates(self, result: PartyProfile) -> None:
        assert result.party_nova == 18.0
        assert result.party_sustained == 9.0

    def test_proficiency_bonus(self, result: PartyProfile) -> None:
        assert result.proficiency_bonus == 2  # levels 1-4

    def test_bonus_actions(self, result: PartyProfile) -> None:
        assert result.estimated_bonus_actions_per_round == pytest.approx(0.5)  # 1 × 0.5

    def test_avg_attack_bonus(self, result: PartyProfile) -> None:
        # floor(3/2) + 2 = 1 + 2 = 3
        assert result.avg_attack_bonus == pytest.approx(3.0)


# ── Four-player party at level 5 ──────────────────────────────────────────────

class TestFourPlayerPartyLevel5:
    """
    Level 5 party from the algorithm spec example.
    Cleric (33 nova) + Fighter + Rogue + Wizard.
    """

    @pytest.fixture
    def result(self) -> PartyProfile:
        members = [
            # Cleric — strong nova from Spiritual Weapon + Spirit Guardians combo
            PartyMember(max_hp=40, ac=18, nova_damage=33.0, sustained_damage_per_round=8.5),
            # Fighter — Battlemaster, Extra Attack
            PartyMember(max_hp=52, ac=18, nova_damage=24.0, sustained_damage_per_round=14.0),
            # Rogue — Sneak Attack burst
            PartyMember(max_hp=35, ac=16, nova_damage=35.0, sustained_damage_per_round=12.5),
            # Wizard — Fireball nova
            PartyMember(max_hp=28, ac=12, nova_damage=42.0, sustained_damage_per_round=8.5),
        ]
        inp = PartyProfileInput(members=members, level=5)
        return calculate_party_profile(inp, DEFAULT_SETTINGS)

    def test_party_size(self, result: PartyProfile) -> None:
        assert result.party_size == 4

    def test_avg_level(self, result: PartyProfile) -> None:
        assert result.avg_level == 5

    def test_total_hp(self, result: PartyProfile) -> None:
        assert result.total_hp == pytest.approx(155.0)  # 40+52+35+28

    def test_avg_hp(self, result: PartyProfile) -> None:
        assert result.avg_hp == pytest.approx(38.75)  # 155 / 4

    def test_lowest_hp(self, result: PartyProfile) -> None:
        assert result.lowest_hp == 28  # wizard

    def test_avg_ac(self, result: PartyProfile) -> None:
        assert result.avg_ac == pytest.approx(16.0)  # (18+18+16+12) / 4

    def test_party_nova(self, result: PartyProfile) -> None:
        assert result.party_nova == pytest.approx(134.0)  # 33+24+35+42

    def test_party_sustained(self, result: PartyProfile) -> None:
        assert result.party_sustained == pytest.approx(43.5)  # 8.5+14+12.5+8.5

    def test_proficiency_bonus(self, result: PartyProfile) -> None:
        assert result.proficiency_bonus == 3  # levels 5-8

    def test_bonus_actions(self, result: PartyProfile) -> None:
        assert result.estimated_bonus_actions_per_round == pytest.approx(2.0)  # 4 × 0.5

    def test_avg_attack_bonus(self, result: PartyProfile) -> None:
        # floor(5/2) + 3 = 2 + 3 = 5
        assert result.avg_attack_bonus == pytest.approx(5.0)


# ── Edge case: all characters same HP ────────────────────────────────────────

class TestAllSameHP:
    """avg_hp and lowest_hp must be equal when all party members have identical HP."""

    @pytest.fixture
    def result(self) -> PartyProfile:
        members = [
            PartyMember(max_hp=30, ac=14, nova_damage=10.0, sustained_damage_per_round=8.0)
            for _ in range(4)
        ]
        inp = PartyProfileInput(members=members, level=1)
        return calculate_party_profile(inp, DEFAULT_SETTINGS)

    def test_avg_equals_lowest(self, result: PartyProfile) -> None:
        assert result.avg_hp == result.lowest_hp

    def test_total_hp(self, result: PartyProfile) -> None:
        assert result.total_hp == pytest.approx(120.0)  # 30 × 4

    def test_avg_hp(self, result: PartyProfile) -> None:
        assert result.avg_hp == pytest.approx(30.0)

    def test_lowest_hp(self, result: PartyProfile) -> None:
        assert result.lowest_hp == 30

    def test_party_sustained(self, result: PartyProfile) -> None:
        assert result.party_sustained == pytest.approx(32.0)  # 8.0 × 4

    def test_bonus_actions_scale_with_party_size(self, result: PartyProfile) -> None:
        assert result.estimated_bonus_actions_per_round == pytest.approx(2.0)  # 4 × 0.5


# ── Edge case: one character significantly below average HP ───────────────────

class TestLowHPOutlier:
    """
    A squishy Wizard with 22 HP drags lowest_hp well below avg_hp.
    All other members are durable frontliners (~55-60 HP).
    """

    @pytest.fixture
    def result(self) -> PartyProfile:
        members = [
            PartyMember(max_hp=60, ac=18, nova_damage=20.0, sustained_damage_per_round=12.0),
            PartyMember(max_hp=55, ac=20, nova_damage=25.0, sustained_damage_per_round=11.0),
            PartyMember(max_hp=52, ac=16, nova_damage=28.0, sustained_damage_per_round=13.0),
            PartyMember(max_hp=22, ac=13, nova_damage=45.0, sustained_damage_per_round=8.0),
        ]
        inp = PartyProfileInput(members=members, level=7)
        return calculate_party_profile(inp, DEFAULT_SETTINGS)

    def test_lowest_hp_is_outlier(self, result: PartyProfile) -> None:
        assert result.lowest_hp == 22

    def test_total_hp(self, result: PartyProfile) -> None:
        assert result.total_hp == pytest.approx(189.0)  # 60+55+52+22

    def test_avg_hp(self, result: PartyProfile) -> None:
        assert result.avg_hp == pytest.approx(47.25)  # 189 / 4

    def test_lowest_hp_well_below_average(self, result: PartyProfile) -> None:
        # Wizard's HP is less than half the party average — confirms outlier detection
        assert result.lowest_hp < result.avg_hp * 0.5

    def test_proficiency_bonus(self, result: PartyProfile) -> None:
        assert result.proficiency_bonus == 3  # level 7 is in the 5-8 bracket

    def test_avg_attack_bonus(self, result: PartyProfile) -> None:
        # floor(7/2) + 3 = 3 + 3 = 6
        assert result.avg_attack_bonus == pytest.approx(6.0)

    def test_avg_ac(self, result: PartyProfile) -> None:
        # (18+20+16+13) / 4 = 67/4 = 16.75
        assert result.avg_ac == pytest.approx(16.75)


# ── Settings protocol — works with any object having bonus_action_estimate ────

class TestSettingsProtocol:
    """The calculator should accept any duck-typed settings object."""

    def test_high_bonus_action_estimate(self) -> None:
        settings = _Settings(bonus_action_estimate=0.8)
        member = PartyMember(max_hp=40, ac=16, nova_damage=20.0, sustained_damage_per_round=10.0)
        inp = PartyProfileInput(members=[member, member, member], level=10)
        result = calculate_party_profile(inp, settings)
        assert result.estimated_bonus_actions_per_round == pytest.approx(2.4)  # 3 × 0.8

    def test_zero_bonus_action_estimate(self) -> None:
        settings = _Settings(bonus_action_estimate=0.0)
        member = PartyMember(max_hp=40, ac=16, nova_damage=20.0, sustained_damage_per_round=10.0)
        inp = PartyProfileInput(members=[member, member], level=5)
        result = calculate_party_profile(inp, settings)
        assert result.estimated_bonus_actions_per_round == pytest.approx(0.0)
