from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from ..auth import verify_token
from ..database import get_db
from ..models import Check, Scene
from ..schemas import CheckCreate, CheckOut, CheckReorder, CheckUpdate, CheckWithRolls

router = APIRouter()


@router.post(
    "/scenes/{scene_id}/checks",
    response_model=CheckWithRolls,
    status_code=status.HTTP_201_CREATED,
)
def create_check(
    scene_id: int,
    body: CheckCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Check:
    if not db.query(Scene).filter(Scene.id == scene_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Scene not found")
    order_index = db.query(Check).filter(Check.scene_id == scene_id).count()
    check = Check(
        scene_id=scene_id,
        check_type=body.check_type,
        subtype=body.subtype,
        dc=body.dc,
        character_ids=body.character_ids,
        order_index=order_index,
    )
    db.add(check)
    db.commit()
    db.refresh(check)
    return check


@router.put("/checks/{check_id}", response_model=CheckWithRolls)
def update_check(
    check_id: int,
    body: CheckUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Check:
    check = db.query(Check).filter(Check.id == check_id).first()
    if not check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(check, key, value)
    db.commit()
    db.refresh(check)
    return check


@router.delete("/checks/{check_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_check(
    check_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    check = db.query(Check).filter(Check.id == check_id).first()
    if not check:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Check not found")
    db.delete(check)
    db.commit()


@router.put(
    "/scenes/{scene_id}/checks/reorder",
    status_code=status.HTTP_204_NO_CONTENT,
)
def reorder_checks(
    scene_id: int,
    body: CheckReorder,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    checks = db.query(Check).filter(Check.scene_id == scene_id).all()
    check_map = {c.id: c for c in checks}
    for index, check_id in enumerate(body.check_ids):
        if check_id in check_map:
            check_map[check_id].order_index = index
    db.commit()
