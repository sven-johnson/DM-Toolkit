"""
Unit tests for the ability assignment engine (Task 2.4).
Run from backend/ with:  pytest tests/monster_factory/test_ability_assignment.py -v

All tests are pure — no database required.
"""
import pytest

from app.monster_factory.calculators.ability_assignment import (
    AbilityFlavorInput,
    CombatRoleAbilityInput,
    CreatureArchetypeAbilityInput,
    MonsterAbilitySet,
    assign_abilities,
)
from app.monster_factory.calculators.monster_stats import CalculatedMonsterStats
from app.monster_factory_schemas import MinionSettingsIn


# ── Shared fixtures ───────────────────────────────────────────────────────────


@pytest.fixture
def default_minion_settings() -> MinionSettingsIn:
    return MinionSettingsIn(
        minion_one_hit_kill=False,
        minion_hp_fraction=0.25,
        minion_damage_fraction=0.40,
    )


def _make_stats(
    attack_count: int = 1,
    legendary_action_count: int = 0,
    save_dc: int = 14,
) -> CalculatedMonsterStats:
    return CalculatedMonsterStats(
        hp=60,
        ac=14,
        attack_bonus=5,
        save_dc=save_dc,
        damage_per_attack=10.5,
        attack_count=attack_count,
        damage_dice="2d6",
        damage_bonus=3,
        speed=30,
        str_score=16,
        dex_score=12,
        con_score=14,
        int_score=10,
        wis_score=10,
        cha_score=8,
        legendary_action_count=legendary_action_count,
        warnings=[],
        show_math_detail={},
    )


def _role(name: str, role_id: str = "role-1", is_minion: bool = False) -> CombatRoleAbilityInput:
    return CombatRoleAbilityInput(id=role_id, name=name, is_minion=is_minion, default_attack_count=1)


def _archetype(
    name: str,
    arch_id: str = "arch-1",
    typical_traits: list[str] | None = None,
) -> CreatureArchetypeAbilityInput:
    return CreatureArchetypeAbilityInput(
        id=arch_id,
        name=name,
        typical_traits=typical_traits or [],
    )


def _flavor(
    name: str,
    damage_type: str,
    role_ids: list[str] | None = None,
    creature_ids: list[str] | None = None,
    flavor_id: str | None = None,
) -> AbilityFlavorInput:
    return AbilityFlavorInput(
        id=flavor_id or f"flavor-{name.lower()}",
        name=name,
        damage_type=damage_type,
        role_ids=role_ids or [],
        creature_ids=creature_ids or [],
    )


# ── Test 1: Beast + Bruiser selects creature-specific ability ─────────────────


def test_beast_bruiser_prefers_bite_or_claw(default_minion_settings: MinionSettingsIn) -> None:
    """Beast + Bruiser: Bite or Claw should be selected over generic Strike/Slash."""
    role = _role("Bruiser", role_id="bruiser-1")
    arch = _archetype("Beast", arch_id="beast-1")
    stats = _make_stats()

    flavors = [
        _flavor("Bite",   "piercing",    role_ids=["bruiser-1"], creature_ids=["beast-1"]),
        _flavor("Claw",   "slashing",    role_ids=["bruiser-1"], creature_ids=["beast-1"]),
        _flavor("Strike", "bludgeoning", role_ids=["bruiser-1"], creature_ids=[]),
        _flavor("Slash",  "slashing",    role_ids=["bruiser-1"], creature_ids=[]),
    ]

    result = assign_abilities(role, arch, stats, False, flavors, default_minion_settings)

    selected_names = {a.name for a in result.standard_actions}
    assert selected_names & {"Bite", "Claw"}, (
        f"Expected Bite or Claw but got: {selected_names}"
    )
    assert "Strike" not in selected_names
    assert "Slash" not in selected_names


# ── Test 2: Demon + Caster selects arcane/infernal ability ────────────────────


def test_demon_caster_prefers_sear_or_hex(default_minion_settings: MinionSettingsIn) -> None:
    """Demon + Caster: Sear or Hex should be selected over Gore."""
    role = _role("Caster", role_id="caster-1")
    arch = _archetype("Demon", arch_id="demon-1")
    stats = _make_stats()

    flavors = [
        _flavor("Sear", "fire",       role_ids=["caster-1"], creature_ids=["demon-1"]),
        _flavor("Hex",  "necrotic",   role_ids=["caster-1"], creature_ids=["demon-1"]),
        _flavor("Gore", "piercing",   role_ids=[],            creature_ids=["demon-1"]),
    ]

    result = assign_abilities(role, arch, stats, False, flavors, default_minion_settings)

    selected_names = {a.name for a in result.standard_actions}
    assert selected_names & {"Sear", "Hex"}, (
        f"Expected Sear or Hex but got: {selected_names}"
    )
    assert "Gore" not in selected_names


# ── Test 3: Humanoid + Archer selects ranged ability with ranged range string ─


def test_humanoid_archer_selects_ranged_ability(default_minion_settings: MinionSettingsIn) -> None:
    """Humanoid + Archer: Volley or Bolt, range string must contain 'ranged'."""
    role = _role("Archer", role_id="archer-1")
    arch = _archetype("Humanoid", arch_id="human-1")
    stats = _make_stats()

    flavors = [
        _flavor("Volley", "piercing", role_ids=["archer-1"], creature_ids=["human-1"]),
        _flavor("Bolt",   "piercing", role_ids=["archer-1"], creature_ids=[]),
    ]

    result = assign_abilities(role, arch, stats, False, flavors, default_minion_settings)

    assert result.standard_actions, "Expected at least one standard action"
    selected_names = {a.name for a in result.standard_actions}
    assert selected_names & {"Volley", "Bolt"}, (
        f"Expected Volley or Bolt but got: {selected_names}"
    )
    for action in result.standard_actions:
        assert "ranged" in action.range.lower(), (
            f"Expected ranged range for Archer role but got: {action.range!r}"
        )


# ── Test 4: Unknown combo — generic fallback, no exception ────────────────────


def test_unknown_combo_triggers_fallback_without_exception(
    default_minion_settings: MinionSettingsIn,
) -> None:
    """No flavor matches for this role+creature combo: fallback fires, no crash."""
    role = _role("Bruiser", role_id="bruiser-999")
    arch = _archetype("Weird Creature", arch_id="weird-999")
    stats = _make_stats()

    # Flavors that match neither this role nor this creature
    flavors = [
        _flavor("Bite", "piercing", role_ids=["other-role"], creature_ids=["other-arch"]),
        _flavor("Claw", "slashing", role_ids=["other-role"], creature_ids=["other-arch"]),
    ]

    result = assign_abilities(role, arch, stats, False, flavors, default_minion_settings)

    assert isinstance(result, MonsterAbilitySet)
    assert len(result.standard_actions) >= 1
    # Should have fallen back to Strike (melee fallback for Bruiser)
    assert result.standard_actions[0].name == "Strike"


# ── Test 5: is_boss=True — legendary actions generated, count >= n+1 ──────────


def test_boss_has_legendary_actions_above_minimum(
    default_minion_settings: MinionSettingsIn,
) -> None:
    """Boss: multiattack description present (attack_count=2), legendary list is non-empty,
    total legendary options >= legendary_action_count + 1."""
    role = _role("Bruiser", role_id="bruiser-1")
    arch = _archetype("Dragon", arch_id="dragon-1")
    legendary_action_count = 2
    stats = _make_stats(attack_count=2, legendary_action_count=legendary_action_count)

    flavors = [
        _flavor("Claw",  "slashing", role_ids=["bruiser-1"], creature_ids=["dragon-1"]),
        _flavor("Bite",  "piercing", role_ids=["bruiser-1"], creature_ids=["dragon-1"]),
    ]

    result = assign_abilities(role, arch, stats, True, flavors, default_minion_settings)

    assert result.multiattack_description != "", "Expected multiattack description for attack_count=2"
    assert len(result.legendary_actions) >= legendary_action_count + 1, (
        f"Expected >= {legendary_action_count + 1} legendary options, "
        f"got {len(result.legendary_actions)}"
    )


# ── Test 6: is_boss=False — legendary_actions is empty list ──────────────────


def test_non_boss_has_no_legendary_actions(default_minion_settings: MinionSettingsIn) -> None:
    """Non-boss: legendary_actions must be an empty list regardless of stats."""
    role = _role("Bruiser", role_id="bruiser-1")
    arch = _archetype("Humanoid", arch_id="human-1")
    # Give it legendary_action_count so we confirm is_boss=False gates on its own
    stats = _make_stats(legendary_action_count=3)

    flavors = [_flavor("Strike", "bludgeoning", role_ids=["bruiser-1"], creature_ids=[])]

    result = assign_abilities(role, arch, stats, False, flavors, default_minion_settings)

    assert result.legendary_actions == [], (
        f"Expected empty legendary actions for non-boss, got: {result.legendary_actions}"
    )


# ── Test 7: Archetype with known typical_traits — formatted correctly ─────────


def test_creature_typical_traits_formatted_as_passive_traits(
    default_minion_settings: MinionSettingsIn,
) -> None:
    """Archetype with typical_traits: special_traits non-empty and correctly formatted."""
    role = _role("Bruiser", role_id="bruiser-1")
    arch = _archetype(
        "Undead",
        arch_id="undead-1",
        typical_traits=[
            "Undying Resilience: The creature is immune to exhaustion and the poisoned condition",
            "Incorporeal Movement: The creature can move through other creatures and objects",
        ],
    )
    stats = _make_stats()
    flavors = [_flavor("Strike", "bludgeoning", role_ids=["bruiser-1"], creature_ids=[])]

    result = assign_abilities(role, arch, stats, False, flavors, default_minion_settings)

    assert len(result.special_traits) == 2, (
        f"Expected 2 special traits, got {len(result.special_traits)}"
    )
    for trait in result.special_traits:
        # Must be in "Name. Description." format
        assert ". " in trait, f"Expected 'Name. Desc.' format, got: {trait!r}"
        assert trait.endswith("."), f"Trait should end with a period: {trait!r}"


# ── Test 8: lair_actions_enabled=True — exactly 3 lair actions ───────────────


def test_lair_actions_enabled_generates_exactly_three(
    default_minion_settings: MinionSettingsIn,
) -> None:
    """When lair_actions_enabled=True, exactly 3 lair actions generated."""
    role = _role("Caster", role_id="caster-1")
    arch = _archetype("Shadow", arch_id="shadow-1")
    stats = _make_stats()
    flavors = [_flavor("Hex", "necrotic", role_ids=["caster-1"], creature_ids=["shadow-1"])]

    result = assign_abilities(
        role, arch, stats, False, flavors, default_minion_settings, lair_actions_enabled=True
    )

    assert len(result.lair_actions) == 3, (
        f"Expected exactly 3 lair actions, got {len(result.lair_actions)}"
    )
    for action in result.lair_actions:
        assert action.damage_dice == "—", "Lair actions must not deal direct damage"


# ── Test 9: Minion with one_hit_kill=True — no exception, valid result ────────


def test_minion_one_hit_kill_passes_through_without_error() -> None:
    """
    Ability assignment is unaffected by the one_hit_kill minion rule
    (HP is set to 1 by the orchestrator after ability assignment).
    This test confirms the function accepts minion settings without crashing.
    """
    minion_settings = MinionSettingsIn(
        minion_one_hit_kill=True,
        minion_hp_fraction=0.25,
        minion_damage_fraction=0.40,
    )
    role = _role("Minion", role_id="minion-1", is_minion=True)
    arch = _archetype("Humanoid", arch_id="human-1")
    stats = _make_stats(attack_count=1, legendary_action_count=0)
    flavors = [_flavor("Slash", "slashing", role_ids=["minion-1"], creature_ids=["human-1"])]

    result = assign_abilities(role, arch, stats, False, flavors, minion_settings)

    assert isinstance(result, MonsterAbilitySet)
    assert len(result.standard_actions) == 1
    assert result.legendary_actions == []
    assert result.lair_actions == []
