"""Unit tests for DnD55eRuleSystem and loader factory.

Nova/sustained damage tests removed in Task 1.2 — those methods are
removed from the rule system in Task 2.1.

Pure Python — no database required.
Run from backend/ with:  pytest tests/rule_systems/test_dnd_5_5e.py -v
"""
import pytest

from app.rule_systems.dnd_5_5e import DnD55eRuleSystem
from app.rule_systems.loader import get_rule_system

rs = DnD55eRuleSystem()


# ── Test 1: compute_modifier ──────────────────────────────────────────────────

def test_compute_modifier_ability_scores():
    assert rs.compute_modifier("strength", 10) == 0
    assert rs.compute_modifier("dexterity", 16) == 3
    assert rs.compute_modifier("charisma", 8) == -1


def test_compute_modifier_derived_returns_zero():
    assert rs.compute_modifier("proficiency_bonus", 5) == 0
    assert rs.compute_modifier("spell_save_dc", 17) == 0


# ── Test 2: compute_proficiency_bonus ─────────────────────────────────────────

@pytest.mark.parametrize("level,expected", [(1, 2), (5, 3), (9, 4), (13, 5), (17, 6)])
def test_compute_proficiency_bonus(level: int, expected: int):
    assert rs.compute_proficiency_bonus(level) == expected


# ── Test 3: loader returns DnD55eRuleSystem ───────────────────────────────────

def test_get_rule_system_returns_correct_instance():
    loaded = get_rule_system("dnd_5_5e")
    assert isinstance(loaded, DnD55eRuleSystem)
    assert loaded.slug == "dnd_5_5e"


# ── Test 4: unknown slug raises ValueError ────────────────────────────────────

def test_get_rule_system_unknown_raises():
    with pytest.raises(ValueError, match="Unknown rule system"):
        get_rule_system("unknown_system")
