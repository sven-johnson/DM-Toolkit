from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from ..auth import verify_token
from ..database import get_db
from ..models import Character
from ..schemas import CharacterCreate, CharacterOut, CharacterUpdate

router = APIRouter()


@router.get("", response_model=list[CharacterOut])
def list_characters(
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[Character]:
    return db.query(Character).order_by(Character.id).all()


@router.post("", response_model=CharacterOut, status_code=status.HTTP_201_CREATED)
def create_character(
    body: CharacterCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Character:
    character = Character(**body.model_dump())
    db.add(character)
    db.commit()
    db.refresh(character)
    return character


@router.get("/{character_id}", response_model=CharacterOut)
def get_character(
    character_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Character:
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    return character


@router.put("/{character_id}", response_model=CharacterOut)
def update_character(
    character_id: int,
    body: CharacterUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Character:
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(character, key, value)
    db.commit()
    db.refresh(character)
    return character


@router.delete("/{character_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_character(
    character_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    character = db.query(Character).filter(Character.id == character_id).first()
    if not character:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Character not found")
    db.delete(character)
    db.commit()
