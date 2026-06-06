# Monster Factory — Build Instructions

## How to Use This File (Pattern B — Autonomous Run)

Hand this file to Claude Code with the following instruction:

```
Read docs/MONSTER_FACTORY_BUILD.md and work through all incomplete tasks
in order. Before beginning each task, state the task number and name, then
present a plan and wait for my approval before writing any code. After I
approve, implement the task, verify all completion criteria pass, update
the task Status to [x] Complete, then stop and wait for me to confirm
before moving to the next task. Do not skip tasks or combine tasks.
```

**Rules Claude Code must follow:**
- Never begin a task until the previous task's Status is marked `[x] Complete`
- Always present a plan and receive explicit approval before writing code
- Always verify completion criteria before marking a task done
- If a task fails or produces unexpected results, stop and report — do not proceed
- All tasks assume the project context in CLAUDE.md

**Phases completed prior to this file:**
- Phase 1 (Tasks 1.1–1.4): Data models, archetypes, encounter templates, GM profile API — ✅ Done
- Phase 2 Tasks 2.1–2.3: Party profile calculator, difficulty target calculator, monster stat calculator — ✅ Done

---

## Phase 2 (Continued): Calculation Engine

---

### Task 2.4 — Ability Assignment Engine

**Status:** [x] Complete

**Depends on:** Tasks 2.1, 2.2, 2.3 complete

**Location:** `backend/app/monster_factory/calculators/ability_assignment.py`

**Prompt:**
```
Continuing Monster Factory. Building the ability assignment engine
that selects and names abilities for a generated monster.
Pure Python — no database access except receiving pre-loaded data
as function arguments. Read CLAUDE.md for project context.
Present a plan before writing any code.

## Purpose
Given a monster's role, creature archetype, and calculated stats —
select appropriate named abilities from the flavor library and
produce fully formed action objects ready for the stat block.

## Input
- combat_role (CombatRoleArchetype ORM object or equivalent Pydantic model)
- creature_archetype (CreatureArchetype ORM object or equivalent Pydantic model)
- calculated_stats (CalculatedMonsterStats from Task 2.3)
- is_boss (boolean)
- available_flavors (list of AbilityFlavor with role and creature mappings pre-loaded)
- gm_settings (MinionSettings)

## Output Schemas (Pydantic)

AssignedAbility:
- name (string) e.g. "Claw", "Sear"
- damage_dice (string) e.g. "2d6"
- damage_bonus (int)
- damage_type (string)
- attack_bonus (int)
- range (string) e.g. "melee 5ft", "ranged 60ft"
- description (string)
- is_legendary (boolean)
- action_cost (int) — 1 for standard legendary, 2 for powerful legendary

MonsterAbilitySet:
- standard_actions (list of AssignedAbility)
- legendary_actions (list of AssignedAbility, empty list if not boss)
- lair_actions (list of AssignedAbility, empty list if not enabled)
- special_traits (list of string) — passive traits derived from creature archetype
- multiattack_description (string, empty string if attack_count <= 1)

## Selection Logic

### Attack ability selection priority
1. Filter flavor library to abilities matching BOTH this role AND this creature type
2. If no matches on both criteria: fall back to role-only matches
3. If still no matches: use generic fallback
   - Melee roles: "Strike" / bludgeoning
   - Ranged roles: "Bolt" / piercing
   - Caster roles: "Hex" / necrotic
4. Select up to attack_count abilities, prefer variety of damage types
   when multiple options exist
5. Assign calculated damage_dice and damage_bonus from CalculatedMonsterStats
   to each selected ability

### Multiattack description
If attack_count > 1 (from CalculatedMonsterStats):
  multiattack_description = "The [creature archetype name] makes
  [attack_count] attacks: [comma-separated attack names]."

### Special traits
Pull from creature_archetype.typical_traits list and format each as a
named passive trait block. Use this format:
  "[Trait Name]. [One sentence description of the trait's effect.]"

Examples by archetype:
- Undead: "Undying Resilience. The creature is immune to exhaustion
  and the poisoned condition."
- Demon: "Infernal Nature. The creature is immune to fire damage."
- Shadow: "Incorporeal Movement. The creature can move through other
  creatures and objects as if they were difficult terrain."
- Beast: "Keen Senses. The creature has advantage on Perception checks
  that rely on smell."

### Legendary action generation (boss only)
If is_boss is True and calculated_stats.legendary_action_count > 0:
  Generate at least (legendary_action_count + 1) options so the DM
  has choices beyond the minimum:

  Always include these two:
  - Move option (action_cost 1): "Move up to its speed without
    provoking opportunity attacks."
  - Attack option (action_cost 1): Reuses one of the standard attacks
    at action_cost 1

  Add one role-appropriate special option (action_cost 2):
  - Bruiser/Tank: "Shove. One creature within 5 ft must succeed on a
    Strength saving throw (DC [save_dc]) or be pushed 15 ft and knocked prone."
  - Controller/Caster: "Unravel. One creature within 60 ft must succeed
    on a Wisdom saving throw (DC [save_dc]) or become incapacitated
    until the end of its next turn."
  - Assassin/Skirmisher: "Vanish. The creature takes the Hide action
    and moves up to half its speed."
  - Archer: "Suppressing Fire. One creature within range must succeed
    on a Dexterity saving throw (DC [save_dc]) or have disadvantage
    on attack rolls until the end of its next turn."
  - Support: "Bolster. One allied creature within 30 ft regains
    hit points equal to [save_dc]."
  - Default (no role match): use the Controller option

### Lair action generation
If calculated_stats.has_lair_actions is True:
  Generate exactly 3 lair action options themed to the creature archetype.
  Rules for lair actions:
  - Never deal direct damage
  - Create difficult terrain, force movement, or impose conditions
  - Format: "On initiative count 20 (losing ties), the [creature]
    takes a lair action: [effect description]."

  Example themes by archetype:
  - Shadow/Undead: darkness, fear, necrotic environment
  - Demon/Fiend: fire, brimstone, corrupted terrain
  - Dragon: elemental environmental effects
  - Beast/Plant: entangling vegetation, animal calls, tremors
  - Elemental: weather, terrain matching element type
  - Default: generic environmental hazards (falling debris, blinding
    light, rumbling tremors)

## Requirements
- Function signature:
  assign_abilities(
    combat_role: CombatRoleArchetype,
    creature_archetype: CreatureArchetype,
    calculated_stats: CalculatedMonsterStats,
    is_boss: bool,
    available_flavors: list[AbilityFlavor],
    gm_settings: MinionSettings
  ) -> MonsterAbilitySet
- Pure functions only — no database access
- Full type hints throughout
- No `any` types

## Unit Tests (required before marking complete)
Write tests covering:
1. Beast + Bruiser role: verify Bite or Claw selected, not Strike or Slash
2. Demon + Caster role: verify Sear or Hex selected, not Gore
3. Humanoid + Archer role: verify Volley or Bolt selected, ranged range string
4. Unknown combo with no flavor matches: verify fallback triggers correctly,
   no exception raised
5. is_boss=True: verify multiattack description present, legendary actions
   list is non-empty, count >= legendary_action_count + 1
6. is_boss=False: verify legendary_actions is empty list
7. Creature archetype with known typical_traits: verify special_traits list
   is non-empty and formatted correctly
8. has_lair_actions=True: verify exactly 3 lair actions generated
9. Minion with one_hit_kill=True: verify stats pass through without error
   (ability assignment should be unaffected by minion HP rule)

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `ability_assignment.py` created at correct path
- [x] All Pydantic output schemas defined with full type hints
- [x] Flavor library selection priority logic implemented (both → role-only → fallback)
- [x] Multiattack description generated correctly when attack_count > 1
- [x] Special traits populated from creature archetype data
- [x] Legendary actions generated for bosses with correct action costs
- [x] Lair actions generated when enabled (exactly 3, no direct damage)
- [x] All 9 unit tests pass
- [x] No database access in this module

---

### Task 2.5 — Encounter Orchestrator

**Status:** [x] Complete

**Depends on:** Tasks 2.1, 2.2, 2.3, 2.4 complete

**Location:** `backend/app/monster_factory/calculators/encounter_orchestrator.py`

**Prompt:**
```
Continuing Monster Factory. Building the encounter orchestrator that
ties all calculators together into a complete generated encounter.
This module coordinates the other calculators and is allowed to
access the database (to load GM profile settings).
Read CLAUDE.md for project context. Present a plan before coding.

## Purpose
Takes all encounter inputs, runs all calculators in the correct order,
and returns a complete GeneratedEncounter with all monster stat blocks,
encounter-level stats, warnings, and optional math detail.

## Input Schemas (Pydantic)

EncounterCompositionSlot:
- combat_role_id (int) — FK to CombatRoleArchetype
- creature_archetype_id (int) — FK to CreatureArchetype
- count (int, min 1, max 20)
- is_boss (boolean)
- override_lair_actions (optional boolean, overrides profile setting per slot)

GenerateEncounterInput:
- party_members (list of PartyMember, min 1 max 12) — from Task 2.1 schema
- party_level (int, 1–20)
- difficulty (enum: trivial | easy | medium | hard | deadly)
- composition (list of EncounterCompositionSlot, min 1 slot)
- gm_profile_id (int) — used to load all settings groups from database
- encounter_name (optional string, defaults to "Unnamed Encounter")
- lair_actions_enabled (boolean) — top-level toggle, can be overridden per slot

## Output Schemas (Pydantic)

GeneratedMonster:
- slot_index (int) — position in composition list
- combat_role_name (string)
- creature_archetype_name (string)
- count (int)
- is_boss (boolean)
- stats (CalculatedMonsterStats) — from Task 2.3
- abilities (MonsterAbilitySet) — from Task 2.4

GeneratedEncounter:
- encounter_name (string)
- difficulty (enum)
- party_profile (PartyProfile) — from Task 2.1
- difficulty_targets (DifficultyTargets) — from Task 2.2
- monsters (list of GeneratedMonster)
- total_monster_count (int) — sum of all slot counts
- total_monster_hp (int) — sum of (monster.stats.hp × monster.count)
- total_monster_actions_per_round (float) — sum of action weights × counts
- expected_rounds (float)
- expected_rounds_min (float)
- expected_rounds_max (float)
- all_warnings (list of string) — deduplicated, from all monsters + encounter level
- math_detail (dict) — populated when gm profile show_math=True, empty dict otherwise

## Orchestration Order (must execute in this sequence)
1. Load GM profile and all settings groups from database by gm_profile_id
2. Load CombatRoleArchetype and CreatureArchetype records for all slots
3. Load AbilityFlavor library with role and creature mappings
4. calculate_party_profile(party_members, party_level, action_economy_settings)
5. calculate_difficulty_targets(difficulty, party_profile, all_gm_settings)
6. Calculate total_monster_count = sum of all slot counts
7. For each composition slot:
   a. calculate_monster_stats(combat_role, creature_archetype, is_boss,
      slot.count, total_monster_count, difficulty_targets,
      party_profile, gm_settings)
   b. assign_abilities(combat_role, creature_archetype, calculated_stats,
      is_boss, available_flavors, minion_settings)
   c. If slot is minion and minion_one_hit_kill=True: set stats.hp = 1
   d. Build GeneratedMonster object
8. Calculate encounter-level aggregates:
   - total_monster_hp
   - total_monster_actions_per_round
   - expected_rounds = total_monster_hp / party_sustained
   - expected_rounds_min = expected_rounds - round_variance_tolerance
   - expected_rounds_max = expected_rounds + round_variance_tolerance
9. Collect and deduplicate all warnings from all GeneratedMonsters
   plus encounter-level warnings (action economy, round duration)
10. If show_math=True: populate math_detail with intermediate values
    from all calculation steps
11. Return GeneratedEncounter

## Rebalancing Function
Also implement in this module:

rebalance_encounter(
  existing: GeneratedEncounter,
  new_composition: list[EncounterCompositionSlot] | None,
  new_party_members: list[PartyMember] | None,
  new_party_level: int | None,
  new_difficulty: str | None,
  gm_profile_id: int
) -> GeneratedEncounter

Rules:
- Any changed input triggers full recalculation from step 1
- Use existing values for any input passed as None
- Preserve existing encounter_name
- Return a fresh GeneratedEncounter (do not mutate existing)

## Auto-Rebalancing Behavior (apply inside calculate_monster_stats coordination)
When total_monster_count changes from a previous generation:
- Adjust individual monster HP and damage proportionally so total
  encounter threat remains constant for the selected difficulty tier
- More monsters = each individual monster has lower HP and damage
- Fewer monsters = each individual monster has higher HP and damage
- This is handled naturally by passing total_monster_count into
  calculate_monster_stats, which uses it to distribute the HP budget

## Requirements
- Full type hints throughout, no `any` types
- Database access allowed in this module (SQLAlchemy session injection)
- All calculator imports from their respective modules (Tasks 2.1–2.4)
- Graceful error handling: if a slot references a non-existent archetype ID,
  raise a descriptive ValueError before any calculation begins

## Integration Tests (required before marking complete)
Write integration tests using a test database with seeded data:

Test 1 — Boss Fight, hard difficulty, 4-player level 5 party:
  Composition: 1 Boss Dragon (Boss role) + 2 Humanoid Minions (Minion role)
  Party: 4 members, level 5, HP [38, 35, 33, 32], AC [16, 16, 15, 13],
  nova [33, 28, 25, 20.5], sustained [14, 12, 11, 11]
  Assert:
  - GeneratedEncounter returned without error
  - Dragon has is_boss=True, legendary_action_count >= 2
  - Dragon HP >= party_nova × 1.5 (nova floor check)
  - Both minions have same stats as each other
  - total_monster_count == 3
  - all_warnings is a list (may be empty or have items, just must exist)
  - expected_rounds between 3.0 and 7.0 (sanity range for hard difficulty)

Test 2 — Rebalance: add 2 more minions to Test 1 encounter
  new_composition: 1 Boss Dragon + 4 Humanoid Minions
  Assert:
  - Dragon HP is recalculated (may differ from Test 1 dragon HP)
  - total_monster_count == 5
  - encounter_name preserved from original
  - expected_rounds within hard difficulty target range

Test 3 — Minion one-hit-kill toggle
  Create a profile with minion_one_hit_kill=True
  Composition: 1 Boss + 6 Minions
  Assert: all minion stat blocks have hp == 1

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `encounter_orchestrator.py` created at correct path
- [x] `generate_encounter()` function implements all 11 orchestration steps in order
- [x] `rebalance_encounter()` function implemented with correct None-passthrough logic
- [x] DB session injection pattern consistent with existing backend patterns
- [x] Math detail populated correctly when show_math=True
- [x] Warnings deduplicated before returning
- [x] All 3 integration tests pass
- [x] Non-existent archetype ID raises descriptive ValueError

---

## Phase 3: API Layer

---

### Task 3.1 — Monster Factory API Endpoints

**Status:** [x] Complete

**Depends on:** Task 2.5 complete

**Location:** `backend/app/monster_factory/router.py` (new file) registered in main app router

**Prompt:**
```
Continuing Monster Factory. Adding the FastAPI router that exposes
the encounter orchestrator and saved encounter management.
Read CLAUDE.md for project context. Present a plan before coding.

## Endpoints

### Generate (no persistence)
POST /api/v1/monster-factory/generate
  Body: GenerateEncounterInput
  Response: GeneratedEncounter
  Note: pure calculation, nothing saved to database
  Performance requirement: must return within 500ms for a standard
  4-player encounter — flag in your plan if any code path might exceed this

### Rebalance (no persistence)
POST /api/v1/monster-factory/rebalance
  Body: {
    existing_encounter: GeneratedEncounter,
    changes: {
      composition?: list[EncounterCompositionSlot],
      party_members?: list[PartyMember],
      party_level?: int,
      difficulty?: string
    }
  }
  Response: GeneratedEncounter
  Note: pure recalculation, nothing saved

### Save Encounter
POST /api/v1/monster-factory/encounters
  Body: { encounter: GeneratedEncounter, name: string }
  Response: SavedEncounter (with all nested MonsterStatBlock records created)
  Note: persists the encounter and creates MonsterStatBlock records
  linked via SavedEncounterMonster association

### Saved Encounters
GET    /api/v1/monster-factory/encounters
  Query params: page (int, default 1), per_page (int, default 20, max 100)
  Response: { items: list[SavedEncounterSummary], total: int, page: int }
  SavedEncounterSummary includes: id, name, difficulty, party_size,
  party_avg_level, expected_rounds, total_monster_count, created_at

GET    /api/v1/monster-factory/encounters/{id}
  Response: full SavedEncounter with all nested monsters and stat blocks

DELETE /api/v1/monster-factory/encounters/{id}
  Response: { deleted: true, id: int }
  Note: cascades to delete associated SavedEncounterMonster and
  MonsterStatBlock records that are not is_saved_template

### Save Monster as Reusable Template
POST /api/v1/monster-factory/monsters/templates
  Body: { monster: GeneratedMonster, name: string }
  Response: MonsterStatBlock with is_saved_template=True

### Saved Monster Templates
GET    /api/v1/monster-factory/monsters/templates
  Query params: page, per_page
  Response: paginated list of MonsterStatBlock where is_saved_template=True

GET    /api/v1/monster-factory/monsters/templates/{id}
  Response: full MonsterStatBlock

DELETE /api/v1/monster-factory/monsters/templates/{id}
  Note: only allowed if is_saved_template=True
  Response: { deleted: true, id: int }

### Reference Data (read-only, seeded)
GET /api/v1/monster-factory/creature-archetypes
  Response: list of all CreatureArchetype records

GET /api/v1/monster-factory/combat-roles
  Response: list of all CombatRoleArchetype records

GET /api/v1/monster-factory/encounter-templates
  Response: list of all EncounterTemplate records with nested slots

GET /api/v1/monster-factory/encounter-templates/{id}
  Response: single EncounterTemplate with full slot detail including
  role names and descriptions

GET /api/v1/monster-factory/ability-flavors
  Response: list of all AbilityFlavor records with role and creature mappings

## Error Response Format
All errors must return this consistent shape:
{
  "error": "SHORT_ERROR_CODE",
  "detail": "Human readable description",
  "warnings": []  // populated for calculation warnings, empty for hard errors
}

HTTP status codes:
- 404: resource not found
- 422: validation error (Pydantic handles automatically)
- 400: business logic error (e.g. invalid composition)
- 500: unexpected server error

## Requirements
- FastAPI APIRouter, registered under prefix /api/v1/monster-factory
- Full Pydantic request and response schemas with type hints
- No `any` types
- Inject DB session via FastAPI Depends pattern (consistent with
  existing backend patterns in the project)
- No authentication required at this stage
- All list endpoints use consistent pagination pattern matching
  any existing paginated endpoints in the project

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Router file created and registered in main app
- [x] All 13 endpoints implemented
- [x] Consistent error response shape on all error paths
- [x] Pagination implemented on all list endpoints
- [x] Generate endpoint returns within 500ms (test with a standard encounter)
- [x] DELETE encounter correctly cascades, does not delete saved templates
- [x] All endpoints return correct HTTP status codes
- [x] No authentication dependency added

---

## Phase 4: Frontend UI

---

### Task 4.1 — Monster Factory Page Shell and Navigation

**Status:** [x] Complete

**Depends on:** Task 3.1 complete (API must be running for hooks to work)

**Location:** `frontend/src/pages/MonsterFactory/` (new directory)

**Prompt:**
```
Continuing Monster Factory. Adding the Monster Factory section to the
dm-toolkit React frontend. This task is the page shell only — routing,
layout, navigation, and React Query hooks. No wizard logic yet.
Read CLAUDE.md for project context. Present a plan before coding.

## New Route
/monster-factory

Add "Monster Factory" to the main app navigation alongside existing items.

## Page Layout
Top-level structure:
- Page header:
  - Title: "Monster Factory"
  - GM Profile selector: dropdown showing all profiles, current default
    pre-selected. Inline "Manage Profiles" link that opens a modal
    (the modal itself is a placeholder div for now with text
    "Profile management coming soon")
- Two top-level tabs:
  - "Create Encounter" — placeholder content: empty div with text
    "Encounter builder coming soon"
  - "Saved Encounters" — placeholder content: empty div with text
    "Saved encounters coming soon"

## React Query Hooks
Create frontend/src/hooks/useMonsterFactory.ts

Define typed hooks for every endpoint from Task 3.1. Do not wire
any hook to UI yet — just define them so later tasks can import them.

Required hooks:
- useCreatureArchetypes() → GET /creature-archetypes
- useCombatRoles() → GET /combat-roles
- useEncounterTemplates() → GET /encounter-templates
- useEncounterTemplate(id) → GET /encounter-templates/{id}
- useAbilityFlavors() → GET /ability-flavors
- useGMProfiles() → GET /profiles (from Task 1.4 router)
- useDefaultGMProfile() → derived from useGMProfiles, returns the
  profile where is_default=true
- useSavedEncounters(page, perPage) → GET /encounters
- useSavedEncounter(id) → GET /encounters/{id}
- useMonsterTemplates(page, perPage) → GET /monsters/templates
- useMonsterTemplate(id) → GET /monsters/templates/{id}
- useGenerateEncounter() → mutation for POST /generate
- useRebalanceEncounter() → mutation for POST /rebalance
- useSaveEncounter() → mutation for POST /encounters
- useSaveMonsterTemplate() → mutation for POST /monsters/templates
- useDeleteEncounter() → mutation for DELETE /encounters/{id}
- useDeleteMonsterTemplate() → mutation for DELETE /monsters/templates/{id}

All hooks must be fully typed using the Pydantic response schemas
from Task 3.1 as TypeScript interfaces (create a types file at
frontend/src/types/monsterFactory.ts with all interfaces).

## Styling
- Dark theme consistent with existing app
- Tabs match any existing tab pattern in the app, or create a
  simple consistent pattern if none exists
- Mobile responsive: header stacks on small screens

## Requirements
- TypeScript strict mode, no `any` types
- React Query v5 patterns (consistent with rest of app)
- VITE_API_URL environment variable for base URL (consistent with
  existing API calls in the project)

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `/monster-factory` route renders without errors
- [x] Navigation item added and links correctly
- [x] Two tabs render with placeholder content
- [x] GM Profile dropdown populated from API
- [x] "Manage Profiles" link renders (modal placeholder acceptable)
- [x] `useMonsterFactory.ts` created with all 17 hooks defined
- [x] `monsterFactory.ts` types file created with all TypeScript interfaces
- [x] No TypeScript errors (`tsc --noEmit` passes)

---

### Task 4.2 — Party Profile Input Component

**Status:** [x] Complete

**Depends on:** Task 4.1 complete

**Location:** `frontend/src/components/MonsterFactory/PartyProfileInput.tsx`

**Prompt:**
```
Continuing Monster Factory. Building the party profile input component.
This is Step 1 of the encounter creation wizard.
Read CLAUDE.md for project context. Present a plan before coding.

## Component: PartyProfileInput

Props:
  onPartyProfileChange: (profile: PartyProfile) => void
  initialMembers?: PartyMember[]

## Behavior

### Party Member Management
- Render one row per party member
- Add Member button (disabled when party size = 12)
- Remove button per row (disabled when party size = 1)
- Default starting state: 4 members with empty inputs

### Per-Member Input Fields
Each row contains:
- Max HP (number input, 1–500)
- AC (number input, 1–30)
- Nova Damage (number input, 0–500, label: "Nova Damage")
- Sustained Damage/Round (number input, 0–200, label: "Sustained Dmg/Round")

### Party-Level Input
Single input above the member rows:
- Party Level (number input, 1–20)

### Live Derived Stats Panel
Sidebar or bottom panel that updates on every input change.
Display these derived values (calculated client-side, matching
the formulas from Task 2.1):

- Party Size: [n] members
- Party Level: [n] (Tier [1-4])
- Proficiency Bonus: +[n]
  (levels 1-4: +2, 5-8: +3, 9-12: +4, 13-16: +5, 17-20: +6)
- Average HP: [n]
- Total HP: [n]
- Lowest HP: [n] (highlight in amber if significantly below average,
  defined as > 20% below average)
- Average AC: [n.n]
- Estimated Avg Attack Bonus: +[n]
  (formula: floor(level/2) + proficiency_bonus)
- Total Nova Damage: [n]
- Total Sustained Damage/Round: [n]
- Estimated Bonus Actions/Round: [n.n]

All derived values update in real time — no submit button needed
for the preview panel.

### Import Button
"Import from saved characters" button, disabled state with tooltip:
"Coming soon — will pull from character sheets automatically"

### Callback Behavior
Call onPartyProfileChange whenever the derived stats are valid
(all required fields filled, all values within range).
Pass the complete PartyProfile object matching the Task 2.1 schema.
Do not call the callback when inputs are invalid.

## Validation
Inline validation per field, shown below the input on blur:
- HP: "Must be between 1 and 500"
- AC: "Must be between 1 and 30"
- Nova Damage: "Must be between 0 and 500"
- Sustained Damage: "Must be between 0 and 200"
- Party Level: "Must be between 1 and 20"

## State Management
React Hook Form for all inputs.
Derived stats calculated in a useMemo that depends on form watch values.

## Requirements
- TypeScript strict, no `any` types
- Accessible: all inputs labeled, error messages use aria-describedby
- Unit tests:
  1. Derived stats calculate correctly for 4-player level 5 party
     matching the example from the algorithm spec
  2. Add member button increases member count
  3. Remove member button disabled at 1 member
  4. onPartyProfileChange not called when required fields are empty
  5. Lowest HP highlighted when more than 20% below average

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Component renders with default 4-member state
- [x] Add/Remove member works within bounds
- [x] All per-member inputs render with correct validation
- [x] Derived stats panel updates in real time
- [x] Lowest HP amber highlight triggers at correct threshold
- [x] `onPartyProfileChange` callback fires only on valid state
- [x] Import button renders as disabled with tooltip
- [x] All 5 unit tests pass
- [x] No TypeScript errors

---

### Task 4.3 — Encounter Composition Builder

**Status:** [x] Complete

**Depends on:** Tasks 4.1 and 4.2 complete

**Location:** `frontend/src/components/MonsterFactory/EncounterCompositionBuilder.tsx`

**Prompt:**
```
Continuing Monster Factory. Building the encounter composition builder.
This is Step 2 of the encounter creation wizard.
Read CLAUDE.md for project context. Present a plan before coding.

## Component: EncounterCompositionBuilder

Props:
  partyProfile: PartyProfile  (from PartyProfileInput)
  onCompositionChange: (composition: EncounterComposition) => void
  initialTemplateId?: number

EncounterComposition type (define in monsterFactory.ts):
  templateId: number | null
  difficulty: 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'
  slots: EncounterCompositionSlot[]

## Section 1: Encounter Type Selection
Grid of cards, one per EncounterTemplate from useEncounterTemplates().
Each card shows:
- Template name
- Template description (2-3 lines max, truncate with ellipsis)
Selecting a card:
- Highlights it visually
- Loads that template's default slots into the composition slots section
- Replaces any existing slots (with a confirmation if slots were
  manually modified from the template defaults)

## Section 2: Difficulty Selection
Row of 5 buttons: Trivial / Easy / Medium / Hard / Deadly
Each button shows:
- Difficulty name
- One-line descriptor below:
  - Trivial: "1–2 rounds, no resources"
  - Easy: "2–3 rounds, minor resources"
  - Medium: "3–4 rounds, moderate resources"
  - Hard: "4–5 rounds, significant resources"
  - Deadly: "5–6 rounds, full nova required"
Selected difficulty visually highlighted.

## Section 3: Composition Slots
One row per slot. Each row contains:
- Creature Archetype dropdown (populated from useCreatureArchetypes())
- Combat Role dropdown (populated from useCombatRoles())
- Count input (number, 1–20)
- Boss toggle (checkbox or toggle switch, labeled "Boss")
- Remove button (red, icon only)
  Disabled if slot is marked is_required on the loaded template

Below the slots:
- "Add Slot" button — appends a blank slot with no archetype/role selected

## Section 4: Live Stat Preview Panel
Calls POST /api/v1/monster-factory/generate with current inputs
whenever composition or difficulty changes. Debounced 400ms.

While loading: show a skeleton/spinner in the preview panel.
On error: show "Unable to preview — check your inputs" message.

On success, display:
- Expected Rounds: [min]–[max] (average: [avg])
- Total Monster HP: [n]
- Monster Actions/Round: [n] vs Party Actions/Round: [n]
  Color code: green if within ±20% of party actions, amber if
  >20% above, red if >40% above
- Warnings section: each warning as a yellow flag card with an
  amber warning icon. Cards are dismissible within the session
  (re-appear on next recalculation if condition still present)

Preview panel only calls the API when:
- At least one slot is fully specified (archetype + role + count)
- A difficulty is selected
- partyProfile is valid (all required fields filled)

## Callback Behavior
Call onCompositionChange whenever:
- Difficulty changes
- Any slot changes
- Slot is added or removed
Pass the current EncounterComposition regardless of whether the
preview is loaded — let the parent manage the generate button state.

## Requirements
- TypeScript strict, no `any` types
- All dropdowns populated from useMonsterFactory hooks
- Loading and error states for both dropdown data and preview panel
- Debounce the preview API call (400ms) to avoid excessive requests
- Do not call the API if required fields are missing

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Encounter type cards render and selection loads template slots
- [x] Difficulty buttons render with descriptors and selection highlights
- [x] Composition slots render with all inputs
- [x] Add slot / remove slot works correctly
- [x] Boss toggle per slot works
- [x] Preview panel calls API with 400ms debounce
- [x] Preview panel shows loading state while API call is in flight
- [x] Preview panel shows warnings as dismissible cards
- [x] Preview panel only calls API when minimum required inputs are filled
- [x] `onCompositionChange` fires on all input changes
- [x] No TypeScript errors

---

### Task 4.4 — Stat Block Display and Encounter Output

**Status:** [x] Complete

**Depends on:** Tasks 4.1, 4.2, 4.3 complete

**Location:**
- `frontend/src/components/MonsterFactory/MonsterStatBlockCard.tsx`
- `frontend/src/components/MonsterFactory/EncounterSummaryPanel.tsx`
- `frontend/src/components/MonsterFactory/GeneratedEncounterView.tsx`

**Prompt:**
```
Continuing Monster Factory. Building the generated encounter output
view and monster stat block display components.
Read CLAUDE.md for project context. Present a plan before coding.

## Component 1: MonsterStatBlockCard

Props:
  monster: GeneratedMonster
  showMathDetail: boolean

Renders a single monster's full stat block. Layout should feel
like a D&D stat block — structured, scannable, dark theme.

Sections (render in this order):
1. Header bar
   - Monster name (large, bold)
   - "[Large/Medium/Small] [Creature Archetype], [Role]" subtitle
   - HP badge, AC badge, Speed badge (inline chips)
   - Boss badge if is_boss=true (gold/amber color)
   - Count badge if count > 1 (e.g. "×3")

2. Ability Scores
   Standard 6-column grid: STR | DEX | CON | INT | WIS | CHA
   Each cell shows score and modifier (e.g. "18 (+4)")
   Horizontal rule below

3. Combat Stats (inline list)
   Attack Bonus: +[n] | Save DC: [n] | Speed: [n] ft.

4. Resistances & Immunities (only render if non-empty)
   Damage Immunities: [comma list]
   Damage Resistances: [comma list]
   Condition Immunities: [comma list]

5. Special Traits (only render if non-empty)
   Each trait: bold trait name followed by description text.
   Horizontal rule below

6. Actions
   "Actions" heading
   Multiattack description first (if present), styled as a trait
   Then each standard action as a block:
     Bold name | attack notation or save notation | damage | range
     Description text below

7. Legendary Actions (only render if non-empty)
   "Legendary Actions" heading
   Introductory line: "The [name] can take [n] legendary actions,
   choosing from the options below..."
   Each option: name (cost in parentheses) + description

8. Lair Actions (only render if non-empty)
   "Lair Actions" heading
   Introductory line: "On initiative count 20 (losing ties)..."
   Each option as a bullet

9. Math Detail accordion (only render if showMathDetail=true)
   Collapsed by default, expandable
   Shows key/value pairs from GeneratedMonster.stats math_detail

## Component 2: EncounterSummaryPanel

Props:
  encounter: GeneratedEncounter

Displays encounter-level stats:
- Difficulty tier (badge with color: trivial=gray, easy=green,
  medium=yellow, hard=orange, deadly=red)
- Party: [n] players, level [n]
- Expected Rounds: [min]–[max] (avg [n])
- Total Monster HP: [n]
- Warnings: each as a dismissible amber card (session-only dismiss)

## Component 3: GeneratedEncounterView

Props:
  encounter: GeneratedEncounter
  onSave: (name: string) => Promise<void>
  onSaveMonsterTemplate: (monster: GeneratedMonster, name: string) => Promise<void>
  onRebalance: () => void
  onNewEncounter: () => void
  isSaving: boolean

Layout:
- EncounterSummaryPanel at top
- One MonsterStatBlockCard per GeneratedMonster (stacked vertically,
  side by side on large screens in a 2-column grid)
- Action bar (sticky bottom or top of results):
  - "Save Encounter" button: opens an inline name input then calls onSave
  - "Save Monster Templates" button: opens a modal showing each monster
    with a name field, calls onSaveMonsterTemplate for each checked monster
  - "Rebalance" button: calls onRebalance (returns to wizard with inputs)
  - "New Encounter" button: calls onNewEncounter (resets everything)
  - Saving spinner overlay when isSaving=true

## Print CSS
Add print-specific CSS so that when the user prints the page
(or browser-prints for PDF), the output is clean:
- Hide navigation, action bar, and summary panel
- Each MonsterStatBlockCard starts on a new page if it would overflow
- Use black text on white background regardless of dark theme
- Standard readable font size (11–12pt)
This CSS is the foundation for the PDF export feature planned later.

## Requirements
- TypeScript strict, no `any` types
- Empty sections (resistances, legendary actions, etc.) hidden
  entirely rather than showing empty headings
- Responsive: single column mobile, 2-column desktop for stat block cards
- No TypeScript errors

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `MonsterStatBlockCard` renders all 9 sections correctly
- [x] Sections with empty data hidden entirely (no empty headings)
- [x] Boss badge, count badge render correctly
- [x] Math detail accordion renders only when showMathDetail=true
- [x] `EncounterSummaryPanel` renders with correct difficulty badge colors
- [x] `GeneratedEncounterView` renders both sub-components
- [x] Action bar renders all 4 buttons
- [x] Save encounter flow opens name input and calls onSave
- [x] Save monster template flow opens modal with per-monster name inputs
- [x] Print CSS foundation in place
- [x] No TypeScript errors

---

### Task 4.5 — GM Profile Management Modal

**Status:** [x] Complete

**Depends on:** Task 4.1 complete (uses hooks from 4.1)

**Location:** `frontend/src/components/MonsterFactory/GMProfileModal.tsx`

**Prompt:**
```
Continuing Monster Factory. Building the GM profile management modal.
This replaces the placeholder modal from Task 4.1.
Read CLAUDE.md for project context. Present a plan before coding.

## Component: GMProfileModal

Props:
  isOpen: boolean
  onClose: () => void
  onProfileChange: (profileId: number) => void  — called when default changes

## View 1: Profile List
Shown when modal opens.

Renders a list of all GM profiles from useGMProfiles().
Each row shows:
- Profile name
- "Default" badge if is_default=true
- Edit button (pencil icon)
- Duplicate button (copy icon)
- Set as Default button (star icon, filled if already default)
- Delete button (trash icon)
  Disabled with tooltip if: this is the only profile, or is_default=true

Footer:
- "New Profile" button — switches to Profile Editor in create mode

## View 2: Profile Editor
Shown when Edit or New Profile is clicked.
Replaces the list view within the same modal (no nested modal).

### Header
- Back arrow to return to Profile List (prompts if unsaved changes)
- Profile name input (text, required)
- "Load from preset" dropdown:
  Options: New Players | Balanced | Heroic | Optimizer Table | Meat Grinder
  Selecting a preset populates all fields but does NOT auto-save
  Show a "(unsaved)" indicator after preset load

### Settings Sections (accordion, all collapsed by default)
Each section is expandable. Section titles:
1. Lethality Settings
2. Combat Duration
3. Action Economy
4. Hit Rates
5. Saving Throws
6. Minion Rules
7. Warnings & Display

### Per-Section Field Layout
Each field renders as a row with:
- Field label (left)
- Tooltip icon with description on hover (use the parameter descriptions
  from the algorithm spec)
- Input (right): slider for floats with defined range, toggle for
  booleans, number input for ints
- Current value display next to slider
- "Default" badge if value matches the Balanced profile default
- Reset to default button (×) per field, only shown when value
  differs from default

### Per-Difficulty Fields
For fields that have per-tier values (threat_turns, target_rounds,
action_economy_multiplier, monster_hit_rate, player_hit_rate):
Render as a compact 5-column row labeled:
Trivial | Easy | Medium | Hard | Deadly
Each column has its own input and reset button.

### Validation
All float fields validate against the defined min/max ranges from
the algorithm spec. Show inline error if out of range.
Save button disabled if any validation errors present.

### Save Button
"Save Profile" — calls POST (create) or PUT (update) depending on mode.
On success: return to Profile List, show a success toast notification.

## State Management
React Hook Form for all inputs in the editor.
Default values populated from existing profile (edit mode) or
Balanced preset defaults (create mode).

## Requirements
- TypeScript strict, no `any` types
- All API calls via useMonsterFactory hooks
- Loading states on all async operations
- Confirm dialog before destructive actions (delete, discard changes)
- Modal is scrollable if content overflows viewport height
- Mobile responsive

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Modal renders and opens from the Monster Factory page header
- [x] Profile list view shows all profiles with correct badges
- [x] Delete disabled correctly (only profile, or default)
- [x] Set as Default calls API and refreshes list
- [x] Duplicate creates a new profile with copied settings
- [x] Profile editor opens for Edit and New Profile
- [x] All 7 settings sections render with correct input types
- [x] Per-difficulty fields render as 5-column rows
- [x] Preset loader populates all fields without saving
- [x] Default badge and reset button appear correctly per field
- [x] Save calls correct endpoint (POST vs PUT)
- [x] Back arrow prompts on unsaved changes
- [x] No TypeScript errors

---

## Phase 5: Saved Encounters and Templates

---

### Task 5.1 — Saved Encounters List and Monster Templates View

**Status:** [x] Complete

**Depends on:** Tasks 4.1, 4.4 complete

**Location:**
- `frontend/src/components/MonsterFactory/SavedEncountersList.tsx`
- `frontend/src/components/MonsterFactory/MonsterTemplatesList.tsx`
- Wire both into the "Saved Encounters" tab from Task 4.1

**Prompt:**
```
Continuing Monster Factory. Building the Saved Encounters tab content.
This replaces the placeholder in the second tab from Task 4.1.
Read CLAUDE.md for project context. Present a plan before coding.

## Component 1: SavedEncountersList

Uses useSavedEncounters(page, perPage) hook.

### List View
Table or card list of saved encounters.
Each row/card shows:
- Encounter name
- Difficulty badge (colors matching EncounterSummaryPanel)
- Party size and level (e.g. "4 players, level 5")
- Expected rounds (e.g. "3.5–5.5 rounds")
- Monster count (e.g. "4 monsters")
- Created date (relative: "2 days ago")
- Delete button with confirmation dialog

Clicking a row (not the delete button) opens the encounter detail.

### Encounter Detail View
Opens inline below the list (accordion expand) or in a slide-over
panel — choose whichever fits better with existing app patterns.

Shows:
- Full GeneratedEncounterView in read-only mode
  (hide the Save and Rebalance buttons, keep the stat block display)
- "Reopen in Builder" button — loads this encounter's inputs back
  into the wizard (composition, party profile, difficulty) so the
  DM can modify and regenerate

### Search and Filter Bar
Above the list:
- Text search input (filters by encounter name, client-side)
- Difficulty filter: All | Trivial | Easy | Medium | Hard | Deadly
  (segmented control or dropdown)
- Party level range: min level / max level inputs
Filter state updates the list immediately (client-side filter on
loaded data, not a new API call)

### Pagination
Show 20 per page. Prev/Next controls below the list.
Show "Showing [n]–[n] of [total]" count.

### Empty State
When no encounters exist:
  Centered illustration or icon, text "No saved encounters yet",
  "Create your first encounter" button that switches to the
  Create Encounter tab.

## Component 2: MonsterTemplatesList

Sub-tab within the Saved Encounters tab.
Two tabs at the top of the saved section:
  "Saved Encounters" | "Monster Templates"

Uses useMonsterTemplates(page, perPage) hook.

### List View
Card grid (2 columns desktop, 1 column mobile).
Each card shows:
- Monster name
- Role badge and Creature Archetype badge
- HP and AC (inline)
- Boss badge if applicable
- Delete button with confirmation

Clicking a card opens a modal showing the full MonsterStatBlockCard
for that template (read-only).

### Empty State
"No saved monster templates yet"
Explanatory text: "Save individual monsters from a generated encounter
to reuse them across sessions."

## Tab Structure Update
Replace the "Saved Encounters" tab placeholder from Task 4.1 with
a nested tab structure:
  [Saved Encounters] [Monster Templates]

## Requirements
- TypeScript strict, no `any` types
- All API calls via useMonsterFactory hooks
- Consistent loading and error states
- Pagination on both lists
- Delete with confirmation on both lists
- No TypeScript errors

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] SavedEncountersList renders with correct columns/fields
- [x] Difficulty badge colors match EncounterSummaryPanel
- [x] Search filter works client-side
- [x] Difficulty and level range filters work
- [x] Encounter detail view opens on row click
- [x] "Reopen in Builder" renders (wired in Task 5.2)
- [x] Delete with confirmation works
- [x] Pagination renders and navigates correctly
- [x] Empty state renders with CTA
- [x] MonsterTemplatesList renders as card grid
- [x] Template card opens MonsterStatBlockCard modal
- [x] Monster template delete with confirmation works
- [x] Nested tab structure in place
- [x] No TypeScript errors

---

## Phase 5 Complete — Wiring the Wizard

---

### Task 5.2 — Assemble the Full Encounter Creation Wizard

**Status:** [x] Complete

**Depends on:** Tasks 4.2, 4.3, 4.4, 4.5, 5.1 all complete

**Location:** `frontend/src/components/MonsterFactory/EncounterWizard.tsx`

**Prompt:**
```
Continuing Monster Factory. Assembling all components into the full
encounter creation wizard and wiring the complete user flow.
This task replaces the "Create Encounter" tab placeholder from Task 4.1.
Read CLAUDE.md for project context. Present a plan before coding.

## Component: EncounterWizard

Manages the full wizard flow:

Step 1: PartyProfileInput
Step 2: EncounterCompositionBuilder (receives partyProfile from Step 1)
Step 3: GeneratedEncounterView (shown after successful generate call)

## Step Navigation
Wizard step indicator at the top showing:
  [1. Party] → [2. Encounter] → [3. Review]
Current step highlighted. Previous steps clickable to go back
(with confirmation if Step 3 is active, since going back discards
the current generated encounter).

## Step 1 → Step 2 Transition
"Next: Build Encounter" button at bottom of Step 1.
Disabled until partyProfile is valid (all members filled).
Clicking advances to Step 2.

## Step 2 → Step 3 Transition
"Generate Encounter" button at bottom of Step 2.
Disabled until:
- At least one composition slot is fully specified
- A difficulty is selected
Clicking calls POST /generate with current inputs.
Shows full-page loading state while API call is in flight
("Building your encounter..." with a subtle animation).
On success: advance to Step 3 with the GeneratedEncounter.
On error: show error message inline, stay on Step 2.

## Step 3 Actions (wired from GeneratedEncounterView)
- Save: calls POST /encounters, on success shows toast and offers
  to navigate to Saved Encounters tab
- Save Monster Template: calls POST /monsters/templates per monster
- Rebalance: returns to Step 2 with current composition and party
  inputs preserved, allows modification and re-generation
- New Encounter: resets entire wizard to Step 1 (with confirmation)

## GM Profile Selection
The GM Profile dropdown in the page header (from Task 4.1) determines
which profile's settings are used for generation. The selected
profile ID is passed into GenerateEncounterInput.

## State Persistence
Preserve wizard state (party inputs, composition) in component state
so that navigating to Saved Encounters tab and back does not reset
the wizard. Reset only on explicit "New Encounter" action.

## Requirements
- TypeScript strict, no `any` types
- useGenerateEncounter, useSaveEncounter, useSaveMonsterTemplate
  mutations from useMonsterFactory hooks
- Loading states on all async transitions
- Error messages displayed inline, not as browser alerts
- No TypeScript errors

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Step indicator renders and updates correctly
- [x] Step 1 → 2 transition gated on valid party profile
- [x] Step 2 → 3 calls generate API and shows loading state
- [x] Error from generate API shown inline on Step 2
- [x] GeneratedEncounterView renders on Step 3 with correct props
- [x] All 4 action buttons in Step 3 wired correctly
- [x] Rebalance returns to Step 2 with preserved inputs
- [x] New Encounter resets with confirmation
- [x] Wizard state preserved across tab navigation
- [x] GM Profile selection passes correct profile ID to generation
- [x] No TypeScript errors

---

## Build Complete

When Task 5.2 is marked complete, the Monster Factory feature is
fully implemented. Remaining future work (not in this file):

- PDF export of stat blocks (print CSS foundation laid in Task 4.4)
- Import to Roll20 / D&D Beyond export formats
- Auto-calculation of nova damage from character sheet data
- Warning flags for damage immunity/resistance conflicts with party
- Resistance and immunity conflict detection (flagged for future update
  in algorithm spec)