"""D&D 5.5e (2024) rule system implementation."""
from __future__ import annotations

import math

from .base import (
    AbilityCategory,
    AbstractRuleSystem,
    CharacterCombatProfile,
    CombatAbilityDefinition,
    SkillDefinition,
    SkillProficiency,
    StatDefinition,
    StatType,
)

# ── Static definition lists ───────────────────────────────────────────────────
# IDs are 0 (placeholder) when used outside the DB context.
# The service layer uses DB-loaded records with real IDs.

_STAT_DEFINITIONS: list[StatDefinition] = [
    StatDefinition(0, "strength",     "Strength",       "STR",  StatType.ABILITY_SCORE, True,  "floor((value - 10) / 2)", 0),
    StatDefinition(0, "dexterity",    "Dexterity",      "DEX",  StatType.ABILITY_SCORE, True,  "floor((value - 10) / 2)", 1),
    StatDefinition(0, "constitution", "Constitution",   "CON",  StatType.ABILITY_SCORE, True,  "floor((value - 10) / 2)", 2),
    StatDefinition(0, "intelligence", "Intelligence",   "INT",  StatType.ABILITY_SCORE, True,  "floor((value - 10) / 2)", 3),
    StatDefinition(0, "wisdom",       "Wisdom",         "WIS",  StatType.ABILITY_SCORE, True,  "floor((value - 10) / 2)", 4),
    StatDefinition(0, "charisma",     "Charisma",       "CHA",  StatType.ABILITY_SCORE, True,  "floor((value - 10) / 2)", 5),
    StatDefinition(0, "proficiency_bonus",  "Proficiency Bonus",  "Prof", StatType.DERIVED, False, None, 6),
    StatDefinition(0, "spell_save_dc",      "Spell Save DC",      "DC",   StatType.DERIVED, False, None, 7),
    StatDefinition(0, "spell_attack_bonus", "Spell Attack Bonus", "SAB",  StatType.DERIVED, False, None, 8),
    StatDefinition(0, "initiative",         "Initiative",         "Init", StatType.DERIVED, False, None, 9),
]

_ABILITY_SCORE_SLUGS = frozenset(
    s.slug for s in _STAT_DEFINITIONS if s.stat_type == StatType.ABILITY_SCORE
)

_SKILL_DEFINITIONS: list[SkillDefinition] = [
    SkillDefinition(0, "acrobatics",      "Acrobatics",      "dexterity",    0),
    SkillDefinition(0, "animal_handling", "Animal Handling", "wisdom",       1),
    SkillDefinition(0, "arcana",          "Arcana",          "intelligence", 2),
    SkillDefinition(0, "athletics",       "Athletics",       "strength",     3),
    SkillDefinition(0, "deception",       "Deception",       "charisma",     4),
    SkillDefinition(0, "history",         "History",         "intelligence", 5),
    SkillDefinition(0, "insight",         "Insight",         "wisdom",       6),
    SkillDefinition(0, "intimidation",    "Intimidation",    "charisma",     7),
    SkillDefinition(0, "investigation",   "Investigation",   "intelligence", 8),
    SkillDefinition(0, "medicine",        "Medicine",        "wisdom",       9),
    SkillDefinition(0, "nature",          "Nature",          "intelligence", 10),
    SkillDefinition(0, "perception",      "Perception",      "wisdom",       11),
    SkillDefinition(0, "performance",     "Performance",     "charisma",     12),
    SkillDefinition(0, "persuasion",      "Persuasion",      "charisma",     13),
    SkillDefinition(0, "religion",        "Religion",        "intelligence", 14),
    SkillDefinition(0, "sleight_of_hand", "Sleight of Hand", "dexterity",    15),
    SkillDefinition(0, "stealth",         "Stealth",         "dexterity",    16),
    SkillDefinition(0, "survival",        "Survival",        "wisdom",       17),
]

_COMBAT_ABILITY_DEFINITIONS: list[CombatAbilityDefinition] = [
    CombatAbilityDefinition(0, "cantrip",             "Cantrip",             AbilityCategory.CANTRIP,  False, True),
    CombatAbilityDefinition(0, "weapon_attack",       "Weapon Attack",       AbilityCategory.ATTACK,   False, True),
    CombatAbilityDefinition(0, "spell_slot_l1",       "1st Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l2",       "2nd Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l3",       "3rd Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l4",       "4th Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l5",       "5th Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l6",       "6th Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l7",       "7th Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l8",       "8th Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "spell_slot_l9",       "9th Level Spell",     AbilityCategory.SPELL,    True,  False),
    CombatAbilityDefinition(0, "class_feature",       "Class Feature",       AbilityCategory.FEATURE,  True,  False),
    CombatAbilityDefinition(0, "bonus_action_attack", "Bonus Action Attack", AbilityCategory.ATTACK,   False, True),
]


class DnD55eRuleSystem(AbstractRuleSystem):
    """Concrete implementation of the D&D 5.5e (2024) rule system."""

    slug = "dnd_5_5e"
    name = "D&D 5.5e"

    def get_stat_definitions(self) -> list[StatDefinition]:
        return list(_STAT_DEFINITIONS)

    def get_skill_definitions(self) -> list[SkillDefinition]:
        return list(_SKILL_DEFINITIONS)

    def get_combat_ability_definitions(self) -> list[CombatAbilityDefinition]:
        return list(_COMBAT_ABILITY_DEFINITIONS)

    def compute_modifier(self, stat_slug: str, value: int) -> int:
        if stat_slug in _ABILITY_SCORE_SLUGS:
            return math.floor((value - 10) / 2)
        return 0

    def compute_proficiency_bonus(self, level: int) -> int:
        if level <= 4:  return 2
        if level <= 8:  return 3
        if level <= 12: return 4
        if level <= 16: return 5
        return 6

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
        modifiers = {slug: self.compute_modifier(slug, val) for slug, val in stat_values.items()}
        skills    = {slug: SkillProficiency(prof) for slug, prof in skill_proficiencies.items()}
        return CharacterCombatProfile(
            character_id=character_id,
            character_name=character_name,
            rule_system_slug=self.slug,
            max_hp=max_hp,
            armor_class=armor_class,
            stats=stat_values,
            modifiers=modifiers,
            skills=skills,
            nova_damage=nova_damage,
            sustained_damage_per_round=sustained_damage,
            proficiency_bonus=self.compute_proficiency_bonus(level),
            level=level,
        )
