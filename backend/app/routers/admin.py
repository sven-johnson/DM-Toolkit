from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession

from ..auth import get_current_user
from ..database import get_db
from ..models import CampaignMember, User
from ..schemas import CampaignMemberUpsert, UserOut

router = APIRouter()


def _require_admin(user: User) -> None:
    if not user.is_admin:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")


@router.get("/users", response_model=list[UserOut])
def list_users(
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> list[User]:
    _require_admin(user)
    return db.query(User).order_by(User.username).all()


@router.put("/users/{target_user_id}/admin", response_model=UserOut)
def set_admin(
    target_user_id: str,
    is_admin: bool,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> User:
    _require_admin(user)
    target = db.query(User).filter(User.id == target_user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    target.is_admin = is_admin
    db.commit()
    db.refresh(target)
    return target


@router.put("/campaigns/{campaign_id}/owner", status_code=status.HTTP_204_NO_CONTENT)
def set_campaign_owner(
    campaign_id: str,
    body: CampaignMemberUpsert,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> None:
    """Set a user as the campaign owner, demoting any existing owner to game_master."""
    _require_admin(user)

    target = db.query(User).filter(User.id == body.user_id).first()
    if not target:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")

    # Demote existing owners
    existing_owners = db.query(CampaignMember).filter(
        CampaignMember.campaign_id == campaign_id,
        CampaignMember.role == "owner",
    ).all()
    for m in existing_owners:
        if m.user_id != body.user_id:
            m.role = "game_master"

    # Upsert the new owner
    import uuid
    member = db.query(CampaignMember).filter(
        CampaignMember.user_id == body.user_id,
        CampaignMember.campaign_id == campaign_id,
    ).first()
    if member:
        member.role = "owner"
    else:
        db.add(CampaignMember(
            id=str(uuid.uuid4()),
            user_id=body.user_id,
            campaign_id=campaign_id,
            role="owner",
        ))

    db.commit()
