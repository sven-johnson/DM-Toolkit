from typing import Optional

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, Field

from ..name_generator import PROFILES, generate_names

router = APIRouter()


class GenerateRequest(BaseModel):
    profile: str = Field(..., description="Language profile key")
    count: int = Field(default=1, ge=1, le=50)
    seed: Optional[int] = Field(default=None)


class ProfileInfo(BaseModel):
    key: str
    display_name: str


class GenerateResponse(BaseModel):
    profile: str
    names: list[str]


@router.get("/profiles", response_model=list[ProfileInfo])
def list_profiles() -> list[ProfileInfo]:
    return [ProfileInfo(key=k, display_name=v.display_name) for k, v in PROFILES.items()]


@router.post("/generate", response_model=GenerateResponse)
def generate(req: GenerateRequest) -> GenerateResponse:
    try:
        names = generate_names(req.profile, count=req.count, seed=req.seed)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return GenerateResponse(profile=req.profile, names=names)


@router.get("/generate/{profile}", response_model=GenerateResponse)
def generate_quick(
    profile: str,
    count: int = Query(default=1, ge=1, le=50),
    seed: Optional[int] = Query(default=None),
) -> GenerateResponse:
    try:
        names = generate_names(profile, count=count, seed=seed)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
    return GenerateResponse(profile=profile, names=names)
