import os
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router, seed_initial_user
from .routers import scenes
from .routers.campaigns import router as campaigns_router
from .routers.characters import router as characters_router
from .routers.checks import router as checks_router
from .routers.rolls import router as rolls_router
from .routers.sessions import router as sessions_router
from .routers.storylines import router as storylines_router
from .routers.wiki import router as wiki_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    seed_initial_user()
    yield


app = FastAPI(title="DM Toolkit API", version="0.2.0", lifespan=lifespan)


@app.get("/health")
def health_check():
    return {"status": "ok"}

allowed_origins = ["http://localhost:5173", "http://localhost:8000"]

frontend_url = os.environ.get("FRONTEND_URL")
if frontend_url:
    allowed_origins.append(frontend_url)
else:
    print("WARNING: FRONTEND_URL not set — production CORS will only allow localhost origins")

app.add_middleware(
    CORSMiddleware,
    allow_origins=allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(campaigns_router, prefix="/campaigns", tags=["campaigns"])
app.include_router(
    sessions_router,
    prefix="/campaigns/{campaign_id}/sessions",
    tags=["sessions"],
)
app.include_router(storylines_router, prefix="/campaigns/{campaign_id}/storylines", tags=["storylines"])
app.include_router(scenes.router, prefix="/scenes", tags=["scenes"])
app.include_router(characters_router, prefix="/characters", tags=["characters"])
app.include_router(checks_router, tags=["checks"])
app.include_router(rolls_router, tags=["rolls"])
app.include_router(wiki_router, prefix="/wiki", tags=["wiki"])
