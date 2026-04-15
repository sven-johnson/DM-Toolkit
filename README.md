# DM Toolkit

A local-network Dungeon Master's toolkit. Stores session notes and scenes with a drag-and-drop interface and Markdown support.

## Stack

| Layer    | Tech                              |
|----------|-----------------------------------|
| Frontend | React + TypeScript (Vite)         |
| Backend  | Python FastAPI + SQLAlchemy       |
| Database | MySQL 8 (Docker)                  |
| Auth     | JWT (credentials in `.env`)       |

---

## Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Node.js](https://nodejs.org/) 20+
- Python 3.11+

---

## Setup

### 1. Environment files

Create three `.env` files — one in each location below. The [`.env.example`](.env.example) at the project root shows all variables and which file each block belongs in.

**`DM-Toolkit/.env`** — used by Docker Compose:
```
MYSQL_ROOT_PASSWORD=rootpassword
MYSQL_DATABASE=dm_toolkit
MYSQL_USER=dm_user
MYSQL_PASSWORD=dm_password
```

**`backend/.env`** — used by FastAPI:
```
DATABASE_URL=mysql+pymysql://dm_user:dm_password@localhost:3306/dm_toolkit
AUTH_USERNAME=admin
AUTH_PASSWORD=changeme
SECRET_KEY=<generate with: python -c "import secrets; print(secrets.token_hex(32))">
ACCESS_TOKEN_EXPIRE_MINUTES=480
```

**`frontend/.env`** — used by Vite:
```
VITE_API_URL=http://localhost:8000
```
> When connecting from another device on the same network, replace `localhost` with your machine's local IP address (e.g. `http://192.168.1.10:8000`).

---

### 2. Start MySQL

```bash
docker compose up -d
```

Wait a few seconds for MySQL to initialise (you can check with `docker compose logs -f db`).

---

### 3. Backend

```bash
cd backend

# Create and activate a virtual environment
python -m venv .venv

# Windows
.venv\Scripts\activate

# macOS / Linux
source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run database migrations
alembic upgrade head

# Start the API server (accessible on the local network)
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

The API is now available at `http://localhost:8000`.
Interactive docs: `http://localhost:8000/docs`

---

### 4. Frontend

```bash
cd frontend
npm install   # skip if already done during setup
npm run dev
```

Open `http://localhost:5173` in your browser. Log in with the credentials from `backend/.env`.

---

## Project structure

```
DM-Toolkit/
├── backend/
│   ├── app/
│   │   ├── main.py          # FastAPI app entry point
│   │   ├── auth.py          # JWT auth
│   │   ├── database.py      # SQLAlchemy engine + session
│   │   ├── models.py        # ORM models (Session, Scene)
│   │   ├── schemas.py       # Pydantic schemas
│   │   └── routers/
│   │       ├── sessions.py  # Session & scene-creation endpoints
│   │       └── scenes.py    # Scene update / delete endpoints
│   ├── alembic/             # Database migrations
│   ├── alembic.ini
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── api/             # Axios client
│       ├── components/      # SceneCard, SceneList, MarkdownBody
│       ├── hooks/           # React Query hooks
│       ├── pages/           # Login, Sessions, SessionDetail
│       └── types/           # TypeScript interfaces
├── docs/
│   └── api.md               # Full API reference
├── docker-compose.yml
└── .env.example
```

---

## Connecting to the database (VS Code)

With MySQL running (`docker compose up -d` or `dmtools start`), you can browse the database directly from VS Code.

**Recommended extension:** [Database Client](https://marketplace.visualstudio.com/items?itemName=cweijan.vscode-database-client2) (cweijan) — supports MySQL and has a full table/query browser. [SQLTools](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools) with the [SQLTools MySQL/MariaDB driver](https://marketplace.visualstudio.com/items?itemName=mtxr.sqltools-driver-mysql) also works.

**Connection settings** (same for any extension):

| Field    | Value        |
|----------|--------------|
| Host     | `127.0.0.1`  |
| Port     | `3306`       |
| Username | `dm_user`    |
| Password | `dm_password`|
| Database | `dm_toolkit` |

> Use `127.0.0.1` rather than `localhost` — on Windows, `localhost` can try a socket connection that Docker doesn't expose.

**Tables:**
- `sessions` — session titles and dates
- `scenes` — scene content, ordered by `order_index` within each session

---

## Running from PowerShell (`dmtools`)

`dmtools` is a PowerShell CLI that starts, stops, and restarts all three services from a single command. It opens the backend and frontend in their own PowerShell windows so you can see logs.

### One-time setup

Add the project folder to your PATH so `dmtools` works from any directory:

```powershell
# Paste this into PowerShell — adds the folder permanently for your user account
[Environment]::SetEnvironmentVariable(
    "PATH",
    $env:PATH + ";C:\Users\svend\Documents\Coding Projects\DM-Toolkit",
    "User"
)
```

Then **restart PowerShell** (or open a new window) for the change to take effect.

### Commands

```powershell
dmtools start      # Start MySQL, backend, and frontend
dmtools stop       # Stop all services and shut down MySQL
dmtools restart    # Restart everything
```

`dmtools start` opens two new PowerShell windows (one for the backend, one for the frontend) and prints the URLs when ready. The main window is free to use for other commands.

> **Note:** MySQL must complete its health check before the backend starts. This takes ~10–15 seconds on first run. Subsequent starts are faster.

---

## Generating new migrations

After changing `app/models.py`, generate and apply a new migration from the `backend/` directory:

```bash
alembic revision --autogenerate -m "describe your change"
alembic upgrade head
```

---

## Railway Deployment (Backend)

- Backend URL: https://dm-toolkit-production.up.railway.app
- Deploys automatically on push to main branch
- Root directory is set to `/backend` in Railway dashboard
- Migrations run automatically via `start.sh` on each deploy
- Environment variables set in Railway dashboard:
  - `FRONTEND_URL=https://dm-toolkit.vercel.app`
  - `INITIAL_USERNAME`, `INITIAL_PASSWORD`, `SECRET_KEY` (set manually)
  - `DATABASE_URL` injected automatically by Railway MySQL plugin

---

## Vercel Deployment (Frontend)

- Frontend URL: https://dm-toolkit.vercel.app
- Deploys automatically on push to main branch
- Root directory is set to `/frontend` in Vercel dashboard
- Environment variable set in Vercel dashboard:
  - `VITE_API_URL=https://dm-toolkit-production.up.railway.app`
- Build command: `npm run build`
- Output directory: `dist`

---

## Local Development

- Prerequisites: Docker Desktop, Node 18+, Python 3.11+
- Copy `backend/.env.example` to `backend/.env` and fill in values
- Copy `frontend/.env.example` to `frontend/.env`
- Start MySQL: `docker compose up -d`
- Start backend: `cd backend && uvicorn app.main:app --reload --port 8000`
- Start frontend: `cd frontend && npm run dev`
- Run migrations: `cd backend && alembic upgrade head`

---

## Accessing from other devices (e.g. tablet at the table)

1. Make sure your machine's firewall allows inbound connections on ports `8000` and `5173`.
2. Set `VITE_API_URL` in `frontend/.env` to your machine's local IP, e.g.:
   ```
   VITE_API_URL=http://192.168.1.10:8000
   ```
3. Restart the Vite dev server after changing `.env`.
4. Browse to `http://192.168.1.10:5173` from any device on the same network.
