from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from ..auth import verify_token
from ..database import get_db
from ..models import Scene
from ..schemas import SceneOut, SceneUpdate

router = APIRouter()


@router.put("/{scene_id}", response_model=SceneOut)
def update_scene(
    scene_id: int,
    body: SceneUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Scene:
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(scene, key, value)
    db.commit()
    db.refresh(scene)
    return scene


@router.delete("/{scene_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_scene(
    scene_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    scene = db.query(Scene).filter(Scene.id == scene_id).first()
    if not scene:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    db.delete(scene)
    db.commit()
