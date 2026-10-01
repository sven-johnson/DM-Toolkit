import uuid
from datetime import datetime, timedelta

from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from freezegun import freeze_time

from app.models import User

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


def _login(client: TestClient, username: str, password: str) -> dict:
    resp = client.post("/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _add_member(client: TestClient, auth_headers: dict, campaign_id: str, user_id: str, role: str) -> None:
    resp = client.put(
        f"/campaigns/{campaign_id}/members",
        json={"user_id": user_id, "role": role},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)


# ---------------------------------------------------------------------------
# Platform invites (no campaign_id)
# ---------------------------------------------------------------------------


def test_admin_platform_invite_201(client: TestClient, auth_headers: dict):
    resp = client.post("/api/invites", json={"email": "newgm@example.com"}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["email"] == "newgm@example.com"
    assert body["campaign_id"] is None
    assert body["role"] is None
    assert "id" in body
    assert "expires_at" in body


def test_non_admin_platform_invite_403(client: TestClient, db):
    _make_user(db, "regular", "regular@example.com")
    headers = _login(client, "regular", "pass1234")
    resp = client.post("/api/invites", json={"email": "x@example.com"}, headers=headers)
    assert resp.status_code == 403


def test_existing_user_platform_invite_409(client: TestClient, auth_headers: dict, db):
    _make_user(db, "already", "already@example.com")
    resp = client.post("/api/invites", json={"email": "already@example.com"}, headers=auth_headers)
    assert resp.status_code == 409
    assert resp.json()["detail"] == "A user with this email already exists."


def test_email_normalization(client: TestClient, auth_headers: dict):
    resp = client.post(
        "/api/invites", json={"email": "  NewGM@Example.COM  "}, headers=auth_headers
    )
    assert resp.status_code == 201
    assert resp.json()["email"] == "newgm@example.com"


def test_invalid_email_422(client: TestClient, auth_headers: dict):
    resp = client.post("/api/invites", json={"email": "not-an-email"}, headers=auth_headers)
    assert resp.status_code == 422


def test_unauthenticated_401(client: TestClient):
    resp = client.post("/api/invites", json={"email": "x@example.com"})
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Campaign invites
# ---------------------------------------------------------------------------


def test_gm_campaign_invite_201_with_role_player(client: TestClient, auth_headers: dict, db, campaign_id: str):
    gm = _make_user(db, "gm1", "gm1@example.com")
    _add_member(client, auth_headers, campaign_id, gm.id, "game_master")
    gm_headers = _login(client, "gm1", "pass1234")

    resp = client.post(
        "/api/invites", json={"email": "player@example.com", "campaign_id": campaign_id}, headers=gm_headers
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["role"] == "player"
    assert body["campaign_id"] == campaign_id


def test_owner_campaign_invite_201(client: TestClient, auth_headers: dict, db, campaign_id: str):
    owner = _make_user(db, "owner1", "owner1@example.com")
    _add_member(client, auth_headers, campaign_id, owner.id, "owner")
    owner_headers = _login(client, "owner1", "pass1234")

    resp = client.post(
        "/api/invites", json={"email": "player2@example.com", "campaign_id": campaign_id}, headers=owner_headers
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "player"


def test_player_of_campaign_403(client: TestClient, auth_headers: dict, db, campaign_id: str):
    player = _make_user(db, "player1", "player1@example.com")
    _add_member(client, auth_headers, campaign_id, player.id, "player")
    player_headers = _login(client, "player1", "pass1234")

    resp = client.post(
        "/api/invites", json={"email": "x@example.com", "campaign_id": campaign_id}, headers=player_headers
    )
    assert resp.status_code == 403


def test_gm_of_different_campaign_403(client: TestClient, auth_headers: dict, db, campaign_id: str):
    gm = _make_user(db, "gm2", "gm2@example.com")
    _add_member(client, auth_headers, campaign_id, gm.id, "game_master")
    gm_headers = _login(client, "gm2", "pass1234")

    other_campaign = client.post("/campaigns", json={"name": "Other Campaign"}, headers=auth_headers).json()

    resp = client.post(
        "/api/invites",
        json={"email": "x@example.com", "campaign_id": other_campaign["id"]},
        headers=gm_headers,
    )
    assert resp.status_code == 403


def test_admin_campaign_invite_for_any_campaign_201(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.post(
        "/api/invites", json={"email": "x@example.com", "campaign_id": campaign_id}, headers=auth_headers
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "player"


def test_nonexistent_campaign_404(client: TestClient, auth_headers: dict):
    resp = client.post(
        "/api/invites", json={"email": "x@example.com", "campaign_id": str(uuid.uuid4())}, headers=auth_headers
    )
    assert resp.status_code == 404


def test_existing_member_campaign_invite_409(client: TestClient, auth_headers: dict, db, campaign_id: str):
    member = _make_user(db, "member1", "member1@example.com")
    _add_member(client, auth_headers, campaign_id, member.id, "player")

    resp = client.post(
        "/api/invites",
        json={"email": "member1@example.com", "campaign_id": campaign_id},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "This user is already a member of this campaign."


def test_existing_non_member_user_campaign_invite_201(client: TestClient, auth_headers: dict, db, campaign_id: str):
    _make_user(db, "nonmember", "nonmember@example.com")

    resp = client.post(
        "/api/invites",
        json={"email": "nonmember@example.com", "campaign_id": campaign_id},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "player"


def test_client_supplied_role_is_ignored(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.post(
        "/api/invites",
        json={"email": "x@example.com", "campaign_id": campaign_id, "role": "owner"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["role"] == "player"


# ---------------------------------------------------------------------------
# Duplicate / expired pending invites
# ---------------------------------------------------------------------------


def test_duplicate_pending_invite_returns_same_id_200(client: TestClient, auth_headers: dict):
    first = client.post("/api/invites", json={"email": "dup@example.com"}, headers=auth_headers)
    assert first.status_code == 201

    second = client.post("/api/invites", json={"email": "dup@example.com"}, headers=auth_headers)
    assert second.status_code == 200
    assert second.json()["id"] == first.json()["id"]


def test_expired_prior_invite_creates_new(client: TestClient, auth_headers: dict):
    with freeze_time("2026-01-01 12:00:00"):
        first = client.post("/api/invites", json={"email": "expired@example.com"}, headers=auth_headers)
        assert first.status_code == 201

    with freeze_time("2026-01-01 12:00:00") as frozen:
        frozen.move_to(datetime(2026, 1, 1, 12, 0, 0) + timedelta(days=15))
        second = client.post("/api/invites", json={"email": "expired@example.com"}, headers=auth_headers)
        assert second.status_code == 201
        assert second.json()["id"] != first.json()["id"]
