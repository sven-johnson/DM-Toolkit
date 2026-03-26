from datetime import date as DateType
from datetime import datetime
from typing import Optional

from pydantic import BaseModel


# ---------------------------------------------------------------------------
# Character
# ---------------------------------------------------------------------------


class CharacterCreate(BaseModel):
    name: str = ""
    char_class: str = ""
    subclass: str = ""
    level: int = 1
    str_score: int = 10
    dex_score: int = 10
    con_score: int = 10
    int_score: int = 10
    wis_score: int = 10
    cha_score: int = 10
    str_mod: int = 0
    dex_mod: int = 0
    con_mod: int = 0
    int_mod: int = 0
    wis_mod: int = 0
    cha_mod: int = 0
    acrobatics: int = 0
    animal_handling: int = 0
    arcana: int = 0
    athletics: int = 0
    deception: int = 0
    history: int = 0
    insight: int = 0
    intimidation: int = 0
    investigation: int = 0
    medicine: int = 0
    nature: int = 0
    perception: int = 0
    performance: int = 0
    persuasion: int = 0
    religion: int = 0
    sleight_of_hand: int = 0
    stealth: int = 0
    survival: int = 0
    str_save: int = 0
    dex_save: int = 0
    con_save: int = 0
    int_save: int = 0
    wis_save: int = 0
    cha_save: int = 0
    ac: int = 10
    max_hp: int = 1


class CharacterUpdate(BaseModel):
    name: Optional[str] = None
    char_class: Optional[str] = None
    subclass: Optional[str] = None
    level: Optional[int] = None
    str_score: Optional[int] = None
    dex_score: Optional[int] = None
    con_score: Optional[int] = None
    int_score: Optional[int] = None
    wis_score: Optional[int] = None
    cha_score: Optional[int] = None
    str_mod: Optional[int] = None
    dex_mod: Optional[int] = None
    con_mod: Optional[int] = None
    int_mod: Optional[int] = None
    wis_mod: Optional[int] = None
    cha_mod: Optional[int] = None
    acrobatics: Optional[int] = None
    animal_handling: Optional[int] = None
    arcana: Optional[int] = None
    athletics: Optional[int] = None
    deception: Optional[int] = None
    history: Optional[int] = None
    insight: Optional[int] = None
    intimidation: Optional[int] = None
    investigation: Optional[int] = None
    medicine: Optional[int] = None
    nature: Optional[int] = None
    perception: Optional[int] = None
    performance: Optional[int] = None
    persuasion: Optional[int] = None
    religion: Optional[int] = None
    sleight_of_hand: Optional[int] = None
    stealth: Optional[int] = None
    survival: Optional[int] = None
    str_save: Optional[int] = None
    dex_save: Optional[int] = None
    con_save: Optional[int] = None
    int_save: Optional[int] = None
    wis_save: Optional[int] = None
    cha_save: Optional[int] = None
    ac: Optional[int] = None
    max_hp: Optional[int] = None


class CharacterOut(BaseModel):
    id: int
    name: str
    char_class: str
    subclass: str
    level: int
    str_score: int
    dex_score: int
    con_score: int
    int_score: int
    wis_score: int
    cha_score: int
    str_mod: int
    dex_mod: int
    con_mod: int
    int_mod: int
    wis_mod: int
    cha_mod: int
    acrobatics: int
    animal_handling: int
    arcana: int
    athletics: int
    deception: int
    history: int
    insight: int
    intimidation: int
    investigation: int
    medicine: int
    nature: int
    perception: int
    performance: int
    persuasion: int
    religion: int
    sleight_of_hand: int
    stealth: int
    survival: int
    str_save: int
    dex_save: int
    con_save: int
    int_save: int
    wis_save: int
    cha_save: int
    ac: int
    max_hp: int

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Roll
# ---------------------------------------------------------------------------


class RollUpsert(BaseModel):
    die_result: int


class RollOut(BaseModel):
    id: int
    check_id: int
    character_id: int
    die_result: int

    model_config = {"from_attributes": True}


class SessionRollOut(BaseModel):
    id: int
    check_id: int
    character_id: int
    die_result: int
    check_type: str
    subtype: str
    dc: int

    model_config = {"from_attributes": True}


class RollHistoryItem(BaseModel):
    id: int
    die_result: int
    character_id: int
    check_id: int
    check_type: str
    subtype: str
    dc: int
    character_ids: list[int]
    scene_id: int
    scene_title: str
    session_id: int
    session_title: str

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Check
# ---------------------------------------------------------------------------


class CheckCreate(BaseModel):
    scene_id: int
    check_type: str
    subtype: str
    dc: int = 10
    character_ids: list[int] = []


class CheckUpdate(BaseModel):
    check_type: Optional[str] = None
    subtype: Optional[str] = None
    dc: Optional[int] = None
    character_ids: Optional[list[int]] = None
    order_index: Optional[int] = None


class CheckOut(BaseModel):
    id: int
    scene_id: int
    check_type: str
    subtype: str
    dc: int
    character_ids: list[int]
    order_index: int

    model_config = {"from_attributes": True}


class CheckWithRolls(CheckOut):
    rolls: list[RollOut] = []


# ---------------------------------------------------------------------------
# Scene
# ---------------------------------------------------------------------------


class SceneCreate(BaseModel):
    title: str
    body: str = ""


class SceneUpdate(BaseModel):
    title: Optional[str] = None
    body: Optional[str] = None


class SceneOut(BaseModel):
    id: int
    session_id: int
    title: str
    body: str
    order_index: int
    created_at: datetime
    updated_at: datetime
    checks: list[CheckWithRolls] = []

    model_config = {"from_attributes": True}


# ---------------------------------------------------------------------------
# Session
# ---------------------------------------------------------------------------


class SessionCreate(BaseModel):
    title: str
    date: Optional[DateType] = None


class SessionUpdate(BaseModel):
    title: Optional[str] = None
    date: Optional[DateType] = None


class SessionOut(BaseModel):
    id: int
    title: str
    date: Optional[DateType]
    created_at: datetime

    model_config = {"from_attributes": True}


class SessionWithScenes(SessionOut):
    scenes: list[SceneOut] = []


# ---------------------------------------------------------------------------
# Reorder
# ---------------------------------------------------------------------------


class SceneReorder(BaseModel):
    scene_ids: list[int]


class CheckReorder(BaseModel):
    check_ids: list[int]


# ---------------------------------------------------------------------------
# Auth
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
