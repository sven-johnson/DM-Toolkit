from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .auth import router as auth_router
from .routers import scenes, sessions
from .routers.characters import router as characters_router
from .routers.checks import router as checks_router
from .routers.rolls import router as rolls_router

app = FastAPI(title="DM Toolkit API", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(sessions.router, prefix="/sessions", tags=["sessions"])
app.include_router(scenes.router, prefix="/scenes", tags=["scenes"])
app.include_router(characters_router, prefix="/characters", tags=["characters"])
app.include_router(checks_router, tags=["checks"])
app.include_router(rolls_router, tags=["rolls"])
