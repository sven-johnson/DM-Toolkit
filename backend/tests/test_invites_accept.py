import uuid

from argon2 import PasswordHasher
from fastapi.testclient import TestClient

from app.models import CampaignMember, User

_ph = PasswordHasher()


def _make_user(db, username, email, password="pass1234") -> User:
    user = User(id=str(uuid.uuid4()), username=username, email=email, hashed_password=_ph.hash(password))
    db.add(user)
    db.commit()
    return user


def _login(client: TestClient, username: str, password: str) -> dict:
    resp = client.post("/auth/login", json={"username": username, "password": password})
    assert resp.status_code == 200
    return {"Authorization": f"Bearer {resp.json()['access_token']}"}


def _create_campaign_invite(client: TestClient, auth_headers: dict, campaign_id: str, email: str) -> dict:
    resp = client.post("/api/invites", json={"email": email, "campaign_id": campaign_id}, headers=auth_headers)
    assert resp.status_code == 201
    return resp.json()


def test_accept_happy_path(client: TestClient, auth_headers: dict, db, campaign_id: str):
    invitee = _make_user(db, "invitee1", "invitee1@example.com")
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "invitee1@example.com")
    invitee_headers = _login(client, "invitee1", "pass1234")

    resp = client.post(f"/api/invites/{invite['id']}/accept", headers=invitee_headers)
    assert resp.status_code == 200
    assert resp.json() == {"campaign_id": campaign_id}

    membership = (
        db.query(CampaignMember)
        .filter(CampaignMember.user_id == invitee.id, CampaignMember.campaign_id == campaign_id)
        .first()
    )
    assert membership is not None
    assert membership.role == "player"


def test_accept_unauthenticated_401(client: TestClient, auth_headers: dict, campaign_id: str):
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "x@example.com")
    resp = client.post(f"/api/invites/{invite['id']}/accept")
    assert resp.status_code in (401, 403)


def test_accept_wrong_account_403(client: TestClient, auth_headers: dict, db, campaign_id: str):
    # The invited email must already have an account for the invite to be in
    # "join" mode — otherwise accept() 404s before it even reaches the
    # email-match check (covered by test_accept_platform_invite_404-style logic
    # for "register" mode; here we specifically want "join" mode, wrong user).
    _make_user(db, "intendeduser", "intended@example.com")
    _make_user(db, "wronguser", "wronguser@example.com")
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "intended@example.com")
    wrong_headers = _login(client, "wronguser", "pass1234")

    resp = client.post(f"/api/invites/{invite['id']}/accept", headers=wrong_headers)
    assert resp.status_code == 403
    assert resp.json()["detail"] == "This invitation was sent to a different account."


def test_accept_invalid_invite_404(client: TestClient, auth_headers: dict):
    resp = client.post(f"/api/invites/{uuid.uuid4()}/accept", headers=auth_headers)
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


def test_accept_platform_invite_404(client: TestClient, auth_headers: dict, db):
    # Platform invites have no campaign_id, so accept() must reject them
    # outright regardless of mode.
    resp = client.post("/api/invites", json={"email": "platformtarget@example.com"}, headers=auth_headers)
    assert resp.status_code == 201
    invite = resp.json()

    _make_user(db, "someoneelse", "someoneelse@example.com")
    headers = _login(client, "someoneelse", "pass1234")
    resp = client.post(f"/api/invites/{invite['id']}/accept", headers=headers)
    assert resp.status_code == 404
    assert resp.json() == {"detail": "invalid_invite"}


def test_accept_already_member_idempotent_200(client: TestClient, auth_headers: dict, db, campaign_id: str):
    invitee = _make_user(db, "invitee2", "invitee2@example.com")
    # Create the invite first (invitee2 isn't a member yet, so this succeeds —
    # create_invite would 409 on an existing member). Then simulate invitee2
    # joining through another path before they get around to accepting.
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "invitee2@example.com")
    resp = client.put(
        f"/campaigns/{campaign_id}/members",
        json={"user_id": invitee.id, "role": "player"},
        headers=auth_headers,
    )
    assert resp.status_code in (200, 201)

    invitee_headers = _login(client, "invitee2", "pass1234")

    resp = client.post(f"/api/invites/{invite['id']}/accept", headers=invitee_headers)
    assert resp.status_code == 200
    assert resp.json() == {"campaign_id": campaign_id}

    count = (
        db.query(CampaignMember)
        .filter(CampaignMember.user_id == invitee.id, CampaignMember.campaign_id == campaign_id)
        .count()
    )
    assert count == 1


def test_accept_second_time_404(client: TestClient, auth_headers: dict, db, campaign_id: str):
    _make_user(db, "invitee3", "invitee3@example.com")
    invite = _create_campaign_invite(client, auth_headers, campaign_id, "invitee3@example.com")
    invitee_headers = _login(client, "invitee3", "pass1234")

    first = client.post(f"/api/invites/{invite['id']}/accept", headers=invitee_headers)
    assert first.status_code == 200

    second = client.post(f"/api/invites/{invite['id']}/accept", headers=invitee_headers)
    assert second.status_code == 404
    assert second.json() == {"detail": "invalid_invite"}
