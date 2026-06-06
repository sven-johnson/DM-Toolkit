"""Abstract base classes and shared data structures for the rule system layer.

These are pure-Python in-memory objects — no database access in this module.
ORM records are loaded by the service layer and passed in as arguments.

Nova and sustained damage are no longer computed by the rule system.
They are pre-computed by the service layer from primary turn totals and
passed into build_character_combat_profile() as plain floats.
"""
from __future__ import annotations

import math
from abc import ABC, abstractmethod
from dataclasses import dataclass
from enum import Enum


# ── Enumerations ──────────────────────────────────────────────────────────────

class StatType(str, Enum):
    ABILITY_SCORE = "ability_score"
    DERIVED       = "derived"
    RESOURCE      = "resource"
    CUSTOM        = "custom"


class SkillProficiency(str, Enum):
    NONE      = "none"
    HALF      = "half"
    FULL      = "full"
    EXPERTISE = "expertise"


class AbilityCategory(str, Enum):
    ATTACK   = "attack"
    SPELL    = "spell"
    FEATURE  = "feature"
    CANTRIP  = "cantrip"
    RESOURCE = "resource"


# ── Definition dataclasses (frozen — represent rule system definitions) ───────

@dataclass(frozen=True)
class StatDefinition:
    """In-memory representation of a stat_definition DB row."""
    id: int
    slug: str
    name: str
    abbreviation: str
    stat_type: StatType
    has_modifier: bool
    modifier_formula: str | None
    sort_order: int


@dataclass(frozen=True)
class SkillDefinition:
    """In-memory representation of a skill_definition DB row."""
    id: int
    slug: str
    name: str
    governing_stat_slug: str | None
    sort_order: int


@dataclass(frozen=True)
class CombatAbilityDefinition:
    """In-memory representation of a combat_ability_definition DB row."""
    id: int
    slug: str
    name: str
    ability_category: AbilityCategory
    is_nova_eligible: bool
    is_sustained_eligible: bool


# ── Character combat profile (mutable — assembled by the service layer) ───────

@dataclass
class CharacterCombatProfile:
    """Full in-memory combat profile for a single character.

    nova_damage and sustained_damage_per_round are populated by the service
    layer from the character's primary turn totals, not computed by the
    rule system.
    """
    character_id: str
    character_name: str
    rule_system_slug: str
    max_hp: int
    armor_class: int
    stats: dict[str, int]                   # slug → raw value
    modifiers: dict[str, int]               # slug → computed modifier
    skills: dict[str, SkillProficiency]     # slug → proficiency type
    nova_damage: float
    sustained_damage_per_round: float
    proficiency_bonus: int
    level: int


# ── Abstract rule system base class ──────────────────────────────────────────

class AbstractRuleSystem(ABC):
    """All rule system implementations must subclass this."""

    slug: str  # class variable — set on each concrete subclass
    name: str  # class variable

    @abstractmethod
    def get_stat_definitions(self) -> list[StatDefinition]:
        """Return all stat definitions for this rule system (id=0 when not DB-backed)."""
        ...

    @abstractmethod
    def get_skill_definitions(self) -> list[SkillDefinition]:
        """Return all skill definitions for this rule system."""
        ...

    @abstractmethod
    def get_combat_ability_definitions(self) -> list[CombatAbilityDefinition]:
        """Return all combat ability definitions for this rule system."""
        ...

    @abstractmethod
    def compute_modifier(self, stat_slug: str, value: int) -> int:
        """Compute the modifier for a raw stat value.

        For D&D ability scores: floor((value - 10) / 2).
        For derived stats: returns 0.
        """
        ...

    @abstractmethod
    def compute_proficiency_bonus(self, level: int) -> int:
        """Return the proficiency bonus for a given character level."""
        ...

    @abstractmethod
    def build_character_combat_profile(
        self,
        character_id: str,
        character_name: str,
        level: int,
        max_hp: int,
        armor_class: int,
        stat_values: dict[str, int],
        skill_proficiencies: dict[str, str],
        nova_damage: float,
        sustained_damage: float,
    ) -> CharacterCombatProfile:
        """Assemble a CharacterCombatProfile from the provided data.

        nova_damage and sustained_damage are pre-computed by the service
        layer from the character's primary turn totals.
        """
        ...
