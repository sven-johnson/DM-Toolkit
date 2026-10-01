import re
import uuid
from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session as DBSession

from ..auth import create_access_token, get_current_user, ph, require_campaign_role
from ..database import get_db
from ..invites_service import InviteAlreadyUsed, create_invite, get_invite_mode, get_valid_invite, mark_accepted
from ..models import Campaign, CampaignMember, Invite, User
from ..schemas import (
    InviteAcceptResponse,
    InviteCreate,
    InviteOut,
    InviteRegisterRequest,
    InviteStatusOut,
    TokenResponse,
)
from ..utils import normalize_email

router = APIRouter()

_USERNAME_RE = re.compile(r"^[A-Za-z0-9_-]{3,64}$")
MIN_PASSWORD_LENGTH = 8


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


_INVALID_INVITE = HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="invalid_invite")


@router.get("/{invite_id}", response_model=InviteStatusOut)
def get_invite_status(invite_id: str, db: DBSession = Depends(get_db)) -> InviteStatusOut:
    invite = get_valid_invite(db, invite_id)
    if invite is None:
        raise _INVALID_INVITE
    mode = get_invite_mode(db, invite)
    if mode == "dead":
        raise _INVALID_INVITE
    campaign_name = invite.campaign.name if invite.campaign_id else None
    return InviteStatusOut(mode=mode, email=invite.email, campaign_name=campaign_name, campaign_id=invite.campaign_id)


@router.post("/{invite_id}/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED)
def register_with_invite(
    invite_id: str,
    body: InviteRegisterRequest,
    db: DBSession = Depends(get_db),
) -> TokenResponse:
    invite = get_valid_invite(db, invite_id)
    if invite is None or get_invite_mode(db, invite) != "register":
        raise _INVALID_INVITE

    email = normalize_email(str(body.email))
    if db.query(User).filter(User.email == email).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="This email is already in use.")

    username = body.username.strip()
    if not _USERNAME_RE.fullmatch(username):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="Username must be 3-64 characters and contain only letters, numbers, underscores, and hyphens.",
        )
    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Username is already taken.")

    if len(body.password) < MIN_PASSWORD_LENGTH:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters.",
        )
    if body.password != body.confirm_password:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="Passwords do not match.")

    new_user = User(
        id=str(uuid.uuid4()),
        username=username,
        email=email,
        hashed_password=ph.hash(body.password),
        is_admin=False,
    )
    db.add(new_user)
    db.flush()

    try:
        mark_accepted(db, invite, new_user.id)
    except InviteAlreadyUsed:
        db.rollback()
        raise _INVALID_INVITE

    if invite.campaign_id:
        db.add(
            CampaignMember(
                id=str(uuid.uuid4()),
                user_id=new_user.id,
                campaign_id=invite.campaign_id,
                role=invite.role,
            )
        )

    db.commit()

    return TokenResponse(access_token=create_access_token({"sub": new_user.username}))


@router.post("/{invite_id}/accept", response_model=InviteAcceptResponse)
def accept_invite(
    invite_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
) -> InviteAcceptResponse:
    invite = get_valid_invite(db, invite_id)
    if invite is None or invite.campaign_id is None or get_invite_mode(db, invite) != "join":
        raise _INVALID_INVITE

    if invite.email != user.email:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="This invitation was sent to a different account.",
        )

    existing_membership = (
        db.query(CampaignMember)
        .filter(CampaignMember.user_id == user.id, CampaignMember.campaign_id == invite.campaign_id)
        .first()
    )
    if not existing_membership:
        db.add(
            CampaignMember(
                id=str(uuid.uuid4()),
                user_id=user.id,
                campaign_id=invite.campaign_id,
                role=invite.role,
            )
        )

    mark_accepted(db, invite, user.id)
    db.commit()

    return InviteAcceptResponse(campaign_id=invite.campaign_id)
