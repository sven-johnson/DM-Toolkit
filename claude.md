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

## Key Decisions
- [Add decisions here as you make them]

## What NOT to do
- Don't use Create React App
- Don't use SQLite (MySQL only)
- Don't hardcode localhost (use env vars)