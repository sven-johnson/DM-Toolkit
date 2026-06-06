import uuid
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session as DBSession, selectinload

from ..auth import get_current_user, require_campaign_role, ROLE_HIERARCHY
from ..database import get_db
from ..models import Campaign, CampaignMember, Character, RuleSystem, Session, Storyline, User
from ..monster_factory.services.character_combat_service import get_campaign_party_summary
from ..schemas import (
    CampaignCreate,
    CampaignMemberOut,
    CampaignMemberUpsert,
    CampaignOut,
    CampaignUpdate,
    CampaignWithRelations,
    CharacterOut,
    SessionOut,
    StorylineOut,
    UserOut,
)


class _CharacterProfileBrief(BaseModel):
    character_id: str
    character_name: str
    max_hp: int
    armor_class: int
    nova_damage: float
    sustained_damage_per_round: float
    proficiency_bonus: int
    level: int


class _PartySummaryOut(BaseModel):
    campaign_id: str
    rule_system_slug: str
    party_size: int
    avg_level: float
    avg_hp: float
    total_hp: int
    lowest_hp: int
    avg_ac: float
    party_nova: float
    party_sustained: float
    has_complete_data: bool
    incomplete_characters: list[str]
    characters: list[_CharacterProfileBrief]

router = APIRouter()

VALID_ROLES = {"player", "game_master", "owner"}


def _campaign_out(campaign: Campaign, role: str | None) -> dict:
    return {
        "id": campaign.id,
        "name": campaign.name,
        "created_at": campaign.created_at,
        "my_role": role,
    }


def _get_campaign_or_404(campaign_id: str, db: DBSession) -> Campaign:
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return campaign


# ── Campaign CRUD ─────────────────────────────────────────────────────────────

@router.get("", response_model=list[CampaignOut])
def list_campaigns(
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    if user.is_admin:
        campaigns = db.query(Campaign).order_by(Campaign.created_at.desc()).all()
        member_map = {
            m.campaign_id: m.role
            for m in db.query(CampaignMember).filter(CampaignMember.user_id == user.id).all()
        }
        return [_campaign_out(c, member_map.get(c.id)) for c in campaigns]

    members = (
        db.query(CampaignMember)
        .filter(CampaignMember.user_id == user.id)
        .join(Campaign, CampaignMember.campaign_id == Campaign.id)
        .order_by(Campaign.created_at.desc())
        .all()
    )
    return [_campaign_out(m.campaign, m.role) for m in members]


@router.post("", response_model=CampaignOut, status_code=status.HTTP_201_CREATED)
def create_campaign(
    body: CampaignCreate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    campaign = Campaign(id=str(uuid.uuid4()), **body.model_dump())
    db.add(campaign)
    db.flush()  # get campaign.id before adding member
    member = CampaignMember(
        id=str(uuid.uuid4()),
        user_id=user.id,
        campaign_id=campaign.id,
        role="owner",
    )
    db.add(member)
    db.commit()
    db.refresh(campaign)
    return _campaign_out(campaign, "owner")


@router.get("/{campaign_id}", response_model=CampaignWithRelations)
def get_campaign(
    campaign_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    role = require_campaign_role(campaign_id, user, db)
    campaign = (
        db.query(Campaign)
        .options(selectinload(Campaign.storylines), selectinload(Campaign.rule_system))
        .filter(Campaign.id == campaign_id)
        .first()
    )
    if not campaign:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
    return {
        "id": campaign.id,
        "name": campaign.name,
        "created_at": campaign.created_at,
        "my_role": role,
        "storylines": campaign.storylines,
        "rule_system": campaign.rule_system,
    }


@router.put("/{campaign_id}", response_model=CampaignOut)
def update_campaign(
    campaign_id: str,
    body: CampaignUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    role = require_campaign_role(campaign_id, user, db, min_role="game_master")
    campaign = _get_campaign_or_404(campaign_id, db)
    data = body.model_dump(exclude_none=True)
    if "rule_system_id" in data:
        rs_id = data.pop("rule_system_id")
        if rs_id is not None and not db.query(RuleSystem).filter(RuleSystem.id == rs_id).first():
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule system not found")
        campaign.rule_system_id = rs_id
    for key, value in data.items():
        setattr(campaign, key, value)
    db.commit()
    db.refresh(campaign)
    return _campaign_out(campaign, role)


@router.delete("/{campaign_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_campaign(
    campaign_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    role = require_campaign_role(campaign_id, user, db, min_role="owner")
    # Admins without explicit membership also pass; enforce owner for non-admins
    if not user.is_admin and role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only the campaign owner can delete it")
    campaign = _get_campaign_or_404(campaign_id, db)
    db.delete(campaign)
    db.commit()


# ── Campaign sub-resources ────────────────────────────────────────────────────

@router.get("/{campaign_id}/sessions", response_model=list[SessionOut])
def list_campaign_sessions(
    campaign_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Session]:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    _get_campaign_or_404(campaign_id, db)
    return (
        db.query(Session)
        .filter(Session.campaign_id == campaign_id)
        .order_by(Session.created_at.desc(), Session.id.desc())
        .all()
    )


@router.get("/{campaign_id}/storylines", response_model=list[StorylineOut])
def list_campaign_storylines(
    campaign_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Storyline]:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    _get_campaign_or_404(campaign_id, db)
    return (
        db.query(Storyline)
        .filter(Storyline.campaign_id == campaign_id)
        .order_by(Storyline.order_index, Storyline.id)
        .all()
    )


@router.get("/{campaign_id}/characters", response_model=list[CharacterOut])
def list_campaign_characters(
    campaign_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[Character]:
    require_campaign_role(campaign_id, user, db, min_role="game_master")
    _get_campaign_or_404(campaign_id, db)
    return (
        db.query(Character)
        .filter(Character.campaign_id == campaign_id)
        .order_by(Character.id)
        .all()
    )


# ── Member management ─────────────────────────────────────────────────────────

@router.get("/{campaign_id}/members", response_model=list[CampaignMemberOut])
def list_members(
    campaign_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[dict]:
    role = require_campaign_role(campaign_id, user, db, min_role="owner")
    if not user.is_admin and role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can manage members")
    _get_campaign_or_404(campaign_id, db)
    members = (
        db.query(CampaignMember)
        .filter(CampaignMember.campaign_id == campaign_id)
        .join(User, CampaignMember.user_id == User.id)
        .order_by(User.username)
        .all()
    )
    return [
        {
            "user_id": m.user_id,
            "username": m.user.username,
            "role": m.role,
            "created_at": m.created_at,
        }
        for m in members
    ]


@router.put("/{campaign_id}/members", response_model=CampaignMemberOut)
def upsert_member(
    campaign_id: str,
    body: CampaignMemberUpsert,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> dict:
    """Add or update a campaign member. Requires owner or admin."""
    role = require_campaign_role(campaign_id, user, db, min_role="owner")
    if not user.is_admin and role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can manage members")
    if body.role not in VALID_ROLES:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=f"Invalid role '{body.role}'")
    _get_campaign_or_404(campaign_id, db)

    target = db.query(User).filter(User.id == body.user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    existing = db.query(CampaignMember).filter(
        CampaignMember.user_id == body.user_id,
        CampaignMember.campaign_id == campaign_id,
    ).first()

    if existing:
        existing.role = body.role
        db.commit()
        db.refresh(existing)
        member = existing
    else:
        member = CampaignMember(
            id=str(uuid.uuid4()),
            user_id=body.user_id,
            campaign_id=campaign_id,
            role=body.role,
        )
        db.add(member)
        db.commit()
        db.refresh(member)

    return {
        "user_id": member.user_id,
        "username": target.username,
        "role": member.role,
        "created_at": member.created_at,
    }


@router.delete("/{campaign_id}/members/{target_user_id}", status_code=status.HTTP_204_NO_CONTENT)
def remove_member(
    campaign_id: str,
    target_user_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    role = require_campaign_role(campaign_id, user, db, min_role="owner")
    if not user.is_admin and role != "owner":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Only owners can manage members")
    member = db.query(CampaignMember).filter(
        CampaignMember.user_id == target_user_id,
        CampaignMember.campaign_id == campaign_id,
    ).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")
    db.delete(member)
    db.commit()


# ── Combat: Party Summary ─────────────────────────────────────────────────────

@router.get("/{campaign_id}/combat/party-summary", response_model=_PartySummaryOut)
def get_party_summary(
    campaign_id: str,
    db: DBSession = Depends(get_db),
) -> _PartySummaryOut:
    """Return the combat party summary for a campaign.

    Used by Monster Factory to auto-load party data.
    No authentication required (read-only, used in the DM tool context).
    """
    try:
        summary = get_campaign_party_summary(campaign_id, db)
    except ValueError as e:
        raise HTTPException(status.HTTP_404_NOT_FOUND, str(e))

    return _PartySummaryOut(
        campaign_id=summary.campaign_id,
        rule_system_slug=summary.rule_system_slug,
        party_size=summary.party_size,
        avg_level=summary.avg_level,
        avg_hp=summary.avg_hp,
        total_hp=summary.total_hp,
        lowest_hp=summary.lowest_hp,
        avg_ac=summary.avg_ac,
        party_nova=summary.party_nova,
        party_sustained=summary.party_sustained,
        has_complete_data=summary.has_complete_data,
        incomplete_characters=summary.incomplete_characters,
        characters=[
            _CharacterProfileBrief(
                character_id=p.character_id,
                character_name=p.character_name,
                max_hp=p.max_hp,
                armor_class=p.armor_class,
                nova_damage=p.nova_damage,
                sustained_damage_per_round=p.sustained_damage_per_round,
                proficiency_bonus=p.proficiency_bonus,
                level=p.level,
            )
            for p in summary.characters
        ],
    )
