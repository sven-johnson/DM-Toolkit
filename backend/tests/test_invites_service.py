import uuid
from datetime import datetime, timedelta

import pytest
from argon2 import PasswordHasher
from freezegun import freeze_time
from sqlalchemy.exc import IntegrityError

from app.invites_service import (
    INVITE_TTL_DAYS,
    InviteAlreadyUsed,
    create_invite,
    get_valid_invite,
    mark_accepted,
)
from app.models import Campaign, Invite, User

_ph = PasswordHasher()


def _make_user(db, *, username="inviter", email="inviter@example.com") -> User:
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        email=email,
        hashed_password=_ph.hash("x"),
    )
    db.add(user)
    db.commit()
    return user


def _make_campaign(db, name="Test Campaign") -> Campaign:
    campaign = Campaign(id=str(uuid.uuid4()), name=name)
    db.add(campaign)
    db.commit()
    return campaign


# ---------------------------------------------------------------------------
# CHECK constraint
# ---------------------------------------------------------------------------


def test_campaign_without_role_rejected(db):
    inviter = _make_user(db)
    campaign = _make_campaign(db)
    db.add(
        Invite(
            id=str(uuid.uuid4()),
            email="x@example.com",
            campaign_id=campaign.id,
            role=None,
            invited_by_user_id=inviter.id,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=1),
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_role_without_campaign_rejected(db):
    inviter = _make_user(db)
    db.add(
        Invite(
            id=str(uuid.uuid4()),
            email="x@example.com",
            campaign_id=None,
            role="player",
            invited_by_user_id=inviter.id,
            created_at=datetime.utcnow(),
            expires_at=datetime.utcnow() + timedelta(days=1),
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_platform_invite_no_campaign_no_role_allowed(db):
    inviter = _make_user(db)
    invite = Invite(
        id=str(uuid.uuid4()),
        email="x@example.com",
        campaign_id=None,
        role=None,
        invited_by_user_id=inviter.id,
        created_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=1),
    )
    db.add(invite)
    db.commit()
    assert invite.id is not None


# ---------------------------------------------------------------------------
# create_invite
# ---------------------------------------------------------------------------


def test_create_invite_sets_uuid_normalized_email_and_expiry(db):
    inviter = _make_user(db)
    with freeze_time("2026-01-01 12:00:00"):
        invite = create_invite(db, email="  Someone@Example.COM  ", inviter=inviter)

    uuid.UUID(invite.id)  # does not raise
    assert invite.email == "someone@example.com"
    assert invite.campaign_id is None
    assert invite.role is None
    assert invite.created_at == datetime(2026, 1, 1, 12, 0, 0)
    assert invite.expires_at == datetime(2026, 1, 1, 12, 0, 0) + timedelta(days=INVITE_TTL_DAYS)


def test_create_invite_with_campaign_and_role(db):
    inviter = _make_user(db)
    campaign = _make_campaign(db)
    invite = create_invite(db, email="x@example.com", inviter=inviter, campaign_id=campaign.id, role="player")
    assert invite.campaign_id == campaign.id
    assert invite.role == "player"


# ---------------------------------------------------------------------------
# get_valid_invite
# ---------------------------------------------------------------------------


def test_get_valid_invite_returns_none_for_non_guid(db):
    assert get_valid_invite(db, "not-a-guid") is None


def test_get_valid_invite_returns_none_for_unknown_guid(db):
    assert get_valid_invite(db, str(uuid.uuid4())) is None


def test_get_valid_invite_returns_none_when_expired(db):
    inviter = _make_user(db)
    with freeze_time("2026-01-01 12:00:00"):
        invite = create_invite(db, email="x@example.com", inviter=inviter)

    with freeze_time("2026-01-01 12:00:00") as frozen:
        frozen.move_to(datetime(2026, 1, 1, 12, 0, 0) + timedelta(days=INVITE_TTL_DAYS, seconds=1))
        assert get_valid_invite(db, invite.id) is None


def test_get_valid_invite_returns_none_when_accepted(db):
    inviter = _make_user(db)
    invitee = _make_user(db, username="invitee", email="invitee@example.com")
    invite = create_invite(db, email="invitee@example.com", inviter=inviter)
    mark_accepted(db, invite, invitee.id)
    assert get_valid_invite(db, invite.id) is None


def test_get_valid_invite_returns_the_invite_when_valid(db):
    inviter = _make_user(db)
    invite = create_invite(db, email="x@example.com", inviter=inviter)
    found = get_valid_invite(db, invite.id)
    assert found is not None
    assert found.id == invite.id


# ---------------------------------------------------------------------------
# mark_accepted
# ---------------------------------------------------------------------------


def test_mark_accepted_succeeds_once(db):
    inviter = _make_user(db)
    invitee = _make_user(db, username="invitee", email="invitee@example.com")
    invite = create_invite(db, email="invitee@example.com", inviter=inviter)

    mark_accepted(db, invite, invitee.id)
    assert invite.accepted_at is not None
    assert invite.accepted_by_user_id == invitee.id


def test_mark_accepted_twice_raises(db):
    inviter = _make_user(db)
    invitee = _make_user(db, username="invitee", email="invitee@example.com")
    invite = create_invite(db, email="invitee@example.com", inviter=inviter)

    mark_accepted(db, invite, invitee.id)
    with pytest.raises(InviteAlreadyUsed):
        mark_accepted(db, invite, invitee.id)


# ---------------------------------------------------------------------------
# Cascades
# ---------------------------------------------------------------------------


def test_deleting_campaign_cascades_its_invites(db):
    inviter = _make_user(db)
    campaign = _make_campaign(db)
    invite = create_invite(db, email="x@example.com", inviter=inviter, campaign_id=campaign.id, role="player")
    invite_id = invite.id  # capture before commit expires the instance

    db.delete(campaign)
    db.commit()

    assert db.query(Invite).filter(Invite.id == invite_id).first() is None
