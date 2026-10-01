import os
import uuid
from datetime import datetime, timedelta

from sqlalchemy.orm import Session as DBSession

from .models import Invite, User
from .utils import normalize_email

INVITE_TTL_DAYS = int(os.getenv("INVITE_TTL_DAYS", "14"))


class InviteAlreadyUsed(Exception):
    pass


def create_invite(
    db: DBSession,
    *,
    email: str,
    inviter: User,
    campaign_id: str | None = None,
    role: str | None = None,
) -> Invite:
    now = datetime.utcnow()
    invite = Invite(
        id=str(uuid.uuid4()),
        email=normalize_email(email),
        campaign_id=campaign_id,
        role=role,
        invited_by_user_id=inviter.id,
        created_at=now,
        expires_at=now + timedelta(days=INVITE_TTL_DAYS),
    )
    db.add(invite)
    db.commit()
    db.refresh(invite)
    return invite


def get_valid_invite(db: DBSession, invite_id: str) -> Invite | None:
    try:
        uuid.UUID(str(invite_id))
    except (ValueError, AttributeError, TypeError):
        return None

    invite = db.query(Invite).filter(Invite.id == invite_id).first()
    if not invite:
        return None
    if invite.accepted_at is not None:
        return None
    if invite.expires_at <= datetime.utcnow():
        return None
    return invite


def mark_accepted(db: DBSession, invite: Invite, user_id: str) -> None:
    result = db.execute(
        Invite.__table__.update()
        .where(Invite.id == invite.id, Invite.accepted_at.is_(None))
        .values(accepted_at=datetime.utcnow(), accepted_by_user_id=user_id)
    )
    if result.rowcount == 0:
        raise InviteAlreadyUsed()
    db.refresh(invite)
