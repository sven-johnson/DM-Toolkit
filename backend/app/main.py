from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router
from .routers import scenes
from .routers.campaigns import router as campaigns_router
from .routers.characters import router as characters_router
from .routers.checks import router as checks_router
from .routers.rolls import router as rolls_router
from .routers.sessions import router as sessions_router
from .routers.storylines import router as storylines_router
from .routers.wiki import router as wiki_router

app = FastAPI(title="DM Toolkit API", version="0.2.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
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
