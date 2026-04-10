import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession, selectinload

from ..auth import verify_token
from ..database import get_db
from ..models import Check, Scene, Storyline
from ..schemas import (
    SceneCreate,
    SceneOut,
    SceneReorder,
    StorylineCreate,
    StorylineOut,
    StorylineUpdate,
    StorylineWithScenes,
)

router = APIRouter()


@router.post("", response_model=StorylineOut, status_code=status.HTTP_201_CREATED)
def create_storyline(
    campaign_id: int,
    body: StorylineCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Storyline:
    order_index = (
        db.query(Storyline).filter(Storyline.campaign_id == campaign_id).count()
    )
    storyline = Storyline(
        uuid=str(uuid_lib.uuid4()),
        campaign_id=campaign_id,
        order_index=order_index,
        **body.model_dump(),
    )
    db.add(storyline)
    db.commit()
    db.refresh(storyline)
    return storyline


@router.get("/{storyline_id}", response_model=StorylineWithScenes)
def get_storyline(
    storyline_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Storyline:
    storyline = (
        db.query(Storyline)
        .options(
            selectinload(Storyline.scenes)
            .selectinload(Scene.checks)
            .selectinload(Check.rolls)
        )
        .options(
            selectinload(Storyline.scenes).selectinload(Scene.enemies)
        )
        .options(
            selectinload(Storyline.scenes).selectinload(Scene.shop_items)
        )
        .filter(Storyline.id == storyline_id)
        .first()
    )
    if not storyline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    return storyline


@router.put("/{storyline_id}", response_model=StorylineOut)
def update_storyline(
    storyline_id: int,
    body: StorylineUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Storyline:
    storyline = db.query(Storyline).filter(Storyline.id == storyline_id).first()
    if not storyline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(storyline, key, value)
    db.commit()
    db.refresh(storyline)
    return storyline


@router.delete("/{storyline_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_storyline(
    storyline_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    storyline = db.query(Storyline).filter(Storyline.id == storyline_id).first()
    if not storyline:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    db.delete(storyline)
    db.commit()


@router.post(
    "/{storyline_id}/scenes",
    response_model=SceneOut,
    status_code=status.HTTP_201_CREATED,
)
def create_scene(
    storyline_id: int,
    body: SceneCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Scene:
    if not db.query(Storyline).filter(Storyline.id == storyline_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")
    order_index = db.query(Scene).filter(Scene.storyline_id == storyline_id).count()
    scene = Scene(
        uuid=str(uuid_lib.uuid4()),
        storyline_id=storyline_id,
        order_index=order_index,
        **body.model_dump(),
    )
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.put("/{storyline_id}/scenes/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_scenes(
    storyline_id: int,
    body: SceneReorder,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    scenes = db.query(Scene).filter(Scene.storyline_id == storyline_id).all()
    scene_map = {s.id: s for s in scenes}
    for index, scene_id in enumerate(body.scene_ids):
        if scene_id in scene_map:
            scene_map[scene_id].order_index = index
    db.commit()
