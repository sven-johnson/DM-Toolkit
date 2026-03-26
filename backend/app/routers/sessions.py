from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession, selectinload

from ..auth import verify_token
from ..database import get_db
from ..models import Scene, Session
from ..schemas import (
    SceneCreate,
    SceneOut,
    SceneReorder,
    SessionCreate,
    SessionOut,
    SessionUpdate,
    SessionWithScenes,
)

router = APIRouter()


@router.get("", response_model=list[SessionOut])
def list_sessions(
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[Session]:
    return db.query(Session).order_by(Session.created_at.desc(), Session.id.desc()).all()


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    body: SessionCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Session:
    session = Session(**body.model_dump())
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionWithScenes)
def get_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Session:
    session = (
        db.query(Session)
        .options(
            selectinload(Session.scenes).selectinload(Scene.checks)
        )
        .filter(Session.id == session_id)
        .first()
    )
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    return session


@router.put("/{session_id}", response_model=SessionOut)
def update_session(
    session_id: int,
    body: SessionUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Session:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(session, key, value)
    db.commit()
    db.refresh(session)
    return session


@router.delete("/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    db.delete(session)
    db.commit()


@router.post(
    "/{session_id}/scenes",
    response_model=SceneOut,
    status_code=status.HTTP_201_CREATED,
)
def create_scene(
    session_id: int,
    body: SceneCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Scene:
    if not db.query(Session).filter(Session.id == session_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    order_index = db.query(Scene).filter(Scene.session_id == session_id).count()
    scene = Scene(session_id=session_id, order_index=order_index, **body.model_dump())
    db.add(scene)
    db.commit()
    db.refresh(scene)
    return scene


@router.put("/{session_id}/scenes/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_scenes(
    session_id: int,
    body: SceneReorder,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    scenes = db.query(Scene).filter(Scene.session_id == session_id).all()
    scene_map = {s.id: s for s in scenes}
    for index, scene_id in enumerate(body.scene_ids):
        if scene_id in scene_map:
            scene_map[scene_id].order_index = index
    db.commit()
