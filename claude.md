# DM Toolkit — Claude Context

## Project Overview
A Dungeon Master's toolkit for D&D sessions. Local server accessible from other devices on the network.

## Architecture
- Frontend: React + TypeScript (Vite), port 3000
- Backend: Python FastAPI, port 8000  
- Database: MySQL via Docker Compose, port 3306
- Target: Local network access (0.0.0.0 binding)

## Coding Standards
- TypeScript: strict mode, no `any` types
- Python: type hints required, PEP 8
- API: RESTful, versioned under /api/v1/
- All async where applicable

## React / TypeScript Patterns
- `useParams` returns `string | undefined` for all values. Always use `!` non-null assertions when passing params to hooks or functions that require `string` (e.g. `useWikiArticle(articleId!)`, `mutate(articleId!)`). Hooks that intentionally accept optional IDs (like `useCharacters(campaignId?)`) are the exception and don't need `!`.
- All entity IDs are UUIDs stored as `string` (VARCHAR 36) — never use `number` for IDs anywhere in the frontend.

## Key Decisions
- All primary keys are UUIDs (string), migrated from integer auto-increment in revision 0008.
- Active campaign is stored in `CampaignContext` (persisted to `sessionStorage`), not in the URL. Routes are flat: `/sessions`, `/storylines`, `/characters`, `/wiki`, etc. — no `/campaigns/:campaignId/` prefix. Read campaign ID in pages via `useCampaignId()` from `src/context/CampaignContext.tsx`. Never parse campaign ID from the URL.

## What NOT to do
- Don't use Create React App
- Don't use SQLite (MySQL only)
- Don't hardcode localhost (use env vars)

## Combat & Rule System Architecture

### Rule System Abstraction

All rule-system-specific logic lives in `backend/app/rule_systems/`:
- `base.py` — abstract base class `AbstractRuleSystem`, shared enums (`StatType`, `SkillProficiency`, `AbilityCategory`), and frozen dataclasses (`StatDefinition`, `SkillDefinition`, `CombatAbilityDefinition`, `CharacterCombatProfile`)
- `dnd_5_5e.py` — D&D 5.5e concrete implementation (`DnD55eRuleSystem`)
- `loader.py` — `get_rule_system(slug)` factory and `get_default_rule_system()`

**To add a new rule system:**
1. Create `backend/app/rule_systems/your_system.py` and extend `AbstractRuleSystem`
2. Implement all abstract methods (`compute_modifier`, `compute_proficiency_bonus`, `build_character_combat_profile`)
3. Register in `loader.py` `_REGISTRY` dict with a unique slug
4. Seed definitions via `backend/app/seed_rule_systems.py` (idempotent, runs at startup)

Note: The rule system no longer computes nova or sustained damage. Those values are passed in as floats from the service layer. The rule system only handles modifier computation, proficiency bonus, and skill bonus calculations.

### Nova and Sustained Damage — Turn Templates

Nova and sustained damage are stored as user-defined turn templates, not computed from structured ability records. Each character has one or more `CharacterCombatTurn` records (`turn_type`: nova | sustained | variant). Each turn contains `CharacterCombatTurnLineItem` records with user-entered `average_damage` values. The service layer sums line items for the **primary** nova and **primary** sustained turns to populate `CharacterCombatProfile`.

The rule system (`DnD55eRuleSystem`) no longer participates in damage calculation. It handles modifier computation, proficiency bonus, and skill bonus only. `nova_damage` and `sustained_damage` are passed into `build_character_combat_profile()` as pre-computed floats.

This design is intentionally rule-system-agnostic: the DM enters the damage math for their specific character build, including conditional combos and multi-action sequences that cannot be expressed as structured ability records without encoding rulebook logic.

**Primary turn rule:** At most one turn per `turn_type` per character can have `is_primary=True`. Only primary turns feed Monster Factory calculations. Enforced at the application layer via `PUT /combat/turns` endpoint (not a DB constraint).

### Three-Layer Data Flow

```
DB tables (character_combat_turn + line_items, character_stats, etc.)
  ↓ character_combat_service.py
  ↓ sums primary turn totals → nova_damage, sustained_damage
  ↓ rule system: build_character_combat_profile(nova_damage, sustained_damage)
  ↓ CharacterCombatProfile (in-memory object used by Monster Factory)
  ↓ GET /campaigns/{id}/combat/party-summary endpoint
  ↓ PartyProfileInput auto-load (Monster Factory wizard Step 1)
```

The service layer (`backend/app/monster_factory/services/character_combat_service.py`) is the only place that touches the database in this pipeline. The rule system layer is pure Python with no DB access.

### Scene Enemy Stat Block Linking

`scene_enemies.saved_encounter_monster_id` is an optional FK to `saved_encounter_monsters.id` (SET NULL on cascade).

When set:
- `GET /scenes/{id}` returns `stat_block_summary: { id, name, hp, ac, is_boss, combat_role_name }` alongside each enemy
- `GET /scenes/{scene_id}/enemies/{enemy_id}/stat-block` returns the full `MonsterStatBlock`
- The scene editor shows a "Stat Block" button per linked enemy
- Enemies are created with this FK by the "Monster Factory" and "Attach Saved Encounter" flows in the scene editor

## Build Files

- Monster Factory build instructions: `docs/MONSTER_FACTORY_BUILD.md` — All tasks complete.
- Combat update build instructions: `docs/COMBAT_UPDATE.md` — All tasks complete.
- Combat damage refactor: `docs/COMBAT_DAMAGE_REFACTOR.md` — All tasks complete.