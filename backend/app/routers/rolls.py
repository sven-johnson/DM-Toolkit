from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from ..auth import verify_token
from ..database import get_db
from ..models import Check, Roll, Scene, Session, SessionScene
from ..schemas import RollHistoryItem, RollOut, RollUpsert, SessionRollOut

router = APIRouter()


@router.put("/rolls/{check_id}/{character_id}", response_model=RollOut)
def upsert_roll(
    check_id: int,
    character_id: int,
    body: RollUpsert,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Roll:
    if not db.query(Check).filter(Check.id == check_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check not found")
    existing = (
        db.query(Roll)
        .filter(Roll.check_id == check_id, Roll.character_id == character_id)
        .first()
    )
    if existing:
        existing.die_result = body.die_result
        db.commit()
        db.refresh(existing)
        return existing
    roll = Roll(check_id=check_id, character_id=character_id, die_result=body.die_result)
    db.add(roll)
    db.commit()
    db.refresh(roll)
    return roll


@router.delete("/rolls/{check_id}/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_roll(
    check_id: int,
    character_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    roll = (
        db.query(Roll)
        .filter(Roll.check_id == check_id, Roll.character_id == character_id)
        .first()
    )
    if not roll:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Roll not found")
    db.delete(roll)
    db.commit()


@router.get("/sessions/{session_id}/rolls", response_model=list[SessionRollOut])
def get_session_rolls(
    session_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[SessionRollOut]:
    rolls = (
        db.query(Roll)
        .join(Roll.check)
        .join(Check.scene)
        .join(SessionScene, SessionScene.scene_id == Scene.id)
        .filter(SessionScene.session_id == session_id)
        .all()
    )
    result = []
    for roll in rolls:
        result.append(
            SessionRollOut(
                id=roll.id,
                check_id=roll.check_id,
                character_id=roll.character_id,
                die_result=roll.die_result,
                check_type=roll.check.check_type,
                subtype=roll.check.subtype,
                dc=roll.check.dc,
            )
        )
    return result


@router.get("/rolls/history", response_model=list[RollHistoryItem])
def get_roll_history(
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[RollHistoryItem]:
    rolls = (
        db.query(Roll)
        .join(Roll.check)
        .join(Check.scene)
        .outerjoin(SessionScene, SessionScene.scene_id == Scene.id)
        .outerjoin(Session, Session.id == SessionScene.session_id)
        .order_by(Session.id.desc(), Scene.id, Check.id, Roll.id)
        .all()
    )
    result = []
    for roll in rolls:
        check = roll.check
        scene = check.scene
        # Get first session association if any
        session_scene = scene.session_scenes[0] if scene.session_scenes else None
        session = session_scene.session if session_scene else None
        result.append(
            RollHistoryItem(
                id=roll.id,
                die_result=roll.die_result,
                character_id=roll.character_id,
                check_id=roll.check_id,
                check_type=check.check_type,
                subtype=check.subtype,
                dc=check.dc,
                character_ids=check.character_ids if check.character_ids else [],
                scene_id=scene.id,
                scene_title=scene.title,
                session_id=session.id if session else None,
                session_title=session.title if session else None,
            )
        )
    return result
