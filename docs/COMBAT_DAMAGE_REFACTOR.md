# Combat Damage Refactor — Build Instructions

Read docs/COMBAT_DAMAGE_REFACTOR.md and work through all incomplete tasks
in order. Before beginning each task, state the task number and name, then
present a plan and wait for my approval before writing any code. After I
approve, implement the task, verify all completion criteria pass, update
the task Status to `[x] Complete`, then stop and wait for me to confirm
before moving to the next task. Do not skip tasks or combine tasks.

**Rules Claude Code must follow:**
- Never begin a task until the previous task's Status is marked `[x] Complete`
- Always present a plan and receive explicit approval before writing any code
- Always verify all completion criteria before marking a task done
- If a task fails or produces unexpected results, stop and report — do not proceed
- All tasks assume the project context in CLAUDE.md

## Background

The combat update (COMBAT_UPDATE.md) was fully implemented. This refactor
modifies the damage calculation approach based on the following decision:

**Problem with the original system:**
The original `character_combat_ability` table modeled individual abilities
with structured dice fields (dice_count, dice_value, flat_bonus) and relied
on the `DnD55eRuleSystem` to compute nova and sustained damage automatically.
This approach breaks down for characters whose best damage options are
conditional combos (e.g. Verso's wildfire spirit + Enhanced Bond + Burning
Hands), multi-attack sequences with mastery features (e.g. Tom's Nick
mastery daggers), or turn sequences that differ meaningfully based on
resource availability.

It also encodes rulebook logic (nova = best action + best bonus action from
eligible abilities) into the app, which creates IP risk for a tool intended
to be rule-system-agnostic.

**New approach:**
Replace structured ability modeling with free-form turn templates. A
character has one or more named turns (e.g. "Nova", "Sustained",
"Sustained — Spirit Active"). Each turn contains line items with a name,
an optional dice notation for display, and a user-entered average damage
value. The app sums line items and stores the total. The DM enters the
math once; the app just stores and reads it.

**What does NOT change:**
- rule_system, stat_definition, skill_definition tables — untouched
- character_stat, character_skill tables — untouched
- CharacterCombatProfile dataclass — kept, but nova_damage and
  sustained_damage_per_round are now read from designated turns
  rather than computed by the rule system
- All Monster Factory logic — reads the same two fields from the profile,
  no changes needed there
- Party auto-load behavior — unchanged

---

## Phase 1: Database — Replace Ability Table with Turn Tables

---

### Task 1.1 — Add character_combat_turn and character_combat_turn_line_item Tables

**Status:** [x] Complete

**Depends on:** Nothing (additive migration)

**Prompt:**
```
I am refactoring the combat damage system in dm-toolkit. The existing
character_combat_ability table modeled individual abilities with structured
dice fields and relied on rule-system logic to compute nova and sustained
damage. I am replacing this with free-form turn templates. Read CLAUDE.md
for project context. Present a plan before writing any code.

## New Tables

### character_combat_turn
A named turn template for a character. Represents one full combat turn
(action + bonus action + any relevant features) for a specific scenario.

Fields:
- id (PK, int)
- character_id (FK → characters, CASCADE delete)
- name (string, max 100) — e.g. "Nova", "Sustained", "Sustained — Spirit Active"
- turn_type (enum: nova | sustained | variant)
  nova: used as the character's nova damage input to Monster Factory
  sustained: used as sustained damage per round input
  variant: informational only, not used in Monster Factory calculations
- is_primary (boolean, default false)
  Within each turn_type per character, at most one turn can be is_primary=true.
  The primary nova turn and primary sustained turn are what Monster Factory reads.
  Enforce this at the application layer, not a DB constraint.
- notes (text, nullable) — freeform DM notes about when this turn applies
- sort_order (int, default 0) — display ordering per character
- created_at, updated_at

### character_combat_turn_line_item
An individual damage source within a turn.

Fields:
- id (PK, int)
- turn_id (FK → character_combat_turn, CASCADE delete)
- name (string, max 100) — e.g. "Inflict Wounds L3", "Spiritual Weapon L2"
- dice_notation (string, max 30, nullable) — display only, e.g. "5d10", "3d8+3"
  Not used for calculation — purely for the DM's reference.
- average_damage (float) — user-entered average damage for this line item.
  This is the only value used in calculations.
- is_bonus_action (boolean, default false) — informational label only
- notes (text, nullable) — e.g. "Only if wildfire spirit is active"
- sort_order (int, default 0)
- created_at, updated_at

## Computed Field (application layer, not stored)
turn_total: sum of all line_item.average_damage values for a turn.
Computed when the turn is read, never stored.

## Constraints
- A character may have multiple turns of the same turn_type
  (e.g. two "nova" turns for different resource states)
- is_primary=true enforced to at most one per turn_type per character
  at the application layer
- No minimum number of turns required — characters can have zero turns
  (they will show as incomplete in the party summary)

## Requirements
- SQLAlchemy models, full type hints
- Alembic migration (additive — does not touch character_combat_ability)
- The old character_combat_ability table is NOT dropped in this migration.
  It will be dropped in Task 1.2 after data is confirmed migrated.

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `character_combat_turn` model created with all fields
- [x] `character_combat_turn_line_item` model created with all fields
- [x] Both models have correct FK cascade delete
- [x] Alembic migration runs cleanly up and down
- [x] `character_combat_ability` table still exists (not dropped yet)
- [x] No seed data added

---

### Task 1.2 — Drop character_combat_ability Table

**Status:** [x] Complete

**Depends on:** Task 1.1 complete

**Prompt:**
```
Continuing the combat damage refactor. The character_combat_ability table
is no longer used. Drop it cleanly. Read CLAUDE.md for context. Plan first.

## Migration
Create an Alembic migration that drops character_combat_ability.

Before writing the migration, search the codebase for all references to
character_combat_ability and CharacterCombatAbility (the SQLAlchemy model
and any Pydantic schemas). List every file that references them in your plan.

The migration drop is only safe once you confirm there are no remaining
foreign keys pointing to character_combat_ability from other tables.

## Codebase Cleanup (same task, do after migration)
Remove all references to the old ability system:
- Delete the CharacterCombatAbility SQLAlchemy model
- Delete any Pydantic schemas that modeled CharacterCombatAbility
- Remove combat_ability_definition_id FK from any remaining models
  if it only served character_combat_ability
- Remove any service functions that read or wrote character_combat_ability
- Remove any API endpoints that served character_combat_ability CRUD
  (these were under /api/v1/characters/{id}/combat/abilities)
- Remove the combat_ability_definitions reference endpoint if it only
  existed to serve the ability form dropdowns
  (/api/v1/rule-systems/{id}/combat-ability-definitions)
  NOTE: only remove this if nothing else in the codebase uses it.
  If Monster Factory or another feature references it, leave it.
- Remove any frontend hooks in useMonsterFactory.ts or other hook files
  that called the removed endpoints

## What NOT to remove
- rule_system, stat_definition, skill_definition tables and models
- character_stat, character_skill tables, models, and endpoints
- The AbstractRuleSystem class and DnD55eRuleSystem implementation
  These still serve modifier computation, proficiency bonus, and
  skill bonus calculations — only the nova/sustained damage methods
  are being replaced.
- CombatRoleArchetype, combat_ability_definition seeded data
  (used by Monster Factory flavor library — do not touch)
- CharacterCombatProfile dataclass — kept but modified in Task 2.1

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Plan listed every file referencing the old ability system (9 files)
- [x] Alembic migration drops `character_combat_ability`
- [x] Migration runs cleanly up and down
- [x] All listed references removed from Python codebase
- [x] All listed references removed from TypeScript/React codebase
- [x] No broken imports anywhere (`tsc --noEmit` passes, Python imports cleanly)
- [x] combat_ability_definitions seeded data untouched (Monster Factory uses it)

---

## Phase 2: Python Layer — Update Abstract Classes and Service

---

### Task 2.1 — Update AbstractRuleSystem and DnD55eRuleSystem

**Status:** [x] Complete

**Depends on:** Task 1.2 complete

**Prompt:**
```
Continuing the combat damage refactor. Updating the rule system abstract
class layer to remove nova/sustained damage computation, which is no longer
the responsibility of the rule system. Read CLAUDE.md for context. Plan first.

## Changes to backend/app/rule_systems/base.py

### Remove from AbstractRuleSystem
Remove these abstract methods entirely:
- compute_nova_damage(abilities)
- compute_sustained_damage(abilities)

These were only needed when the rule system computed damage from structured
ability records. Now damage totals come from user-entered turn templates,
so the rule system has no role in damage calculation.

### Remove from base.py
Remove the CharacterCombatAbility dataclass entirely.
It modeled structured ability data that no longer exists.

### Update CharacterCombatProfile dataclass
nova_damage and sustained_damage_per_round remain on the dataclass —
they are still the values that Monster Factory reads. But they are no
longer computed by the rule system. They are populated by the service
layer from the primary turn totals (Task 2.2).

No other changes to CharacterCombatProfile.

### Keep everything else unchanged
- StatDefinition, SkillDefinition, CombatAbilityDefinition dataclasses
- StatType, SkillProficiency, AbilityCategory enumerations
- compute_modifier() abstract method
- compute_proficiency_bonus() abstract method
- build_character_combat_profile() abstract method

## Changes to backend/app/rule_systems/dnd_5_5e.py

### Remove from DnD55eRuleSystem
Remove implementations of:
- compute_nova_damage()
- compute_sustained_damage()

### Update build_character_combat_profile()
The method signature changes: remove the combat_abilities parameter.
nova_damage and sustained_damage_per_round are now passed in as
pre-computed floats (calculated by the service layer from turn totals)
rather than computed inside this method.

New signature:
build_character_combat_profile(
  self,
  character_id: int,
  character_name: str,
  level: int,
  max_hp: int,
  armor_class: int,
  stat_values: dict[str, int],
  skill_proficiencies: dict[str, str],
  nova_damage: float,           ← new: passed in from service layer
  sustained_damage: float       ← new: passed in from service layer
) -> CharacterCombatProfile

## Update Unit Tests
Remove unit tests that tested:
- compute_nova_damage (cleric example, two-action example)
- compute_sustained_damage

Update any remaining tests that called build_character_combat_profile
with the old signature to use the new signature.

## Requirements
- Full type hints throughout
- No `any` types
- All remaining unit tests pass after changes

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] `compute_nova_damage()` and `compute_sustained_damage()` removed from ABC
- [x] `CharacterCombatAbility` dataclass removed from base.py
- [x] `build_character_combat_profile()` signature updated in both ABC and impl
- [x] `DnD55eRuleSystem` no longer implements the removed methods
- [x] `CharacterCombatProfile` dataclass still has nova_damage and sustained_damage_per_round
- [x] All removed unit tests deleted (done in Task 1.2)
- [x] Remaining unit tests pass (13/13)
- [x] No broken imports

---

### Task 2.2 — Update Character Combat Service

**Status:** [x] Complete

**Depends on:** Task 2.1 complete

**Prompt:**
```
Continuing the combat damage refactor. Updating the character combat
service to load turn data and compute nova/sustained totals from
primary turns instead of from structured ability records.
Read CLAUDE.md for context. Plan first.

## File: backend/app/monster_factory/services/character_combat_service.py

## Changes to load_character_combat_profile()

### Remove
- Loading of character_combat_ability records
- Building CharacterCombatAbility dataclass list
- Passing combat_abilities to rule_system.build_character_combat_profile()

### Add
Load character_combat_turn records with their line_items for this character.

Compute nova_damage:
  Find the turn where turn_type='nova' AND is_primary=True.
  If found: nova_damage = sum of all line_item.average_damage for that turn.
  If not found: nova_damage = 0.0

Compute sustained_damage:
  Find the turn where turn_type='sustained' AND is_primary=True.
  If found: sustained_damage = sum of all line_item.average_damage for that turn.
  If not found: sustained_damage = 0.0

Pass nova_damage and sustained_damage into:
  rule_system.build_character_combat_profile(..., nova_damage, sustained_damage)

## New helper function (add to this file)

get_character_turns(character_id: int, db: Session) -> list[CharacterTurnSummary]

CharacterTurnSummary (new Pydantic model, define in this file or a schemas file):
  id: int
  name: str
  turn_type: str  (nova | sustained | variant)
  is_primary: bool
  notes: str | None
  sort_order: int
  line_items: list[TurnLineItemSummary]
  turn_total: float  ← computed: sum of line_item.average_damage

TurnLineItemSummary:
  id: int
  name: str
  dice_notation: str | None
  average_damage: float
  is_bonus_action: bool
  notes: str | None
  sort_order: int

## Changes to has_complete_data logic in get_campaign_party_summary()

Old logic: a character is complete if they have at least one
character_combat_ability record.

New logic: a character is complete if they have:
  - At least one turn with turn_type='nova' AND is_primary=True
  - At least one turn with turn_type='sustained' AND is_primary=True

A character with turns defined but none marked is_primary is still
considered incomplete and appears in incomplete_characters.

## Requirements
- Full type hints, no `any` types
- Update all integration tests to use turn-based setup instead of ability records:
  Test 1: character with primary nova turn (2 line items) and primary sustained turn
    → correct nova_damage and sustained_damage computed
  Test 2: character with multiple nova turns, only one is_primary=True
    → reads only from the primary one
  Test 3: character with no primary turns → nova=0, sustained=0, incomplete
  Test 4: four-character campaign party summary with all characters set up
    → has_complete_data=True, correct party_nova sum

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Service loads turn and line_item data instead of ability records
- [x] nova_damage computed from primary nova turn total
- [x] sustained_damage computed from primary sustained turn total
- [x] Both default to 0.0 when no primary turn exists
- [x] `get_character_turns()` helper implemented with correct schemas
- [x] `has_complete_data` logic updated to check primary turn existence
- [x] All 5 integration tests pass (added get_character_turns structure test)

---

### Task 2.3 — Update Combat API Endpoints

**Status:** [x] Complete

**Depends on:** Task 2.2 complete

**Prompt:**
```
Continuing the combat damage refactor. Replacing the combat ability CRUD
endpoints with turn and line item CRUD endpoints.
Read CLAUDE.md for context. Plan first.

## File: backend/app/characters/combat_router.py

## Remove
All endpoints under /combat/abilities:
  POST   /combat/abilities
  PUT    /combat/abilities/{ability_id}
  DELETE /combat/abilities/{ability_id}
  GET    /combat/abilities

## Add: Turn Endpoints

GET /combat/turns
  Response: list[CharacterTurnSummary] (from Task 2.2)
  Ordered by sort_order, then id.
  Includes nested line_items for each turn.

POST /combat/turns
  Body: {
    name: str,
    turn_type: "nova" | "sustained" | "variant",
    is_primary: bool,
    notes: str | null,
    sort_order: int
  }
  Behavior:
    If is_primary=True: automatically set is_primary=False on any other
    turn of the same turn_type for this character before inserting.
    (Only one primary per type per character.)
  Response: created CharacterTurnSummary (with empty line_items list)

PUT /combat/turns/{turn_id}
  Body: same as POST
  Behavior: same is_primary enforcement as POST
  Response: updated CharacterTurnSummary with current line_items

DELETE /combat/turns/{turn_id}
  Response: { deleted: true, id: int }
  Cascades to delete all line_items for this turn (DB cascade handles this).

## Add: Line Item Endpoints

GET /combat/turns/{turn_id}/items
  Response: list[TurnLineItemSummary] ordered by sort_order

POST /combat/turns/{turn_id}/items
  Body: {
    name: str,
    dice_notation: str | null,
    average_damage: float,
    is_bonus_action: bool,
    notes: str | null,
    sort_order: int
  }
  Response: created TurnLineItemSummary

PUT /combat/turns/{turn_id}/items/{item_id}
  Body: same as POST
  Response: updated TurnLineItemSummary

DELETE /combat/turns/{turn_id}/items/{item_id}
  Response: { deleted: true, id: int }

## Reorder Endpoint (optional but useful for drag-and-drop)
PUT /combat/turns/reorder
  Body: list[{ id: int, sort_order: int }]
  Updates sort_order for multiple turns in one call.
  Response: { updated: int } (count of rows updated)

PUT /combat/turns/{turn_id}/items/reorder
  Body: list[{ id: int, sort_order: int }]
  Response: { updated: int }

## Keep Unchanged
GET  /combat/profile      — still works, now uses turn-based nova/sustained
GET  /combat/stats        — unchanged
PUT  /combat/stats        — unchanged
GET  /combat/skills       — unchanged
PUT  /combat/skills       — unchanged

## Requirements
- Full Pydantic schemas, type hints, no `any` types
- is_primary enforcement logic must be transactional (use db.begin())
  to avoid race conditions leaving two primary turns of same type
- Validate turn_id belongs to the given character_id before
  operating on line items
- Consistent error format

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] All old `/combat/abilities` endpoints removed (done in Task 1.2)
- [x] GET/POST/PUT/DELETE for turns implemented
- [x] GET/POST/PUT/DELETE for line items implemented
- [x] Reorder endpoints implemented (turns + line items)
- [x] is_primary enforcement is transactional (flush before enforce, then commit)
- [x] turn_id ownership validated before line item operations
- [x] GET /combat/profile still returns correct nova_damage and sustained_damage
- [x] All 117 tests pass

---

## Phase 3: Frontend — Replace Ability Editor with Turn Editor

---

### Task 3.1 — Update React Query Hooks

**Status:** [x] Complete

**Depends on:** Task 2.3 complete

**Prompt:**
```
Continuing the combat damage refactor. Updating the frontend React Query
hooks to remove ability hooks and add turn/line item hooks.
Read CLAUDE.md for context. Plan first.

## File: frontend/src/hooks/useCharacterCombat.ts
(or wherever the character combat hooks live — check the existing file)

## Remove
Any hooks that called the old ability endpoints:
  useCombatAbilities(characterId)
  useCreateCombatAbility()
  useUpdateCombatAbility()
  useDeleteCombatAbility()

## Add

useCombatTurns(characterId: number)
  → GET /combat/turns
  Returns list of CharacterTurnSummary with nested line items.

useCreateCombatTurn()
  → mutation for POST /combat/turns

useUpdateCombatTurn()
  → mutation for PUT /combat/turns/{id}

useDeleteCombatTurn()
  → mutation for DELETE /combat/turns/{id}

useReorderCombatTurns()
  → mutation for PUT /combat/turns/reorder

useCreateLineItem()
  → mutation for POST /combat/turns/{turnId}/items

useUpdateLineItem()
  → mutation for PUT /combat/turns/{turnId}/items/{itemId}

useDeleteLineItem()
  → mutation for DELETE /combat/turns/{turnId}/items/{itemId}

useReorderLineItems()
  → mutation for PUT /combat/turns/{turnId}/items/reorder

## Update TypeScript types (frontend/src/types/combat.ts or similar)
Add:
  CharacterTurnSummary
  TurnLineItemSummary
  CreateTurnInput
  UpdateTurnInput
  CreateLineItemInput
  UpdateLineItemInput

Remove:
  CharacterCombatAbility (the old ability type)
  CreateCombatAbilityInput
  CombatAbilityDefinition (only if it was only used by the ability form —
  check if Monster Factory or any other component still uses it first)

## Requirements
- TypeScript strict, no `any` types
- React Query v5 patterns consistent with existing hooks
- `tsc --noEmit` passes after changes

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] All old ability hooks removed (done in Task 1.2)
- [x] All 9 new turn and line item hooks added
- [x] TypeScript interfaces updated (TurnType, CharacterTurnSummary, TurnLineItemSummary, Create/Update inputs, ReorderItemInput)
- [x] No broken imports
- [x] `tsc --noEmit` passes

---

### Task 3.2 — Replace Combat Abilities UI with Turn Editor

**Status:** [x] Complete

**Depends on:** Task 3.1 complete

**Prompt:**
```
Continuing the combat damage refactor. Replacing the Combat Abilities tab
in the character combat stats editor with a new Turn Editor.
Read CLAUDE.md for context. Plan first.

## File to modify
frontend/src/components/Characters/CombatStatsEditor.tsx
Specifically the "Combat Abilities" tab — replace its entire contents
with the new Turn Editor. The tab label should change to "Damage Turns".

## New Component: TurnEditor
(Can live inline in CombatStatsEditor or as a separate file —
use whichever fits the existing code structure better)

## Layout

### Computed Summary Panel (top, always visible)
Shows the primary turns' totals:

  Nova Damage: [n]          (primary nova turn total, or "—" if not set)
  Sustained Damage: [n]     (primary sustained turn total, or "—" if not set)

  Brief explanation text below:
  "Set one Nova and one Sustained turn as primary to auto-populate
  Monster Factory."

### Turn List
Each turn renders as a card. Cards are sorted by sort_order.
Drag-to-reorder supported (use existing dnd-kit setup if present in project).

Turn card header:
  - Turn name (inline editable — click to edit, blur to save)
  - Turn type badge: "Nova" (red) | "Sustained" (blue) | "Variant" (gray)
  - Primary badge: gold star icon, shown only if is_primary=true
  - "Set as Primary" button (only shown for nova and sustained type turns,
    hidden if already primary)
  - Expand/collapse chevron
  - Delete button (trash icon, with confirmation)

Turn card body (expanded):
  - Notes field: small textarea, placeholder "When does this turn apply?"
    autosaves on blur
  - Line item list (see below)
  - "Add line item" button

Turn card footer (expanded):
  - Turn total: "Total: [n] avg damage" (sum of all line items)

### Line Items
Each line item renders as a compact row inside the turn card.

Row fields (all inline-editable):
  - Name (text, e.g. "Inflict Wounds L3")
  - Dice notation (text, optional, placeholder "e.g. 5d10" — display only)
  - Avg damage (number input, the only value used in math)
  - Bonus action toggle (small icon toggle)
  - Notes (text, optional, placeholder "Condition or context")
  - Drag handle (for reordering within the turn)
  - Delete button

Drag-to-reorder within a turn supported.

All line item edits autosave on blur (call PUT endpoint).
Deleting a line item updates the turn total immediately.

### Add Turn Button
Below the turn list:
  "+ Add Turn" button opens an inline form (not a modal):
    - Name (text input, required)
    - Turn type (select: Nova | Sustained | Variant)
    - Is primary? (toggle, default off)
    - Notes (textarea, optional)
    - Save / Cancel buttons

## Behavior Details

Setting a turn as primary:
  When the user clicks "Set as Primary" on a turn:
  - Call PUT /combat/turns/{id} with is_primary=true
  - The API handles unsetting the previous primary (transactional)
  - The summary panel updates immediately

Deleting a primary turn:
  Show confirmation: "This is your primary [Nova/Sustained] turn.
  Deleting it will clear that value from Monster Factory calculations.
  Are you sure?"

Empty state (no turns yet):
  Centered text: "No damage turns set up yet."
  Subtext: "Add a Nova turn for burst damage and a Sustained turn
  for regular combat rounds."
  "+ Add Turn" button prominently displayed.

## Requirements
- TypeScript strict, no `any` types
- Autosave on blur for all inline edits (name, notes, line item fields)
- Optimistic updates for drag-reorder
- Mobile responsive (turns stack, line items scroll horizontally if needed)
- All useCombatTurns hooks from Task 3.1 used correctly

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] "Combat Abilities" tab renamed to "Damage Turns ✦"
- [x] Turn cards render with header, body, footer
- [x] Turn type badges render with correct colors (nova=orange, sustained=blue, variant=gray)
- [x] Primary badge and "Set as Primary" button work correctly
- [x] Summary panel shows primary turn totals, updates when primary changes
- [x] Line items render as compact rows with all fields
- [x] All inline edits autosave on blur
- [x] Turn total updates when line items change (via query invalidation)
- [x] Drag-to-reorder works for turns and for line items within turns (dnd-kit)
- [x] Add turn inline form works (React Hook Form)
- [x] Delete turn with confirmation (extra warning for primary turns)
- [x] Empty state renders correctly
- [x] No TypeScript errors

---

## Phase 4: Example Data Entry Reference

---

### Task 4.1 — Seed Example Turns for Development Characters

**Status:** [x] Complete

**Depends on:** Task 3.2 complete

**Prompt:**
```
Continuing the combat damage refactor. Adding a dev seed script that
populates example combat turns for the campaign's four characters,
based on the character sheets that were reviewed during design.
This is a development-only seed — not a migration.
Read CLAUDE.md for context. Plan first.

## Location
backend/app/seeds/combat_turns_example.py

## Purpose
Makes it easy to test the full Monster Factory auto-load flow during
development without manually entering all turn data through the UI.
This seed should be idempotent — running it twice does not create
duplicate turns.

## Turns to seed

### Dutch (Cleric 6 — Life Domain)
Assumptions: proficiency +3, WIS +3, spell attack +6, save DC 14

Nova turn (is_primary=True, name="Nova"):
  Inflict Wounds L3   5d10    avg 27.5   action, not bonus
  Spiritual Weapon L2  3d8+3  avg 16.5   bonus action, is_bonus_action=True
  notes: "Best combo: Inflict Wounds on action, Spiritual Weapon as bonus"
  Total: 44.0

Sustained turn (is_primary=True, name="Sustained — Spirit Up"):
  Dutch's Dominating Flail  1d8+2  avg 6.5   action, not bonus
  Spiritual Weapon L2       3d8+3  avg 16.5  bonus action, is_bonus_action=True
  notes: "Spiritual Weapon already concentration — maintain and melee"
  Total: 23.0

Sustained variant (is_primary=False, name="Sustained — No Concentration"):
  Dutch's Dominating Flail  1d8+2  avg 6.5
  notes: "When concentration is needed for something else"
  Total: 6.5

### Tom Goes (Rogue 5 — Thief, Dual Wielder)
Assumptions: DEX +4, proficiency +3, attack bonus +7, sneak attack 3d6

Nova turn (is_primary=True, name="Nova"):
  Dagger 1 (Nick — Attack action)  1d4+4  avg 6.5   not bonus
  Dagger 2 (Nick — same action)    1d4+4  avg 6.5   not bonus
  notes="Nick mastery: both dagger attacks are part of the Attack action"
  Sneak Attack                      3d6    avg 10.5  not bonus
  notes="On one hit per turn when ally adjacent or Steady Aim used"
  Bonus action attack (Dual Wielder) 1d4+4 avg 6.5  is_bonus_action=True
  Total: 30.0

Sustained turn (is_primary=True, name="Sustained"):
  Dagger 1 (Nick)  1d4+4  avg 6.5  not bonus
  Dagger 2 (Nick)  1d4+4  avg 6.5  not bonus
  Sneak Attack     3d6    avg 10.5 not bonus
  notes="Sneak Attack available every turn with consistent ally positioning"
  Bonus action attack  1d4+4  avg 6.5  is_bonus_action=True
  Total: 30.0
  notes turn="Tom's nova and sustained are nearly identical — no spell slots"

### LADO (Bard 5 — College of Dance, Tiefling)
Assumptions: CHA +4, proficiency +3, spell attack +7, save DC 15

Nova turn (is_primary=True, name="Nova"):
  Starry Wisp  2d8  avg 9.0   not bonus
  notes="Best single-target attack cantrip, spell attack +7"
  Unarmed Strike (Dance + Bardic Inspiration) 1d8+2  avg 6.5  is_bonus_action=True
  notes="Agile Strikes: spend Bardic Inspiration for unarmed as bonus action"
  Total: 15.5

  notes turn="LADO is primarily utility/support — damage is modest.
  Nova with a spell slot: Dissonant Whispers L2 (3d6 avg 10.5) or
  Thunderwave L2 (2d8 avg 9 in area) instead of Starry Wisp."

Sustained turn (is_primary=True, name="Sustained"):
  Starry Wisp  2d8  avg 9.0  not bonus
  notes="Reliable every turn, no resource cost"
  Total: 9.0

Nova variant (is_primary=False, name="Nova — Spell Slot"):
  Dissonant Whispers L2  3d6  avg 10.5  not bonus
  notes="WIS 15 save — good against low-WIS targets"
  Unarmed Strike (Agile Strikes)  1d8+2  avg 6.5  is_bonus_action=True
  Total: 17.0

### Verso (Druid 6 — Circle of Wildfire, Elf)
Assumptions: WIS +2, proficiency +3, spell attack +5, save DC 13

Nova turn (is_primary=True, name="Nova — Spirit Active"):
  Summon Wildfire Spirit  2d6+3d6  avg 17.5  not bonus
  notes="Action to summon: spirit deals 2d6 on appear (avg 7), each nearby creature Dex save DC 13 or 1d6+3 fire. Use avg 10.5 for one target hit."
  Burning Hands L3 (Enhanced Bond)  5d6+1d8  avg 22.0  not bonus
  notes="Enhanced Bond: fire spells can originate from spirit and add 1d8 while spirit active. 5d6 avg 17.5 + 1d8 avg 4.5 = 22. Dex save DC 13 half."
  Total: 39.5
  notes turn="Requires action to summon spirit AND cast Burning Hands via Enhanced Bond — this is a 2-action combo only possible via the spirit's ruling"

Nova turn (is_primary=False, name="Nova — No Spirit"):
  Scorching Ray L3  6d6  avg 21.0  not bonus
  notes="3 rays × 2d6, spell attack +5 each. Avg assumes all hit."
  Total: 21.0

Sustained turn (is_primary=True, name="Sustained — Spirit Active"):
  Produce Flame  2d8  avg 9.0  not bonus
  notes="Cantrip, ranged spell attack +5, 60ft range"
  Spirit command  1d6+3  avg 6.5  is_bonus_action=True
  notes="Bonus action to command spirit each turn: Dex save DC 13 or 1d6+3 fire"
  Total: 15.5

Sustained turn (is_primary=False, name="Sustained — No Spirit"):
  Produce Flame  2d8  avg 9.0  not bonus
  Total: 9.0

## Seed Script Requirements
- Query characters by name to find IDs (do not hardcode IDs)
- If a character is not found by name, skip and log a warning
- If turns already exist for a character, skip that character (idempotent)
- Can be run via: python -m app.seeds.combat_turns_example
- Log output: "Seeded turns for [name]" or "Skipped [name] — already has turns"
  or "Skipped [name] — not found in database"

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Seed script created at correct path
- [x] Script is runnable via python -m command
- [x] Dutch, LADO, Verso seeded (Tom Goes skipped — name not in dev DB)
- [x] All turn totals match the values specified (Dutch 44.0/23.0, LADO 15.5/9.0, Verso 39.5/15.5)
- [x] is_primary set correctly per character
- [x] Script is idempotent (second run shows SKIP for seeded characters)
- [x] Warnings logged for missing characters
- [x] Loads .env automatically when DATABASE_URL not in environment

---

## Phase 5: Documentation Update

---

### Task 5.1 — Update CLAUDE.md

**Status:** [x] Complete

**Depends on:** Tasks 1–4 complete

**Prompt:**
```
All combat damage refactor tasks are complete. Update CLAUDE.md to
reflect the new damage calculation approach. Read CLAUDE.md for
current content. Plan before making any changes.

## Section to update: "## Combat & Rule System Architecture"

Replace the description of nova/sustained damage calculation with:

"Nova and sustained damage are stored as user-defined turn templates,
not computed from structured ability records. Each character has one or
more CharacterCombatTurn records (turn_type: nova | sustained | variant).
Each turn contains CharacterCombatTurnLineItem records with user-entered
average_damage values. The service layer sums line items for the primary
nova and primary sustained turns to populate CharacterCombatProfile.

The rule system (DnD55eRuleSystem) no longer participates in damage
calculation. It handles modifier computation, proficiency bonus, and
skill bonus only. nova_damage and sustained_damage are passed into
build_character_combat_profile() as pre-computed floats.

This design is intentionally rule-system-agnostic: the DM enters the
damage math for their specific character build, including conditional
combos and multi-action sequences that cannot be expressed as structured
ability records without encoding rulebook logic."

Also update the three-layer data flow description:
  DB tables (character_combat_turn + line_items)
  → service layer: sums primary turn totals
  → rule system: build_character_combat_profile(nova_damage, sustained_damage)
  → CharacterCombatProfile (in-memory object used by Monster Factory)

## Also update the "## Build Files" section
Add:
  Combat damage refactor: @docs/COMBAT_DAMAGE_REFACTOR.md — All tasks complete.

Do not write any code until I approve the plan.
```

**Completion Criteria:**
- [x] Nova/sustained damage section updated with turn-template approach
- [x] Three-layer data flow updated
- [x] Build files section updated (added COMBAT_DAMAGE_REFACTOR.md entry)
- [x] No other CLAUDE.md content changed

---

## Task Summary

| Task | Description | Touches |
|---|---|---|
| 1.1 | Add character_combat_turn and line_item tables | DB |
| 1.2 | Drop character_combat_ability, clean up all references | DB + Python + TS |
| 2.1 | Remove nova/sustained methods from AbstractRuleSystem | Python |
| 2.2 | Update service to compute damage from primary turns | Python |
| 2.3 | Replace ability CRUD endpoints with turn/line item endpoints | Python |
| 3.1 | Update React Query hooks | TypeScript |
| 3.2 | Replace ability editor UI with Turn Editor | React |
| 4.1 | Seed example turns for four campaign characters | Python |
| 5.1 | Update CLAUDE.md | Docs |