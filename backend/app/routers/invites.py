from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session as DBSession

from ..auth import get_current_user, require_campaign_role
from ..database import get_db
from ..invites_service import create_invite
from ..models import Campaign, CampaignMember, Invite, User
from ..schemas import InviteCreate, InviteOut
from ..utils import normalize_email

router = APIRouter()


@router.post("", response_model=InviteOut, status_code=status.HTTP_201_CREATED)
def create_invite_endpoint(
    body: InviteCreate,
    response: Response,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> Invite:
    email = normalize_email(str(body.email))

    if body.campaign_id is None:
        if not user.is_admin:
            raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Admin access required")
        role = None
    else:
        campaign = db.query(Campaign).filter(Campaign.id == body.campaign_id).first()
        if not campaign:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Campaign not found")
        require_campaign_role(body.campaign_id, user, db, min_role="game_master")
        role = "player"

    existing_user = db.query(User).filter(User.email == email).first()
    if body.campaign_id is None:
        if existing_user:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="A user with this email already exists.",
            )
    else:
        if existing_user:
            is_member = (
                db.query(CampaignMember)
                .filter(
                    CampaignMember.user_id == existing_user.id,
                    CampaignMember.campaign_id == body.campaign_id,
                )
                .first()
            )
            if is_member:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="This user is already a member of this campaign.",
                )

    existing_invite = (
        db.query(Invite)
        .filter(
            Invite.email == email,
            Invite.campaign_id == body.campaign_id,
            Invite.accepted_at.is_(None),
            Invite.expires_at > datetime.utcnow(),
        )
        .first()
    )
    if existing_invite:
        response.status_code = status.HTTP_200_OK
        return existing_invite

    return create_invite(db, email=email, inviter=user, campaign_id=body.campaign_id, role=role)
