import uuid

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession, selectinload

from ..auth import verify_token
from ..database import get_db
from ..models import Campaign, Character, Session, Storyline
from ..schemas import (
    CampaignCreate,
    CampaignOut,
    CampaignUpdate,
    CampaignWithRelations,
    CharacterOut,
    SessionOut,
    StorylineOut,
)

router = APIRouter()


@router.get("", response_model=list[CampaignOut])
def list_campaigns(
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[Campaign]:
    return db.query(Campaign).order_by(Campaign.created_at.desc()).all()


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(
    body: CampaignCreate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Campaign:
    campaign = Campaign(uuid=str(uuid.uuid4()), **body.model_dump())
    db.add(campaign)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.get("/{campaign_id}", response_model=CampaignWithRelations)
def get_campaign(
    campaign_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Campaign:
    campaign = (
        db.query(Campaign)
        .options(selectinload(Campaign.storylines))
        .filter(Campaign.id == campaign_id)
        .first()
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


@router.put("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: int,
    body: CampaignUpdate,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> Campaign:
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    for key, value in body.model_dump(exclude_none=True).items():
        setattr(campaign, key, value)
    db.commit()
    db.refresh(campaign)
    return campaign


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(
    campaign_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> None:
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    db.delete(campaign)
    db.commit()


@router.get("/{campaign_id}/sessions", response_model=list[SessionOut])
def list_campaign_sessions(
    campaign_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[Session]:
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return (
        db.query(Session)
        .filter(Session.campaign_id == campaign_id)
        .order_by(Session.created_at.desc(), Session.id.desc())
        .all()
    )


@router.get("/{campaign_id}/storylines", response_model=list[StorylineOut])
def list_campaign_storylines(
    campaign_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[Storyline]:
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return (
        db.query(Storyline)
        .filter(Storyline.campaign_id == campaign_id)
        .order_by(Storyline.order_index, Storyline.id)
        .all()
    )


@router.get("/{campaign_id}/characters", response_model=list[CharacterOut])
def list_campaign_characters(
    campaign_id: int,
    db: DBSession = Depends(get_db),
    _: str = Depends(verify_token),
) -> list[Character]:
    if not db.query(Campaign).filter(Campaign.id == campaign_id).first():
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return (
        db.query(Character)
        .filter(Character.campaign_id == campaign_id)
        .order_by(Character.id)
        .all()
    )
