import uuid as uuid_lib

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession, selectinload

from ..auth import verify_token
from ..database import get_db
from ..models import Campaign, Check, Scene, Session, SessionScene, Storyline
from ..schemas import (
    SceneOut,
    SceneReorder,
    SessionCreate,
    SessionOut,
    SessionUpdate,
    SessionWithScenes,
)

router = APIRouter()


def _load_session(session_id: int, db: DBSession) -> Session:
    return (
        db.query(Session)
        .options(
            selectinload(Session.session_scenes)
            .selectinload(SessionScene.scene)
            .selectinload(Scene.checks)
            .selectinload(Check.rolls)
        )
        .options(
            selectinload(Session.session_scenes)
            .selectinload(SessionScene.scene)
            .selectinload(Scene.enemies)
        )
        .options(
            selectinload(Session.session_scenes)
            .selectinload(SessionScene.scene)
            .selectinload(Scene.shop_items)
        )
        .filter(Session.id == session_id)
        .first()
    )


@router.post("", response_model=SessionOut, status_code=status.HTTP_201_CREATED)
def create_session(
    campaign_id: int,
    body: SessionCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Session:
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")

    storyline_id = body.storyline_id
    if storyline_id and not db.query(Storyline).filter(
        Storyline.id == storyline_id, Storyline.campaign_id == campaign_id
    ).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Storyline not found")

    data = body.model_dump(exclude={"storyline_id"})
    session = Session(
        uuid=str(uuid_lib.uuid4()),
        campaign_id=campaign_id,
        active_storyline_id=storyline_id,
        **data,
    )
    db.add(session)
    db.flush()

    # Auto-add the first available scene from the selected storyline
    if storyline_id:
        used_scene_ids = {
            row[0] for row in db.query(SessionScene.scene_id).all()
        }
        first_scene = (
            db.query(Scene)
            .filter(
                Scene.storyline_id == storyline_id,
                Scene.id.notin_(used_scene_ids),
            )
            .order_by(Scene.order_index)
            .first()
        )
        if first_scene:
            ss = SessionScene(session_id=session.id, scene_id=first_scene.id, order_index=0)
            db.add(ss)

    db.commit()
    db.refresh(session)
    return session


@router.get("/{session_id}", response_model=SessionWithScenes)
def get_session(
    session_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Session:
    session = _load_session(session_id, db)
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


@router.post("/{session_id}/next-scene", response_model=SceneOut)
def add_next_scene(
    session_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Scene:
    session = db.query(Session).filter(Session.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Session not found")
    if not session.active_storyline_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="No active storyline set for this session",
        )

    # Scenes already linked to any session
    used_scene_ids = {row[0] for row in db.query(SessionScene.scene_id).all()}

    next_scene = (
        db.query(Scene)
        .filter(
            Scene.storyline_id == session.active_storyline_id,
            Scene.id.notin_(used_scene_ids),
        )
        .order_by(Scene.order_index)
        .first()
    )
    if not next_scene:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="No more scenes available in this storyline",
        )

    next_order = db.query(SessionScene).filter(SessionScene.session_id == session_id).count()
    ss = SessionScene(session_id=session_id, scene_id=next_scene.id, order_index=next_order)
    db.add(ss)
    db.commit()
    db.refresh(next_scene)
    return next_scene


@router.delete(
    "/{session_id}/scenes/{scene_id}", status_code=status.HTTP_204_NO_CONTENT
)
def remove_scene_from_session(
    session_id: int,
    scene_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    ss = (
        db.query(SessionScene)
        .filter(
            SessionScene.session_id == session_id,
            SessionScene.scene_id == scene_id,
        )
        .first()
    )
    if not ss:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not in session")
    db.delete(ss)
    db.commit()


@router.put("/{session_id}/scenes/reorder", status_code=status.HTTP_204_NO_CONTENT)
def reorder_scenes(
    session_id: int,
    body: SceneReorder,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    session_scenes = (
        db.query(SessionScene).filter(SessionScene.session_id == session_id).all()
    )
    ss_map = {ss.scene_id: ss for ss in session_scenes}
    for index, scene_id in enumerate(body.scene_ids):
        if scene_id in ss_map:
            ss_map[scene_id].order_index = index
    db.commit()
