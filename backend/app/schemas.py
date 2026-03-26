from datetime import date as DateType
from datetime import datetime

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------


class SceneCreate(BaseModel):
    title: str
    body: str = ""


class SceneUpdate(BaseModel):
    title: str | None = None
    body: str | None = None


class SceneOut(BaseModel):
    id: int
    session_id: int
    title: str
    body: str
    order_index: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class SessionCreate(BaseModel):
    title: str
    date: DateType | None = None


class SessionUpdate(BaseModel):
    title: str | None = None
    date: DateType | None = None


class SessionOut(BaseModel):
    id: int
    title: str
    date: DateType | None
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionWithScenes(SessionOut):
    scenes: list[SceneOut] = []


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------


class SceneReorder(BaseModel):
    scene_ids: list[int]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
