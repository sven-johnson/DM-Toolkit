"""Seed D&D 5.5e rule system definitions.

Idempotent — safe to call on every startup. Skips all inserts if the
D&D 5.5e rule system already exists.
"""
from .database import get_db
from .models import CombatAbilityDefinition, RuleSystem, SkillDefinition, StatDefinition


def seed_rule_systems() -> None:
    db = next(get_db())
    try:
        if db.query(RuleSystem).filter(RuleSystem.slug == "dnd_5_5e").first():
            return  # already seeded

        # ── Rule System ───────────────────────────────────────────────────────
        rs = RuleSystem(slug="dnd_5_5e", name="D&D 5.5e", version="2024", is_default=True)
        db.add(rs)
        db.flush()  # get rs.id

        # ── Stat Definitions ──────────────────────────────────────────────────
        ability_scores = [
            ("strength",    "Strength",    "STR"),
            ("dexterity",   "Dexterity",   "DEX"),
            ("constitution","Constitution","CON"),
            ("intelligence","Intelligence","INT"),
            ("wisdom",      "Wisdom",      "WIS"),
            ("charisma",    "Charisma",    "CHA"),
        ]
        stat_objs: dict[str, StatDefinition] = {}
        for i, (slug, name, abbr) in enumerate(ability_scores):
            s = StatDefinition(
                rule_system_id=rs.id,
                slug=slug,
                name=name,
                abbreviation=abbr,
                stat_type="ability_score",
                has_modifier=True,
                modifier_formula="floor((value - 10) / 2)",
                sort_order=i,
            )
            db.add(s)
            stat_objs[slug] = s

        derived_stats = [
            ("proficiency_bonus",  "Proficiency Bonus",  "Prof"),
            ("spell_save_dc",      "Spell Save DC",      "DC"),
            ("spell_attack_bonus", "Spell Attack Bonus", "SAB"),
            ("initiative",         "Initiative",         "Init"),
        ]
        for i, (slug, name, abbr) in enumerate(derived_stats):
            s = StatDefinition(
                rule_system_id=rs.id,
                slug=slug,
                name=name,
                abbreviation=abbr,
                stat_type="derived",
                has_modifier=False,
                modifier_formula=None,
                sort_order=6 + i,
            )
            db.add(s)
            stat_objs[slug] = s

        db.flush()  # get stat IDs

        # ── Skill Definitions ─────────────────────────────────────────────────
        # (slug, name, governing_stat_slug)
        skills = [
            ("acrobatics",      "Acrobatics",      "dexterity"),
            ("animal_handling", "Animal Handling",  "wisdom"),
            ("arcana",          "Arcana",           "intelligence"),
            ("athletics",       "Athletics",        "strength"),
            ("deception",       "Deception",        "charisma"),
            ("history",         "History",          "intelligence"),
            ("insight",         "Insight",          "wisdom"),
            ("intimidation",    "Intimidation",     "charisma"),
            ("investigation",   "Investigation",    "intelligence"),
            ("medicine",        "Medicine",         "wisdom"),
            ("nature",          "Nature",           "intelligence"),
            ("perception",      "Perception",       "wisdom"),
            ("performance",     "Performance",      "charisma"),
            ("persuasion",      "Persuasion",       "charisma"),
            ("religion",        "Religion",         "intelligence"),
            ("sleight_of_hand", "Sleight of Hand",  "dexterity"),
            ("stealth",         "Stealth",          "dexterity"),
            ("survival",        "Survival",         "wisdom"),
        ]
        for i, (slug, name, stat_slug) in enumerate(skills):
            governing_id = stat_objs[stat_slug].id if stat_slug else None
            db.add(SkillDefinition(
                rule_system_id=rs.id,
                slug=slug,
                name=name,
                governing_stat_id=governing_id,
                sort_order=i,
            ))

        # ── Combat Ability Definitions ────────────────────────────────────────
        # (slug, name, category, is_nova, is_sustained)
        abilities = [
            ("cantrip",             "Cantrip",                  "cantrip",  False, True),
            ("weapon_attack",       "Weapon Attack",            "attack",   False, True),
            ("spell_slot_l1",       "1st Level Spell",          "spell",    True,  False),
            ("spell_slot_l2",       "2nd Level Spell",          "spell",    True,  False),
            ("spell_slot_l3",       "3rd Level Spell",          "spell",    True,  False),
            ("spell_slot_l4",       "4th Level Spell",          "spell",    True,  False),
            ("spell_slot_l5",       "5th Level Spell",          "spell",    True,  False),
            ("spell_slot_l6",       "6th Level Spell",          "spell",    True,  False),
            ("spell_slot_l7",       "7th Level Spell",          "spell",    True,  False),
            ("spell_slot_l8",       "8th Level Spell",          "spell",    True,  False),
            ("spell_slot_l9",       "9th Level Spell",          "spell",    True,  False),
            ("class_feature",       "Class Feature",            "feature",  True,  False),
            ("bonus_action_attack", "Bonus Action Attack",      "attack",   False, True),
        ]
        for i, (slug, name, category, nova, sustained) in enumerate(abilities):
            db.add(CombatAbilityDefinition(
                rule_system_id=rs.id,
                slug=slug,
                name=name,
                ability_category=category,
                is_nova_eligible=nova,
                is_sustained_eligible=sustained,
                sort_order=i,
            ))

        db.commit()
    except Exception:
        db.rollback()
        raise
    finally:
        db.close()
