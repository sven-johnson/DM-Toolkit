# Combat Update — Build Instructions

Read docs/COMBAT_UPDATE.md and work through all incomplete tasks in order.
Before beginning each task, state the task number and name, then present a
plan and wait for my approval before writing any code. After I approve,
implement the task, verify all completion criteria pass, update the task
Status to `[x] Complete`, then stop and wait for me to confirm before moving
to the next task. Do not skip tasks or combine tasks.

**Rules Claude Code must follow:**
- Never begin a task until the previous task's Status is marked `[x] Complete`
- Always present a plan and receive explicit approval before writing any code
- Always verify all completion criteria before marking a task done
- If a task fails or produces unexpected results, stop and report — do not proceed
- All tasks assume the project context in CLAUDE.md

---

## Phase 1: Rule System Abstraction — Database Layer

---

### Task 1.1 — Rule System and Stat Definition Tables

**Status:** [x] Complete

**Depends on:** Nothing (greenfield tables)

**Prompt:**
```
I'm adding a multi-rule-system abstraction layer to dm-toolkit. The goal
is to support D&D 5.5e now and make it structurally easy to add other
systems (including a custom system I'm developing) later. All rule-system-
specific definitions live in database tables with foreign keys so nothing
is hardcoded. Read CLAUDE.md for project context. Present a plan before
writing any code.

## New Tables

### rule_system
Defines a game system. The first seeded entry is D&D 5.5e.

Fields:
- id (PK, int)
- slug (string, unique) e.g. "dnd_5_5e", "custom_v1"
- name (string) e.g. "D&D 5.5e", "Custom System v1"
- version (string) e.g. "2024"
- is_default (boolean)
- created_at, updated_at

### stat_definition
Defines a named stat (ability score, derived value, etc.) for a rule system.
e.g. STR, DEX, CON, INT, WIS, CHA for D&D 5.5e.

Fields:
- id (PK, int)
- rule_system_id (FK → rule_system)
- slug (string) e.g. "strength", "dexterity"
- name (string) e.g. "Strength", "Dexterity"
- abbreviation (string) e.g. "STR", "DEX"
- stat_type (enum: ability_score | derived | resource | custom)
- has_modifier (boolean) — true for D&D ability scores (modifier = floor((score-10)/2))
- modifier_formula (string, nullable) — e.g. "floor((value - 10) / 2)"
- sort_order (int) — display ordering
- created_at, updated_at

### skill_definition
Defines a named skill for a rule system.
e.g. Athletics, Acrobatics, Arcana, etc. for D&D 5.5e.

Fields:
- id (PK, int)
- rule_system_id (FK → rule_system)
- slug (string) e.g. "athletics", "arcana"
- name (string) e.g. "Athletics", "Arcana"
- governing_stat_id (FK → stat_definition, nullable)
  — which ability score governs this skill
- sort_order (int)
- created_at, updated_at

### combat_ability_definition
Defines a type of combat ability for a rule system.
e.g. Spell Attack, Weapon Attack, Class Feature, Cantrip, Spell Slot Level.

Fields:
- id (PK, int)
- rule_system_id (FK → rule_system)
- slug (string) e.g. "spell_attack_l3", "weapon_attack", "cantrip"
- name (string) e.g. "3rd Level Spell Attack", "Weapon Attack"
- ability_category (enum: attack | spell | feature | cantrip | resource)
- is_nova_eligible (boolean)
  — true if this ability type is considered when calculating nova damage
- is_sustained_eligible (boolean)
  — true if this ability type counts toward sustained damage per round
- notes (text, nullable)
- sort_order (int)
- created_at, updated_at

## Requirements
- SQLAlchemy models with full type hints
- Alembic migration
- Unique constraint on (rule_system_id, slug) for stat_definition,
  skill_definition, and combat_ability_definition
- Seed D&D 5.5e rule system (is_default=true)
- Seed D&D 5.5e stat definitions:
  STR, DEX, CON, INT, WIS, CHA (all ability_score type, has_modifier=true,
  formula "floor((value - 10) / 2)")
  Also seed: proficiency_bonus (derived, no modifier), spell_save_dc (derived),
  spell_attack_bonus (derived), initiative (derived)
- Seed D&D 5.5e skill definitions (all 18 skills with correct governing stat):
  Acrobatics(DEX), Animal Handling(WIS), Arcana(INT), Athletics(STR),
  Deception(CHA), History(INT), Insight(WIS), Intimidation(CHA),
  Investigation(INT), Medicine(WIS), Nature(INT), Perception(WIS),
  Performance(CHA), Persuasion(CHA), Religion(INT), Sleight of Hand(DEX),
  Stealth(DEX), Survival(WIS)
- Seed D&D 5.5e combat ability definitions:
  cantrip(nova=false, sustained=true), weapon_attack(nova=false, sustained=true),
  spell_slot_l1 through spell_slot_l9(nova=true, sustained=false),
  class_feature(nova=true, sustained=false), bonus_action_attack(nova=false, sustained=true)

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `rule_system` table created
- [x] `stat_definition` table created with all constraints
- [x] `skill_definition` table created with all constraints
- [x] `combat_ability_definition` table created with all constraints
- [x] Alembic migration runs cleanly in both directions (upgrade and downgrade)
- [x] D&D 5.5e rule system seeded with is_default=true
- [x] All 10 stat definitions seeded
- [x] All 18 skill definitions seeded with correct governing stats
- [x] All combat ability definitions seeded with correct nova/sustained flags

---

### Task 1.2 — Character Combat Stats and Abilities Tables

**Status:** [x] Complete

**Depends on:** Task 1.1 complete

**Prompt:**
```
Continuing the combat update. Adding character-level stat and ability
tables that reference the rule system definitions from Task 1.1.
Read CLAUDE.md for project context. Present a plan before coding.

## New Tables

### character_stat
Stores the actual value of a stat definition for a specific character.
e.g. Character X has STR 14, DEX 16, etc.

Fields:
- id (PK, int)
- character_id (FK → existing characters table)
- stat_definition_id (FK → stat_definition)
- value (int) — raw value (e.g. 16 for DEX 16)
- override_modifier (int, nullable)
  — if set, overrides the computed modifier instead of using the formula
- created_at, updated_at

Unique constraint: (character_id, stat_definition_id)

### character_skill
Stores proficiency and bonus info for a skill for a specific character.

Fields:
- id (PK, int)
- character_id (FK → existing characters table)
- skill_definition_id (FK → skill_definition)
- proficiency_type (enum: none | half | full | expertise)
  — none=no proficiency, half=jack of all trades, full=proficient, expertise=double
- additional_bonus (int, default 0) — any situational flat bonus
- created_at, updated_at

Unique constraint: (character_id, skill_definition_id)

### character_combat_ability
Stores a specific combat ability for a character. This is what feeds
nova damage and sustained damage calculations.

Fields:
- id (PK, int)
- character_id (FK → existing characters table)
- combat_ability_definition_id (FK → combat_ability_definition)
- name (string) — human-readable name e.g. "Inflict Wounds L3", "Spiritual Weapon L3"
- dice_count (int) — number of dice e.g. 3 for 3d10
- dice_value (int) — die size e.g. 10 for d10
- flat_bonus (int, default 0) — added to roll result
- is_bonus_action (boolean, default false)
  — if true, this ability uses the bonus action economy
- attacks_per_use (int, default 1)
  — number of attack rolls per use (e.g. Eldritch Blast shoots multiple beams)
- uses_per_combat (int, nullable)
  — null = unlimited, 1 = once per combat, etc.
- notes (text, nullable)
- created_at, updated_at

## Calculated Fields (NOT stored, computed at read time)
The API layer will compute these from stored values:

average_damage_per_use:
  = (dice_count × ((dice_value + 1) / 2) + flat_bonus) × attacks_per_use

is_nova_eligible:
  = combat_ability_definition.is_nova_eligible

is_sustained_eligible:
  = combat_ability_definition.is_sustained_eligible

## Requirements
- SQLAlchemy models, full type hints
- Alembic migration
- character_stat and character_skill must validate that the
  stat/skill definition belongs to the same rule system as the
  character's campaign rule system (enforce at application layer,
  not DB constraint — note this in the plan)
- No seed data needed — these are populated per character

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `character_stat` table created with unique constraint
- [x] `character_skill` table created with unique constraint
- [x] `character_combat_ability` table created
- [x] Alembic migration runs cleanly up and down
- [x] All FK relationships correct
- [x] No seed data added (correct — populated per character)
- [x] Plan notes the application-layer validation approach for rule system consistency

---

### Task 1.3 — Campaign Rule System Association

**Status:** [x] Complete

**Depends on:** Task 1.1 complete

**Prompt:**
```
Continuing the combat update. Adding rule system association to campaigns
so the app knows which rule system a campaign uses, and characters inherit
this context. Read CLAUDE.md for project context. Present a plan before coding.

## Schema Changes

### campaigns table (alter existing)
Add column:
- rule_system_id (FK → rule_system, nullable initially)
  Make nullable for migration safety — existing campaigns get null,
  which defaults to D&D 5.5e in application logic.

## Application Logic
Add a helper that resolves a campaign's effective rule system:
  get_campaign_rule_system(campaign_id, db) -> RuleSystem
  Returns the campaign's rule_system if set, otherwise returns
  the rule_system with is_default=True.

## API Changes

### GET /api/v1/campaigns/{id}
Add rule_system to response payload:
  rule_system: { id, slug, name, version }

### PUT /api/v1/campaigns/{id}
Allow updating rule_system_id.

### GET /api/v1/rule-systems (new endpoint)
Returns all available rule systems for the campaign settings UI.
Response: list of { id, slug, name, version, is_default }

## Requirements
- Alembic migration (nullable column addition)
- Update CampaignResponse Pydantic schema
- No data loss to existing campaigns (nullable column)
- Unit test: get_campaign_rule_system returns default when null

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `rule_system_id` column added to campaigns (nullable)
- [x] Alembic migration runs cleanly
- [x] `get_campaign_rule_system()` helper implemented and tested
- [x] Campaign response schema updated to include rule_system
- [x] PUT campaign endpoint accepts rule_system_id
- [x] GET /api/v1/rule-systems endpoint returns all systems
- [x] Unit test passes

---

## Phase 2: Rule System Abstraction — Python Abstract Classes

---

### Task 2.1 — Abstract Rule System Interface

**Status:** [x] Complete

**Depends on:** Tasks 1.1, 1.2, 1.3 complete

**Prompt:**
```
Continuing the combat update. Building the abstract class layer that
models rule-system data into structured in-memory objects using Python
abstract base classes and enumerations. This is pure Python — no new
database tables. Read CLAUDE.md for project context. Present a plan
before coding.

## Location
backend/app/rule_systems/ (new directory)
  __init__.py
  base.py          ← abstract classes and enumerations
  dnd_5_5e.py      ← D&D 5.5e concrete implementation
  loader.py        ← factory that returns correct implementation by slug

## base.py — Enumerations

StatType(str, Enum):
  ABILITY_SCORE = "ability_score"
  DERIVED = "derived"
  RESOURCE = "resource"
  CUSTOM = "custom"

SkillProficiency(str, Enum):
  NONE = "none"
  HALF = "half"
  FULL = "full"
  EXPERTISE = "expertise"

AbilityCategory(str, Enum):
  ATTACK = "attack"
  SPELL = "spell"
  FEATURE = "feature"
  CANTRIP = "cantrip"
  RESOURCE = "resource"

## base.py — Data Classes (frozen dataclasses, not ORM models)

@dataclass(frozen=True)
StatDefinition:
  id: int
  slug: str
  name: str
  abbreviation: str
  stat_type: StatType
  has_modifier: bool
  modifier_formula: str | None
  sort_order: int

@dataclass(frozen=True)
SkillDefinition:
  id: int
  slug: str
  name: str
  governing_stat_slug: str | None
  sort_order: int

@dataclass(frozen=True)
CombatAbilityDefinition:
  id: int
  slug: str
  name: str
  ability_category: AbilityCategory
  is_nova_eligible: bool
  is_sustained_eligible: bool

## base.py — CharacterCombatProfile
The in-memory object representing a character's full combat stats.
Built by the rule system implementation from DB records.

@dataclass
CharacterCombatProfile:
  character_id: int
  character_name: str
  rule_system_slug: str
  max_hp: int
  armor_class: int
  stats: dict[str, int]           ← slug → raw value
  modifiers: dict[str, int]       ← slug → computed modifier
  skills: dict[str, SkillProficiency]  ← slug → proficiency type
  combat_abilities: list[CharacterCombatAbility]
  nova_damage: float              ← computed by rule system
  sustained_damage_per_round: float  ← computed by rule system
  proficiency_bonus: int          ← computed from level
  level: int

@dataclass
CharacterCombatAbility:
  id: int
  name: str
  definition_slug: str
  dice_count: int
  dice_value: int
  flat_bonus: int
  is_bonus_action: bool
  attacks_per_use: int
  uses_per_combat: int | None
  average_damage_per_use: float   ← computed: (dice_count × avg_die + flat_bonus) × attacks_per_use
  is_nova_eligible: bool
  is_sustained_eligible: bool

## base.py — AbstractRuleSystem
Abstract base class all rule systems must implement.

class AbstractRuleSystem(ABC):
  slug: str  (class variable)
  name: str  (class variable)

  @abstractmethod
  def get_stat_definitions(self) -> list[StatDefinition]:
    ...

  @abstractmethod
  def get_skill_definitions(self) -> list[SkillDefinition]:
    ...

  @abstractmethod
  def get_combat_ability_definitions(self) -> list[CombatAbilityDefinition]:
    ...

  @abstractmethod
  def compute_modifier(self, stat_slug: str, value: int) -> int:
    ...

  @abstractmethod
  def compute_proficiency_bonus(self, level: int) -> int:
    ...

  @abstractmethod
  def compute_nova_damage(self, abilities: list[CharacterCombatAbility]) -> float:
    # Sum of average_damage_per_use for all is_nova_eligible abilities
    # For D&D: highest damage action + highest damage bonus action (if any)
    ...

  @abstractmethod
  def compute_sustained_damage(self, abilities: list[CharacterCombatAbility]) -> float:
    # Average damage per round using only is_sustained_eligible abilities
    ...

  @abstractmethod
  def build_character_combat_profile(
    self,
    character_id: int,
    character_name: str,
    level: int,
    max_hp: int,
    armor_class: int,
    stat_values: dict[str, int],
    skill_proficiencies: dict[str, str],
    combat_abilities: list[CharacterCombatAbility]
  ) -> CharacterCombatProfile:
    ...

## dnd_5_5e.py — Concrete Implementation

class DnD55eRuleSystem(AbstractRuleSystem):
  slug = "dnd_5_5e"
  name = "D&D 5.5e"

  Implement all abstract methods:

  compute_modifier(stat_slug, value):
    return floor((value - 10) / 2)
    (applies to all 6 ability scores; returns 0 for derived stats)

  compute_proficiency_bonus(level):
    levels 1-4: +2, 5-8: +3, 9-12: +4, 13-16: +5, 17-20: +6

  compute_nova_damage(abilities):
    nova_eligible = [a for a in abilities if a.is_nova_eligible]
    action_abilities = [a for a in nova_eligible if not a.is_bonus_action]
    bonus_abilities = [a for a in nova_eligible if a.is_bonus_action]
    best_action = max(action_abilities, key=lambda a: a.average_damage_per_use,
                      default=None)
    best_bonus = max(bonus_abilities, key=lambda a: a.average_damage_per_use,
                     default=None)
    total = 0
    if best_action: total += best_action.average_damage_per_use
    if best_bonus: total += best_bonus.average_damage_per_use
    return total

  compute_sustained_damage(abilities):
    sustained = [a for a in abilities if a.is_sustained_eligible]
    action_sustained = [a for a in sustained if not a.is_bonus_action]
    bonus_sustained = [a for a in sustained if a.is_bonus_action]
    best_action = max(action_sustained, key=lambda a: a.average_damage_per_use,
                      default=None)
    best_bonus = max(bonus_sustained, key=lambda a: a.average_damage_per_use,
                     default=None)
    total = 0
    if best_action: total += best_action.average_damage_per_use
    if best_bonus: total += best_bonus.average_damage_per_use
    return total

  build_character_combat_profile: assembles all the above into a
    CharacterCombatProfile dataclass

## loader.py — Rule System Factory

def get_rule_system(slug: str) -> AbstractRuleSystem:
  registry = { "dnd_5_5e": DnD55eRuleSystem() }
  if slug not in registry:
    raise ValueError(f"Unknown rule system: {slug}")
  return registry[slug]

def get_default_rule_system() -> AbstractRuleSystem:
  return get_rule_system("dnd_5_5e")

## Requirements
- Full type hints throughout, no `any` types
- All dataclasses frozen where appropriate
- Pure Python — no database access in this module
  (DB records are loaded by the service layer and passed in)
- Unit tests:
  1. DnD55e compute_modifier: STR 10 → 0, DEX 16 → +3, CHA 8 → -1
  2. DnD55e compute_proficiency_bonus: levels 1,5,9,13,17 → 2,3,4,5,6
  3. DnD55e compute_nova_damage: cleric with Inflict Wounds L3 (action,
     nova=true, 3d10, avg 16.5) + Spiritual Weapon L3 (bonus action,
     nova=true, 2d6+4, avg 11) → 27.5
  4. DnD55e compute_nova_damage: two nova-eligible actions — only the
     higher one is taken plus best bonus action
  5. DnD55e compute_sustained_damage: weapon attack (1d8+3, avg 7.5) +
     bonus cantrip (2d6, avg 7) → 14.5
  6. get_rule_system("dnd_5_5e") returns DnD55eRuleSystem instance
  7. get_rule_system("unknown_system") raises ValueError

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `backend/app/rule_systems/` directory created with all 4 files
- [x] All enumerations defined in `base.py`
- [x] All frozen dataclasses defined in `base.py`
- [x] `AbstractRuleSystem` ABC defined with all abstract methods
- [x] `DnD55eRuleSystem` implements all abstract methods correctly
- [x] `loader.py` factory implemented
- [x] All 7 unit tests pass
- [x] No database access in the rule_systems module

---

### Task 2.2 — Character Combat Profile Service

**Status:** [x] Complete

**Depends on:** Tasks 1.2, 2.1 complete

**Prompt:**
```
Continuing the combat update. Building the service layer that loads
character data from the database and uses the rule system abstraction
to build CharacterCombatProfile objects. This is where the DB layer
and the abstract class layer connect. Read CLAUDE.md for context.
Present a plan before coding.

## Location
backend/app/monster_factory/services/character_combat_service.py

## Functions

### load_character_combat_profile
load_character_combat_profile(
  character_id: int,
  db: Session
) -> CharacterCombatProfile

Steps:
1. Load character record (name, level, max_hp, armor_class)
2. Load campaign to get rule_system via get_campaign_rule_system()
3. Get the rule system implementation via get_rule_system(slug)
4. Load all character_stat records for this character, joined to stat_definition
5. Load all character_skill records, joined to skill_definition
6. Load all character_combat_ability records, joined to combat_ability_definition
7. Build CharacterCombatAbility dataclass list from ORM records
   (computing average_damage_per_use for each)
8. Call rule_system.build_character_combat_profile() with all loaded data
9. Return the CharacterCombatProfile

### load_campaign_combat_profiles
load_campaign_combat_profiles(
  campaign_id: int,
  db: Session
) -> list[CharacterCombatProfile]

Loads profiles for all characters in a campaign.
Returns empty list if no characters have combat stats configured.
Orders results by character name.

### get_campaign_party_summary
get_campaign_party_summary(
  campaign_id: int,
  db: Session
) -> PartySummary

PartySummary dataclass:
  campaign_id: int
  rule_system_slug: str
  characters: list[CharacterCombatProfile]
  party_size: int
  avg_level: float
  avg_hp: float
  total_hp: int
  lowest_hp: int
  avg_ac: float
  party_nova: float          ← sum of all character nova_damage
  party_sustained: float     ← sum of all character sustained_damage_per_round
  has_complete_data: bool    ← true if all characters have combat stats set up
  incomplete_characters: list[str]  ← names of characters missing combat data

## Missing Data Handling
A character is considered to have complete combat data if they have:
- At least one character_stat record (HP and AC can come from character table)
- At least one character_combat_ability record

Characters missing combat abilities get nova_damage=0, sustained_damage=0
and are added to incomplete_characters in PartySummary.

## Requirements
- Full type hints, no `any` types
- DB session injection
- Integration tests:
  1. Single character with full data returns correct CharacterCombatProfile
     with correctly computed nova and sustained damage
  2. Campaign with 4 characters returns PartySummary with correct
     party_nova (sum of all), correct lowest_hp
  3. Campaign with one character missing combat abilities: that character
     appears in incomplete_characters, has_complete_data=False
  4. Empty campaign (no characters) returns PartySummary with
     party_size=0 and has_complete_data=False

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `character_combat_service.py` created at correct path
- [x] `load_character_combat_profile()` loads and assembles all data correctly
- [x] `load_campaign_combat_profiles()` returns ordered list
- [x] `get_campaign_party_summary()` computes all summary fields correctly
- [x] `has_complete_data` and `incomplete_characters` populated correctly
- [x] All 4 integration tests pass
- [x] No business logic in this file (delegated to rule system)

---

### Task 2.3 — Character Combat Stats API Endpoints

**Status:** [x] Complete

**Depends on:** Task 2.2 complete

**Prompt:**
```
Continuing the combat update. Adding API endpoints for managing
character combat stats, skills, and combat abilities, and for
reading the computed combat profile. Read CLAUDE.md for context.
Present a plan before coding.

## New Router
backend/app/characters/combat_router.py
Register under prefix /api/v1/characters/{character_id}/combat

## Endpoints

### Combat Profile (read)
GET /api/v1/characters/{character_id}/combat/profile
Response: CharacterCombatProfile serialized to JSON
Includes computed nova_damage and sustained_damage_per_round.

### Stats
GET    /api/v1/characters/{character_id}/combat/stats
Response: list of { stat_definition: {...}, value: int, computed_modifier: int }

PUT    /api/v1/characters/{character_id}/combat/stats
Body: list of { stat_definition_id: int, value: int, override_modifier?: int }
Behavior: upsert — creates or updates each stat.
Validates all stat_definitions belong to the campaign's rule system.

### Skills
GET    /api/v1/characters/{character_id}/combat/skills
Response: list of { skill_definition: {...}, proficiency_type: str,
                    additional_bonus: int, computed_bonus: int }
computed_bonus = governing_stat_modifier + proficiency_contribution + additional_bonus

PUT    /api/v1/characters/{character_id}/combat/skills
Body: list of { skill_definition_id: int, proficiency_type: str,
                additional_bonus: int }
Behavior: upsert.

### Combat Abilities
GET    /api/v1/characters/{character_id}/combat/abilities
Response: list of CharacterCombatAbility (with computed average_damage_per_use)
  Includes is_nova_eligible and is_sustained_eligible from the definition.

POST   /api/v1/characters/{character_id}/combat/abilities
Body: {
  combat_ability_definition_id: int,
  name: str,
  dice_count: int,
  dice_value: int,
  flat_bonus: int,
  is_bonus_action: bool,
  attacks_per_use: int,
  uses_per_combat: int | null,
  notes: str | null
}
Response: created CharacterCombatAbility with computed average_damage_per_use

PUT    /api/v1/characters/{character_id}/combat/abilities/{ability_id}
Body: same as POST
Response: updated CharacterCombatAbility

DELETE /api/v1/characters/{character_id}/combat/abilities/{ability_id}
Response: { deleted: true, id: int }

### Campaign Party Summary
GET /api/v1/campaigns/{campaign_id}/combat/party-summary
Response: PartySummary
Used by Monster Factory to auto-load party data.

## Reference Data
GET /api/v1/rule-systems/{rule_system_id}/stat-definitions
GET /api/v1/rule-systems/{rule_system_id}/skill-definitions
GET /api/v1/rule-systems/{rule_system_id}/combat-ability-definitions
These return the seeded definition lists for a rule system,
used to populate dropdowns in the character setup UI.

## Requirements
- Full Pydantic schemas, full type hints, no `any` types
- Consistent error format matching existing API error shape
- Validate character belongs to a campaign before any operation
- All upsert endpoints are idempotent

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] All 13 endpoints implemented (spec miscounted; 13 including all reference data)
- [x] Upsert behavior correct (creates or updates, no duplicates)
- [x] Rule system validation on stat/skill assignment
- [x] `computed_modifier` and `computed_bonus` returned correctly
- [x] `average_damage_per_use` computed and returned on all ability responses
- [x] Party summary endpoint returns PartySummary from service
- [x] 3 reference data endpoints return seeded definitions
- [x] No TypeScript errors if any frontend types updated

---

## Phase 3: Character Combat Setup UI

---

### Task 3.1 — Character Combat Stats Editor

**Status:** [x] Complete

**Depends on:** Task 2.3 complete

**Prompt:**
```
Continuing the combat update. Building the UI for a DM to configure
a character's combat stats, skills, and combat abilities.
Read CLAUDE.md for context. Present a plan before coding.

## Location
frontend/src/components/Characters/CombatStatsEditor.tsx
Accessible from the existing character detail page as a new
"Combat Stats" tab.

## Tab 1: Ability Scores
Grid showing all 6 ability scores (from stat_definitions where
stat_type = "ability_score" for the campaign's rule system).

Each row:
- Stat name and abbreviation
- Number input for score value (1–30)
- Computed modifier displayed read-only (e.g. "+3")

Autosave on blur (calls PUT /combat/stats).

Derived stats section below (read-only, computed from ability scores):
- Proficiency Bonus (from level)
- Initiative (DEX modifier)

## Tab 2: Combat Abilities
This is the most important tab — drives nova and sustained calculations.

### Computed Summary (always visible at top of tab)
- Nova Damage: [n] (auto-calculated, updates as abilities change)
- Sustained Damage/Round: [n] (auto-calculated)
- Brief explanation: "Nova = best action ability + best bonus action
  ability. Sustained = best action + best bonus action from
  sustained-eligible abilities."

### Ability List
Table showing all saved combat abilities:
- Name
- Definition type (e.g. "3rd Level Spell", "Weapon Attack")
- Dice notation (e.g. "3d10+5")
- Avg damage per use (computed, shown in gray)
- Is bonus action (icon)
- Nova eligible / Sustained eligible (icons)
- Edit button, Delete button

### Add/Edit Ability Form (inline, expands below the list)
Fields:
- Ability type: dropdown of combat_ability_definitions for the
  campaign's rule system, grouped by ability_category
- Name: text input (pre-fills with definition name, editable)
- Dice count: number input (1–20)
- Dice value: dropdown (d4, d6, d8, d10, d12, d20)
- Flat bonus: number input (-10 to +20)
- Bonus action: toggle
- Attacks per use: number input (1–10, default 1)
- Uses per combat: number input (nullable — blank = unlimited)
- Notes: textarea (optional)

Live preview below form:
  "Average damage per use: [n]"
  "This ability is: [Nova eligible ✓] [Sustained eligible ✓]"

Save / Cancel buttons.

## Requirements
- TypeScript strict, no `any` types
- React Hook Form for the ability form
- Autosave for ability scores on blur
- Optimistic updates for delete
- Loading states on all async operations
- Mobile responsive

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] "Combat Stats" tab added to character detail page
- [x] Ability scores grid renders all 6 scores with computed modifiers
- [x] Autosave on blur works for ability scores
- [x] Combat abilities list renders correctly
- [x] Add/edit ability form works with live damage preview
- [x] Nova and sustained damage summary updates when abilities change
- [x] Delete ability with confirmation works
- [x] No TypeScript errors

---

## Phase 4: Monster Factory — Auto Party Loading

---

### Task 4.1 — Monster Factory Party Auto-Load

**Status:** [x] Complete

**Depends on:** Tasks 2.3, 3.1 complete

**Prompt:**
```
Continuing the combat update. Updating the Monster Factory to
automatically load party data from the current campaign's characters
instead of requiring manual input. Read CLAUDE.md for context.
Present a plan before coding.

## Changes to PartyProfileInput Component

### New Behavior
When the Monster Factory is opened from within a campaign context
(i.e. the user is viewing a campaign), the party profile input
should auto-populate from the campaign's character combat profiles.

Auto-load sequence:
1. Call GET /api/v1/campaigns/{campaign_id}/combat/party-summary
2. If has_complete_data=true:
   - Populate all party member rows from loaded profiles
   - Show character names in each row (read-only name field)
   - Show computed nova and sustained values (editable override possible)
   - Show a green "Party loaded from campaign characters" banner
3. If has_complete_data=false (some characters missing data):
   - Load the characters that do have data
   - Show an amber warning banner listing incomplete_characters
   - Those characters show with 0 nova/sustained and amber highlight
   - "Set up combat stats" link per incomplete character opening
     their combat stats editor
4. If no characters have data at all:
   - Fall through to manual entry (existing behavior)
   - Show info banner: "Set up character combat stats to auto-load
     party data"

### Character Row Updates
When auto-loaded, each party member row shows:
- Character name (read-only label, not editable)
- Max HP (pre-filled, editable override)
- AC (pre-filled, editable override)
- Nova Damage (pre-filled from computed value, editable override)
- Sustained Damage/Round (pre-filled from computed value, editable override)
- "Edit character" icon link to character combat stats editor

### Campaign Context Prop
Add optional campaignId prop to EncounterWizard:
  campaignId?: number

When provided, triggers the auto-load behavior.
When absent, falls back to existing manual entry.

## Changes to Monster Factory Page
If Monster Factory is accessible from a campaign page
(add a "Monster Factory" button to the campaign view),
pass the campaignId into EncounterWizard.

## Requirements
- TypeScript strict, no `any` types
- Auto-load on mount when campaignId is provided
- Manual overrides always possible — auto-loaded values are
  editable starting points, not locked
- Loading state while fetching party summary
- Graceful handling if party summary endpoint fails

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `campaignId` prop added to EncounterWizard
- [x] Auto-load fires on mount when campaignId provided
- [x] Party rows populated from character profiles
- [x] Character names shown read-only
- [x] Green banner shown when has_complete_data=true
- [x] Amber warning with incomplete character list shown when partial
- [x] Manual override still works on all pre-filled fields
- [x] "Monster Factory" accessible from campaign nav (existing link sufficient)
- [x] No TypeScript errors

---

## Phase 5: Monster Factory — Inline Editing and Renaming

---

### Task 5.1 — Monster and Ability Renaming in Output

**Status:** [x] Complete

**Depends on:** Monster Factory Task 4.4 complete (GeneratedEncounterView)

**Prompt:**
```
Continuing the combat update. Adding inline renaming of monsters
and abilities in the Monster Factory output view.
Read CLAUDE.md for context. Present a plan before coding.

## Monster Name Renaming
In MonsterStatBlockCard, the monster name in the header should be
inline-editable:
- Default state: renders as styled heading
- On click: switches to a text input with the current name
- On blur or Enter: saves the new name and returns to heading display
- On Escape: cancels, reverts to previous name
- Update propagates up to GeneratedEncounter state via a callback:
  onMonsterRenamed(slotIndex: int, newName: string)

## Ability Renaming
In the Actions section of MonsterStatBlockCard, each ability name
should be inline-editable using the same click-to-edit pattern:
- Default: bold ability name
- On click: text input
- On blur/Enter: saves, returns to display
- On Escape: cancels
- Update propagates via callback:
  onAbilityRenamed(slotIndex: int, abilityIndex: int,
                   isLegendary: bool, newName: string)

## State Management
Both rename callbacks live on GeneratedEncounterView, which holds
the GeneratedEncounter in local state.
When a rename occurs, update the local GeneratedEncounter state.
Renames are in-memory only — they are persisted when the user
clicks "Save Encounter" (the saved name is whatever is in state
at save time).

## Visual Design
- Editable fields should have a subtle underline or pencil icon
  on hover to indicate they are editable
- Edit mode should use a minimal input that matches the heading/text
  style of the original element
- No explicit edit/save buttons — blur-to-save is sufficient

## Requirements
- TypeScript strict, no `any` types
- Custom hook useInlineEdit(initialValue, onSave) for the
  click-to-edit pattern (reusable)
- Works on mobile (tap to edit)
- No TypeScript errors

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Monster name click-to-edit works in MonsterStatBlockCard header
- [x] Ability name click-to-edit works for each action
- [x] Legendary action names editable
- [x] Escape cancels without saving
- [x] Enter and blur both save
- [x] `useInlineEdit` hook extracted and reusable
- [x] Hover indicator on editable fields
- [x] State updated in GeneratedEncounterView
- [x] Saved encounter uses renamed values
- [x] No TypeScript errors

---

## Phase 6: D&D Beyond Homebrew Export

---

### Task 6.1 — D&D Beyond Export Format Generator

**Status:** [x] Complete

**Depends on:** Task 5.1 complete (so exported names reflect renames)

**Prompt:**
```
Continuing the combat update. Building a D&D Beyond homebrew monster
export formatter. The goal is to produce text that a DM can paste
directly into D&D Beyond's homebrew monster creation form with
minimal manual work. Read CLAUDE.md for context. Present a plan
before coding.

## D&D Beyond Homebrew Monster Form Fields
Based on the D&D Beyond tutorial, the form has these text sections:
- Name (plain text)
- Type (plain text, e.g. "undead")
- Size (plain text, e.g. "Large")
- Challenge Rating (plain text or number)
- Is Legendary (checkbox — noted in export)
- Special Traits Description (freeform text with optional rollable tags)
- Actions Description (freeform text with optional rollable tags)
- Bonus Actions Description (freeform text)
- Reactions Description (freeform text)
- Legendary Actions Description (freeform text)
- Lair / Lair Actions Description (freeform text)
- Monster Characteristics Description (flavor text)

Numeric stat block fields (entered separately on the form):
- HP, AC, Speed
- STR, DEX, CON, INT, WIS, CHA

Metadata (added after initial creation):
- Languages, Senses, Skills, Movement

## Export Format

### Backend: Generate DnD Beyond Export
New endpoint:
POST /api/v1/monster-factory/export/dndbeyond
Body: { monster: GeneratedMonster }
Response: DnDBeyondExport

DnDBeyondExport Pydantic model:
- name: str
- meta_line: str  — e.g. "Large Undead (Shadow), Neutral Evil"
- cr_suggestion: str  — "—" (Monster Factory doesn't use CR)
- is_legendary: bool

Stat block fields (copy these directly into the numeric inputs):
- hp: int
- hp_dice: str  — e.g. "20d10 + 100"
- ac: int
- speed: str  — e.g. "0 ft., fly 40 ft. (hover)"
- str_score, dex_score, con_score, int_score, wis_score, cha_score: int

Text sections (paste these directly into the text fields):
- special_traits_text: str
- actions_text: str
- bonus_actions_text: str  — empty string if none
- reactions_text: str  — empty string if none
- legendary_actions_text: str  — empty string if not boss
- lair_actions_text: str  — empty string if not enabled
- characteristics_text: str  — flavor/description placeholder

Rollable tag format for D&D Beyond:
D&D Beyond supports rollable dice expressions in this format:
  [[/r XdY+Z]]
e.g. "[[/r 2d6+3]] slashing damage" or "DC 13 [[/save 13 dex]]"

All damage expressions in actions_text and legendary_actions_text
should use this rollable tag format.

Saving throw format: [[/save DC ability_abbrev]]
e.g. [[/save 13 wis]]

### Frontend: Export Panel in GeneratedEncounterView

Add a "Export" button per MonsterStatBlockCard.
Clicking opens a modal: "Export to D&D Beyond"

Modal layout:
Section 1: "Copy these values into the stat block numeric fields"
  - Displayed as a clean table:
    HP | AC | Speed | STR | DEX | CON | INT | WIS | CHA
  - One-click copy button per field

Section 2: "Paste each section into the matching text field"
  For each non-empty text section, show:
  - Section header (e.g. "Actions Description")
  - Text content in a read-only textarea (auto-height)
  - "Copy" button that copies to clipboard
  - Brief label: "→ Paste into [Field Name] on D&D Beyond"

Section 3: "Metadata to add after saving"
  - Senses list (darkvision, passive perception, etc.)
  - Skills list
  - Languages
  (These are added in the metadata step on D&D Beyond after
   initial monster creation)

Footer:
  Link: "Open D&D Beyond Homebrew Creator" →
  https://www.dndbeyond.com/homebrew/creations/create-monster
  Opens in new tab.

## Requirements
- Backend: Full Pydantic schema, type hints
- Rollable tag formatting applied to all damage dice in text output
- Saving throw tags applied to all save DCs
- Frontend: TypeScript strict, clipboard API for copy buttons
- Copy confirmation (button briefly shows "Copied!")
- All text areas readable and appropriately sized

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] POST /export/dndbeyond endpoint implemented
- [x] All text sections formatted correctly
- [x] Rollable tags `[[/r XdY+Z]]` applied to all damage expressions
- [x] Saving throw tags applied to all DC references
- [x] `DnDBeyondExport` Pydantic schema complete
- [x] Frontend export modal opens per monster
- [x] Numeric fields displayed in copy-per-field table
- [x] Each text section has its own copy button
- [x] Copy confirmation feedback on buttons
- [x] D&D Beyond creator link in modal footer
- [x] No TypeScript errors

---

## Phase 7: Scene Integration

---

### Task 7.1 — Scene Enemy FK to Saved Encounter Monster

**Status:** [x] Complete

**Depends on:** Monster Factory Task 3.1 complete (saved_encounter_monster exists)

**Prompt:**
```
Continuing the combat update. Linking the existing scene_enemies
table to the monster factory's saved_encounter_monster table.
Read CLAUDE.md for context. Present a plan before coding.

## Schema Change

### scene_enemies table (alter existing)
Add column:
- saved_encounter_monster_id (FK → saved_encounter_monster, nullable)
  This is optional — enemies can still be plain text entries
  without a linked stat block.

## Application Logic

### When saved_encounter_monster_id is set on a scene_enemy:
- The enemy's name can be derived from the linked stat block
  (but scene_enemy.name remains the override — whatever is in
  scene_enemy.name is what displays, FK is for stat block access)
- The linked stat block is accessible via the FK for display
  in the scene UI

## API Changes

### GET /api/v1/scenes/{scene_id}/enemies
Include saved_encounter_monster_id in response.
If set, also include a nested stat_block_summary:
  { id, name, hp, ac, is_boss, combat_role_name }

### PUT /api/v1/scenes/{scene_id}/enemies/{enemy_id}
Allow setting saved_encounter_monster_id (nullable).

### GET /api/v1/scenes/{scene_id}/enemies/{enemy_id}/stat-block
New endpoint. Returns full MonsterStatBlock if
saved_encounter_monster_id is set.
Returns 404 if no stat block linked.

## Requirements
- Alembic migration (nullable column, no data loss)
- Update enemy response schema to include stat_block_summary
- No breaking changes to existing scene enemy behavior

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `saved_encounter_monster_id` column added (nullable)
- [x] Alembic migration runs cleanly
- [x] GET enemies includes stat_block_summary when FK is set
- [x] PUT enemies accepts saved_encounter_monster_id
- [x] GET stat-block endpoint returns full stat block or 404
- [x] No existing scene enemy functionality broken

---

### Task 7.2 — Monster Factory Modal in Scene Editor

**Status:** [x] Complete

**Depends on:** Task 7.1 complete, Monster Factory Task 5.2 complete (full wizard)

**Prompt:**
```
Continuing the combat update. Adding a "Create with Monster Factory"
flow to the combat scene editor, and a stat block viewer per enemy row.
Read CLAUDE.md for context. Present a plan before coding.

## Combat Scene Editor Changes

### "Attach Saved Encounter" Button
In the combat scene editor, add:
"Attach Saved Encounter" button that opens a modal listing
all SavedEncounters. Selecting one:
- Sets the scene's linked saved_encounter_id (store on scene or
  as a scene metadata field — check how scene_enemies currently
  stores encounter context)
- Offers to auto-populate enemies from the encounter's monsters
  (one enemy row per monster type, count from the encounter)
  with each enemy's saved_encounter_monster_id set

### "Create with Monster Factory" Button
In the combat scene editor enemy section, add a
"+ Create with Monster Factory" button.

Clicking opens a full-screen modal containing the complete
EncounterWizard (all 3 steps: Party → Composition → Review).
Pass the current campaign's campaignId for auto party loading.

The modal has:
- Close (X) button top right — discards and closes
- In Step 3 (GeneratedEncounterView), replace the normal
  "Save Encounter" button with "Save & Add to Scene" button

"Save & Add to Scene" behavior:
1. Call POST /api/v1/monster-factory/encounters to save the encounter
2. For each GeneratedMonster in the encounter:
   a. Call POST /api/v1/monster-factory/monsters/templates
      to save each as a template (or use the saved encounter monsters)
   b. Create a scene_enemy row with:
      - name: monster's name (including any renames from Task 5.1)
      - quantity: monster's count
      - saved_encounter_monster_id: the ID from the saved encounter
3. Close the modal
4. Scene enemy list refreshes showing the new enemies with
   stat block links

### Stat Block Button on Enemy Rows
Each enemy row in the combat scene editor should show a
"Stat Block" button (only visible when saved_encounter_monster_id is set).

Clicking "Stat Block" opens a read-only modal showing:
- Full MonsterStatBlockCard for that enemy
- Modal has a close button
- Optional: "Export to D&D Beyond" button in the modal footer
  (reuses the export modal from Task 6.1)

## Requirements
- TypeScript strict, no `any` types
- Monster Factory modal is full-screen on mobile, large modal on desktop
- Stat block modal is scrollable
- No breaking changes to existing scene enemy UI
- Loading states on all async operations

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] "Attach Saved Encounter" button opens saved encounter picker
- [x] Selecting a saved encounter offers to populate enemies
- [x] Enemy rows populated with correct saved_encounter_monster_id
- [x] "Create with Monster Factory" button opens full wizard in modal
- [x] Monster Factory modal receives campaignId for auto party loading
- [x] "Save & Add to Scene" saves encounter and populates enemies
- [x] Scene enemy list refreshes after wizard completes
- [x] "Stat Block" button appears on rows with linked stat blocks
- [x] Stat block modal shows full MonsterStatBlockCard
- [x] D&D Beyond export accessible from stat block modal
- [x] No TypeScript errors

---

## Phase 8: CLAUDE.md Update

---

### Task 8.1 — Update CLAUDE.md

**Status:** [x] Complete

**Depends on:** All previous tasks complete

**Prompt:**
```
All combat update tasks are complete. Update CLAUDE.md to document
the new systems added in this build. Add a section called
"## Combat & Rule System Architecture" that documents:

1. Rule system abstraction location and how to add a new rule system
   (create a new class in backend/app/rule_systems/, extend
   AbstractRuleSystem, register in loader.py)

2. How nova damage is calculated (best action ability +
   best bonus action ability, only is_nova_eligible abilities)

3. How sustained damage is calculated (same pattern but
   is_sustained_eligible abilities)

4. The three-layer data flow:
   DB tables (character_combat_ability etc.)
   → service layer (character_combat_service.py)
   → rule system layer (DnD55eRuleSystem)
   → CharacterCombatProfile (in-memory object)
   → Monster Factory (party auto-load)

5. Scene enemy stat block linking: scene_enemies.saved_encounter_monster_id
   is optional FK to saved_encounter_monster

Also update the "## Build Files" section to add:
  Combat update build instructions: @docs/COMBAT_UPDATE.md
  All tasks complete.

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] CLAUDE.md updated with rule system architecture section
- [x] Nova and sustained damage calculation documented
- [x] Three-layer data flow documented
- [x] Scene enemy stat block linking documented
- [x] Build files section updated

---

## Task Summary

| Task | Description | Phase |
|---|---|---|
| 1.1 | Rule system + stat/skill/ability definition tables | DB Layer |
| 1.2 | Character stat, skill, and combat ability tables | DB Layer |
| 1.3 | Campaign rule system association | DB Layer |
| 2.1 | Abstract rule system interface + D&D 5.5e implementation | Abstraction |
| 2.2 | Character combat profile service | Abstraction |
| 2.3 | Character combat stats API endpoints | Abstraction |
| 3.1 | Character combat stats editor UI | Character UI |
| 4.1 | Monster Factory party auto-load from campaign | Monster Factory |
| 5.1 | Monster and ability renaming in output | Monster Factory |
| 6.1 | D&D Beyond export format generator | Export |
| 7.1 | Scene enemy FK to saved encounter monster | Scene |
| 7.2 | Monster Factory modal in scene editor + stat block viewer | Scene |
| 8.1 | CLAUDE.md update | Documentation |