import uuid
from datetime import datetime, timedelta

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from freezegun import freeze_time

from app.models import CampaignMember, User

_ph = PasswordHasher()


def _make_user(db, username, email, password="pass1234", is_admin=False) -> User:
    user = User(
        id=str(uuid.uuid4()),
        username=username,
        email=email,
        hashed_password=_ph.hash(password),
        is_admin=is_admin,
    )
    db.add(user)
    db.commit()
    return user


def _create_platform_invite(client: TestClient, auth_headers: dict, email: str) -> dict:
    resp = client.post("/api/invites", json={"email": email}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


def _create_campaign_invite(client: TestClient, auth_headers: dict, campaign_id: str, email: str) -> dict:
    resp = client.post("/api/invites", json={"email": email, "campaign_id": campaign_id}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


# ---------------------------------------------------------------------------
# GET /api/invites/{id}
# ---------------------------------------------------------------------------


def test_get_invite_non_guid_404(client: TestClient):
    resp = client.get("/api/invites/not-a-guid")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


def test_get_invite_unknown_guid_404(client: TestClient):
    resp = client.get(f"/api/invites/{uuid.uuid4()}")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


def test_get_invite_expired_404(client: TestClient, auth_headers: dict):
    with freeze_time("2026-01-01 12:00:00"):
        invite = _create_platform_invite(client, auth_headers, "expiring@example.com")

    with freeze_time("2026-01-01 12:00:00") as frozen:
        frozen.move_to(datetime(2026, 1, 1, 12, 0, 0) + timedelta(days=15))
        resp = client.get(f"/api/invites/{invite['id']}")
        assert resp.status_code == 404
        assert resp.json() == {"detail": "invalid_invite"}


def test_get_invite_already_accepted_404(client: TestClient, auth_headers: dict, db):
    invite = _create_platform_invite(client, auth_headers, "accepted@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "accepted@example.com",
            "username": "accepteduser",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 201

    resp = client.get(f"/api/invites/{invite['id']}")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


def test_get_invite_platform_mode_register(client: TestClient, auth_headers: dict):
    invite = _create_platform_invite(client, auth_headers, "newgm@example.com")
    resp = client.get(f"/api/invites/{invite['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body == {"mode": "register", "email": "newgm@example.com", "campaign_name": None}


def test_get_invite_campaign_new_email_mode_register_with_campaign_name(
    client: TestClient, auth_headers: dict, campaign_id: str
):
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "newplayer@example.com")
    resp = client.get(f"/api/invites/{invite['id']}")
    assert resp.status_code == 200
    body = resp.json()
    assert body["mode"] == "register"
    assert body["email"] == "newplayer@example.com"
    assert body["campaign_name"] == "Test Campaign"


def test_get_invite_campaign_existing_email_mode_join(client: TestClient, auth_headers: dict, db, campaign_id: str):
    _make_user(db, "existing1", "existing1@example.com")
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "existing1@example.com")
    resp = client.get(f"/api/invites/{invite['id']}")
    assert resp.status_code == 200
    assert resp.json()["mode"] == "join"


def test_get_invite_platform_invite_for_now_existing_email_404(client: TestClient, auth_headers: dict, db):
    invite = _create_platform_invite(client, auth_headers, "becameuser@example.com")
    _make_user(db, "becameuser", "becameuser@example.com")
    resp = client.get(f"/api/invites/{invite['id']}")
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


# ---------------------------------------------------------------------------
# POST /api/invites/{id}/register
# ---------------------------------------------------------------------------


def test_register_platform_happy_path_no_memberships_and_logs_in(client: TestClient, auth_headers: dict, db):
    invite = _create_platform_invite(client, auth_headers, "newgm2@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "newgm2@example.com",
            "username": "newgm2",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 201
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"

    user = db.query(User).filter(User.username == "newgm2").first()
    assert user is not None
    assert user.is_admin is False
    assert db.query(CampaignMember).filter(CampaignMember.user_id == user.id).count() == 0


def test_register_campaign_happy_path_creates_player_membership(
    client: TestClient, auth_headers: dict, db, campaign_id: str
):
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "newplayer2@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "newplayer2@example.com",
            "username": "newplayer2",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 201

    user = db.query(User).filter(User.username == "newplayer2").first()
    membership = db.query(CampaignMember).filter(CampaignMember.user_id == user.id).first()
    assert membership is not None
    assert membership.campaign_id == campaign_id
    assert membership.role == "player"


def test_register_submitted_email_differs_from_invite_email(client: TestClient, auth_headers: dict, db):
    invite = _create_platform_invite(client, auth_headers, "invite-target@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "different-choice@example.com",
            "username": "chooseremail",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 201
    user = db.query(User).filter(User.username == "chooseremail").first()
    assert user.email == "different-choice@example.com"


def test_register_submitted_email_normalized(client: TestClient, auth_headers: dict, db):
    invite = _create_platform_invite(client, auth_headers, "norm-target@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "  Normalized@Example.COM  ",
            "username": "normuser",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 201
    user = db.query(User).filter(User.username == "normuser").first()
    assert user.email == "normalized@example.com"


def test_register_submitted_email_already_in_use_409(client: TestClient, auth_headers: dict, db):
    _make_user(db, "taken", "taken@example.com")
    invite = _create_platform_invite(client, auth_headers, "freshtarget@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "taken@example.com",
            "username": "newusername",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "This email is already in use."


def test_register_invalid_email_format_422(client: TestClient, auth_headers: dict):
    invite = _create_platform_invite(client, auth_headers, "fmt@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "not-an-email",
            "username": "fmtuser",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 422


def test_register_username_taken_409(client: TestClient, auth_headers: dict, db):
    _make_user(db, "takenname", "takenname@example.com")
    invite = _create_platform_invite(client, auth_headers, "newperson@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "newperson@example.com",
            "username": "takenname",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Username is already taken."


def test_register_invalid_username_format_422(client: TestClient, auth_headers: dict):
    invite = _create_platform_invite(client, auth_headers, "badname@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "badname@example.com",
            "username": "a",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 422


def test_register_password_mismatch_422(client: TestClient, auth_headers: dict):
    invite = _create_platform_invite(client, auth_headers, "mismatch@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "mismatch@example.com",
            "username": "mismatchuser",
            "password": "password123",
            "confirm_password": "different456",
        },
    )
    assert resp.status_code == 422


def test_register_short_password_422(client: TestClient, auth_headers: dict):
    invite = _create_platform_invite(client, auth_headers, "shortpw@example.com")
    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "shortpw@example.com",
            "username": "shortpwuser",
            "password": "short1",
            "confirm_password": "short1",
        },
    )
    assert resp.status_code == 422


def test_register_invalid_invite_404(client: TestClient):
    resp = client.post(
        f"/api/invites/{uuid.uuid4()}/register",
        json={
            "email": "x@example.com",
            "username": "xuser",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


def test_register_reused_invite_404(client: TestClient, auth_headers: dict):
    invite = _create_platform_invite(client, auth_headers, "reused@example.com")
    payload = {
        "email": "reused@example.com",
        "username": "reuseduser",
        "password": "password123",
        "confirm_password": "password123",
    }
    first = client.post(f"/api/invites/{invite['id']}/register", json=payload)
    assert first.status_code == 201

    second = client.post(
        f"/api/invites/{invite['id']}/register",
        json={**payload, "username": "reuseduser2", "email": "reused2@example.com"},
    )
    assert second.status_code == 404
    assert second.json() == {"detail": "invalid_invite"}


def test_register_join_mode_invite_404(client: TestClient, auth_headers: dict, db, campaign_id: str):
    _make_user(db, "alreadyhasaccount", "alreadyhasaccount@example.com")
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "alreadyhasaccount@example.com")

    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "alreadyhasaccount@example.com",
            "username": "shouldnotwork",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


def test_register_membership_insert_failure_rolls_back_user(
    client: TestClient, auth_headers: dict, db, campaign_id: str, monkeypatch
):
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "rollback@example.com")

    import app.routers.invites as invites_module

    def _boom(*args, **kwargs):
        raise RuntimeError("simulated membership insert failure")

    monkeypatch.setattr(invites_module, "CampaignMember", _boom)

    with pytest.raises(RuntimeError):
        client.post(
            f"/api/invites/{invite['id']}/register",
            json={
                "email": "rollback@example.com",
                "username": "rollbackuser",
                "password": "password123",
                "confirm_password": "password123",
            },
        )

    assert db.query(User).filter(User.email == "rollback@example.com").first() is None


def test_register_mark_accepted_race_rolls_back_and_404s(
    client: TestClient, auth_headers: dict, db, monkeypatch
):
    """Covers the TOCTOU guard: get_valid_invite passes, but mark_accepted's
    conditional UPDATE loses the race (another request accepted it first)."""
    invite = _create_platform_invite(client, auth_headers, "race@example.com")

    import app.routers.invites as invites_module
    from app.invites_service import InviteAlreadyUsed

    def _boom(*args, **kwargs):
        raise InviteAlreadyUsed()

    monkeypatch.setattr(invites_module, "mark_accepted", _boom)

    resp = client.post(
        f"/api/invites/{invite['id']}/register",
        json={
            "email": "race@example.com",
            "username": "raceuser",
            "password": "password123",
            "confirm_password": "password123",
        },
    )
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}
    assert db.query(User).filter(User.username == "raceuser").first() is None


def test_register_concurrent_submit_simulation_leaves_exactly_one_user(client: TestClient, auth_headers: dict, db):
    invite = _create_platform_invite(client, auth_headers, "racer@example.com")
    payload = {
        "email": "racer@example.com",
        "username": "racer1",
        "password": "password123",
        "confirm_password": "password123",
    }

    first = client.post(f"/api/invites/{invite['id']}/register", json=payload)
    second = client.post(
        f"/api/invites/{invite['id']}/register",
        json={**payload, "username": "racer2", "email": "racer2@example.com"},
    )

    assert first.status_code == 201
    assert second.status_code == 404
    assert db.query(User).filter(User.email.in_(["racer@example.com", "racer2@example.com"])).count() == 1
