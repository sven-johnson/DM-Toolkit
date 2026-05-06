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