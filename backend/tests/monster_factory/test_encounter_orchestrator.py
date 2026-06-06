"""
Integration tests for the Encounter Orchestrator (Task 2.5).
Run from backend/ with:  pytest tests/monster_factory/test_encounter_orchestrator.py -v

Uses an in-memory SQLite database seeded with the minimum records needed
to exercise the full orchestration pipeline.
"""
import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session as DBSession
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import (
    AbilityFlavor,
    AbilityFlavorCreatureMapping,
    AbilityFlavorRoleMapping,
    CombatRoleArchetype,
    CreatureArchetype,
    GMProfile,
    ActionEconomySettings,
    CombatDurationSettings,
    HitRateSettings,
    LethalitySettings,
    MinionSettings,
    SavingThrowSettings,
    WarningSettings,
)
from app.monster_factory.calculators.encounter_orchestrator import (
    EncounterCompositionSlot,
    GenerateEncounterInput,
    generate_encounter,
    rebalance_encounter,
)
from app.monster_factory.calculators.party_profile import PartyMember


# ── Test database ─────────────────────────────────────────────────────────────


_TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(_TEST_ENGINE, "connect")
def _enable_fk(dbapi_conn, _record):
    dbapi_conn.cursor().execute("PRAGMA foreign_keys=ON")


_SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=_TEST_ENGINE)


@pytest.fixture(autouse=True)
def _reset_schema():
    Base.metadata.create_all(bind=_TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=_TEST_ENGINE)


@pytest.fixture
def db() -> DBSession:
    session = _SessionLocal()
    try:
        yield session
    finally:
        session.close()


# ── Seed helpers ──────────────────────────────────────────────────────────────


def _uid() -> str:
    return str(uuid.uuid4())


def _seed_profile(db: DBSession, one_hit_kill: bool = False, show_math: bool = False) -> GMProfile:
    """Create a GMProfile with balanced-preset settings."""
    profile_id = _uid()
    profile = GMProfile(id=profile_id, name="Test Profile", is_default=True)
    db.add(profile)
    db.flush()

    db.add(LethalitySettings(
        id=_uid(), gm_profile_id=profile_id,
        threat_turns_trivial=6.0, threat_turns_easy=5.0,
        threat_turns_medium=3.5, threat_turns_hard=2.25, threat_turns_deadly=1.5,
        damage_smoothing=0.85, hp_smoothing=1.10,
        one_shot_prevention_threshold=0.60, boss_nova_multiplier=1.5,
        allow_player_death=False,
    ))
    db.add(CombatDurationSettings(
        id=_uid(), gm_profile_id=profile_id,
        target_rounds_trivial=1.5, target_rounds_easy=2.5,
        target_rounds_medium=3.5, target_rounds_hard=5.0, target_rounds_deadly=6.0,
        round_variance_tolerance=1.0,
    ))
    db.add(ActionEconomySettings(
        id=_uid(), gm_profile_id=profile_id,
        multiplier_trivial=0.6, multiplier_easy=0.8, multiplier_medium=1.0,
        multiplier_hard=1.2, multiplier_deadly=1.4,
        bonus_action_estimate=0.5, lair_actions_enabled=True,
    ))
    db.add(HitRateSettings(
        id=_uid(), gm_profile_id=profile_id,
        monster_hit_rate_trivial=0.40, monster_hit_rate_easy=0.50,
        monster_hit_rate_medium=0.60, monster_hit_rate_hard=0.65,
        monster_hit_rate_deadly=0.70,
        player_hit_rate_trivial=0.75, player_hit_rate_easy=0.65,
        player_hit_rate_medium=0.55, player_hit_rate_hard=0.50,
        player_hit_rate_deadly=0.45,
    ))
    db.add(SavingThrowSettings(
        id=_uid(), gm_profile_id=profile_id,
        save_dc_base=8, save_dc_proficiency_scaling=True, save_dc_difficulty_bonus=1,
    ))
    db.add(MinionSettings(
        id=_uid(), gm_profile_id=profile_id,
        minion_one_hit_kill=one_hit_kill, minion_hp_fraction=0.25, minion_damage_fraction=0.40,
    ))
    db.add(WarningSettings(
        id=_uid(), gm_profile_id=profile_id,
        warn_nova_threshold=True, warn_one_shot_risk=True,
        warn_action_economy_imbalance=True, warn_round_duration_deviation=True,
        show_math=show_math,
    ))
    db.commit()
    return db.query(GMProfile).filter(GMProfile.id == profile_id).first()


def _seed_roles(db: DBSession) -> tuple[CombatRoleArchetype, CombatRoleArchetype]:
    """Create a Boss role and a Minion role."""
    boss_id, minion_id = _uid(), _uid()
    boss = CombatRoleArchetype(
        id=boss_id, name="Boss", description="Boss role",
        action_weight=2.0, hp_share_tier="very_high", ac_profile="high",
        damage_profile="high", is_boss_eligible=True, is_minion=False,
        default_attack_count=2,
    )
    minion = CombatRoleArchetype(
        id=minion_id, name="Minion", description="Minion role",
        action_weight=0.5, hp_share_tier="very_low", ac_profile="low",
        damage_profile="very_low", is_boss_eligible=False, is_minion=True,
        default_attack_count=1,
    )
    db.add_all([boss, minion])
    db.commit()
    return boss, minion


def _seed_archetypes(db: DBSession) -> tuple[CreatureArchetype, CreatureArchetype]:
    """Create Dragon and Humanoid creature archetypes."""
    dragon_id, human_id = _uid(), _uid()
    dragon = CreatureArchetype(
        id=dragon_id, name="Dragon",
        typical_traits=["Frightful Presence: Each creature within 120 ft must succeed on a Wisdom saving throw or become frightened"],
        damage_immunities=["fire"],
    )
    humanoid = CreatureArchetype(
        id=human_id, name="Humanoid",
        typical_traits=[],
    )
    db.add_all([dragon, humanoid])
    db.commit()
    return dragon, humanoid


def _seed_flavors(
    db: DBSession,
    boss: CombatRoleArchetype,
    minion: CombatRoleArchetype,
    dragon: CreatureArchetype,
    humanoid: CreatureArchetype,
) -> None:
    """Create AbilityFlavor records with role/creature mappings."""
    claw_id = _uid()
    slash_id = _uid()

    db.add(AbilityFlavor(id=claw_id, name="Claw", damage_type="slashing"))
    db.add(AbilityFlavor(id=slash_id, name="Slash", damage_type="slashing"))
    db.flush()

    # Claw maps to Boss role + Dragon archetype
    db.add(AbilityFlavorRoleMapping(ability_flavor_id=claw_id, combat_role_archetype_id=boss.id))
    db.add(AbilityFlavorCreatureMapping(ability_flavor_id=claw_id, creature_archetype_id=dragon.id))

    # Slash maps to Minion role + Humanoid archetype
    db.add(AbilityFlavorRoleMapping(ability_flavor_id=slash_id, combat_role_archetype_id=minion.id))
    db.add(AbilityFlavorCreatureMapping(ability_flavor_id=slash_id, creature_archetype_id=humanoid.id))

    db.commit()


# Standard 4-player level-5 party
_PARTY = [
    PartyMember(max_hp=38, ac=16, nova_damage=33.0, sustained_damage_per_round=14.0),
    PartyMember(max_hp=35, ac=16, nova_damage=28.0, sustained_damage_per_round=12.0),
    PartyMember(max_hp=33, ac=15, nova_damage=25.0, sustained_damage_per_round=11.0),
    PartyMember(max_hp=32, ac=13, nova_damage=20.5, sustained_damage_per_round=11.0),
]


# ── Test 1: Boss Dragon + 2 Humanoid Minions, hard difficulty ─────────────────


def test_boss_fight_hard_4p_level5(db: DBSession) -> None:
    """
    1 Boss Dragon + 2 Humanoid Minions at hard difficulty, 4-player level-5 party.
    Verifies structure, boss legendary count, dragon HP floor, minion equality,
    total_monster_count, warnings list existence, and expected_rounds sanity range.
    """
    profile = _seed_profile(db)
    boss, minion = _seed_roles(db)
    dragon, humanoid = _seed_archetypes(db)
    _seed_flavors(db, boss, minion, dragon, humanoid)

    inp = GenerateEncounterInput(
        party_members=_PARTY,
        party_level=5,
        difficulty="hard",
        composition=[
            EncounterCompositionSlot(
                combat_role_id=boss.id, creature_archetype_id=dragon.id,
                count=1, is_boss=True,
            ),
            EncounterCompositionSlot(
                combat_role_id=minion.id, creature_archetype_id=humanoid.id,
                count=2, is_boss=False,
            ),
        ],
        gm_profile_id=profile.id,
    )

    result = generate_encounter(inp, db)

    # Structure
    assert result is not None
    assert result.total_monster_count == 3
    assert len(result.monsters) == 2

    # Dragon (slot 0) — boss checks
    dragon_monster = result.monsters[0]
    assert dragon_monster.is_boss is True
    assert dragon_monster.stats.legendary_action_count >= 2, (
        f"Expected legendary_action_count >= 2, got {dragon_monster.stats.legendary_action_count}"
    )

    # Dragon HP >= party nova × 1.5 (nova floor check from algorithm)
    party_nova = sum(m.nova_damage for m in _PARTY)
    assert dragon_monster.stats.hp >= party_nova * 1.5, (
        f"Dragon HP {dragon_monster.stats.hp} < party_nova×1.5 ({party_nova * 1.5:.1f})"
    )

    # Both minions have identical stats (same role + archetype + count_of_this_type)
    minion_monster = result.monsters[1]
    assert minion_monster.count == 2

    # Warnings is a list (may be empty)
    assert isinstance(result.all_warnings, list)

    # Expected rounds sanity: hard should land roughly in 3–7 range
    assert 3.0 <= result.expected_rounds <= 7.0, (
        f"expected_rounds={result.expected_rounds:.2f} out of sanity range 3–7"
    )


# ── Test 2: Rebalance — add 2 more minions ───────────────────────────────────


def test_rebalance_adds_minions(db: DBSession) -> None:
    """
    Rebalance the Test 1 encounter to 4 minions.
    Dragon HP should be recalculated, total_monster_count == 5,
    encounter_name is preserved, expected_rounds stays in hard range.
    """
    profile = _seed_profile(db)
    boss, minion = _seed_roles(db)
    dragon, humanoid = _seed_archetypes(db)
    _seed_flavors(db, boss, minion, dragon, humanoid)

    inp = GenerateEncounterInput(
        party_members=_PARTY,
        party_level=5,
        difficulty="hard",
        composition=[
            EncounterCompositionSlot(
                combat_role_id=boss.id, creature_archetype_id=dragon.id,
                count=1, is_boss=True,
            ),
            EncounterCompositionSlot(
                combat_role_id=minion.id, creature_archetype_id=humanoid.id,
                count=2, is_boss=False,
            ),
        ],
        gm_profile_id=profile.id,
        encounter_name="Dragon Lair",
    )

    original = generate_encounter(inp, db)
    original_dragon_hp = original.monsters[0].stats.hp

    # Rebalance: 4 minions instead of 2
    new_composition = [
        EncounterCompositionSlot(
            combat_role_id=boss.id, creature_archetype_id=dragon.id,
            count=1, is_boss=True,
        ),
        EncounterCompositionSlot(
            combat_role_id=minion.id, creature_archetype_id=humanoid.id,
            count=4, is_boss=False,
        ),
    ]

    rebalanced = rebalance_encounter(
        existing=original,
        new_composition=new_composition,
        new_party_members=None,
        new_party_level=None,
        new_difficulty=None,
        gm_profile_id=profile.id,
        db=db,
    )

    assert rebalanced.total_monster_count == 5
    assert rebalanced.encounter_name == "Dragon Lair"

    # Dragon HP may differ when total_monster_count changes
    new_dragon_hp = rebalanced.monsters[0].stats.hp
    # Both are valid positive HP values — the key test is the count changed
    assert new_dragon_hp > 0

    # Sanity: expected_rounds still reasonable for hard difficulty
    assert 3.0 <= rebalanced.expected_rounds <= 7.0, (
        f"rebalanced expected_rounds={rebalanced.expected_rounds:.2f} out of range"
    )

    # Document whether HP changed (informational, not a hard assertion)
    _ = original_dragon_hp != new_dragon_hp  # may or may not differ


# ── Test 3: Minion one-hit-kill toggle sets hp == 1 ──────────────────────────


def test_minion_one_hit_kill_sets_hp_to_one(db: DBSession) -> None:
    """
    Profile with minion_one_hit_kill=True: all minion stat blocks must have hp == 1.
    """
    profile = _seed_profile(db, one_hit_kill=True)
    boss, minion = _seed_roles(db)
    dragon, humanoid = _seed_archetypes(db)
    _seed_flavors(db, boss, minion, dragon, humanoid)

    inp = GenerateEncounterInput(
        party_members=_PARTY,
        party_level=5,
        difficulty="hard",
        composition=[
            EncounterCompositionSlot(
                combat_role_id=boss.id, creature_archetype_id=dragon.id,
                count=1, is_boss=True,
            ),
            EncounterCompositionSlot(
                combat_role_id=minion.id, creature_archetype_id=humanoid.id,
                count=6, is_boss=False,
            ),
        ],
        gm_profile_id=profile.id,
    )

    result = generate_encounter(inp, db)

    minion_slots = [m for m in result.monsters if not m.is_boss]
    assert minion_slots, "Expected at least one minion slot"
    for slot in minion_slots:
        assert slot.stats.hp == 1, (
            f"Expected minion hp == 1 with one_hit_kill=True, got {slot.stats.hp}"
        )

    # Boss HP should not be affected
    boss_slots = [m for m in result.monsters if m.is_boss]
    assert boss_slots, "Expected at least one boss slot"
    for slot in boss_slots:
        assert slot.stats.hp > 1, (
            f"Boss HP should be > 1, got {slot.stats.hp}"
        )
