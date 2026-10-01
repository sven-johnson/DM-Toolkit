import uuid

import pytest
from argon2 import PasswordHasher
from fastapi.testclient import TestClient
from sqlalchemy.exc import IntegrityError

from app.models import User
from app.utils import normalize_email

_ph = PasswordHasher()


# ---------------------------------------------------------------------------
# normalize_email
# ---------------------------------------------------------------------------


def test_normalize_email_trims_and_lowercases():
    assert normalize_email("  Someone@Example.COM  ") == "someone@example.com"


def test_normalize_email_idempotent():
    once = normalize_email("  Someone@Example.COM  ")
    assert normalize_email(once) == once


# ---------------------------------------------------------------------------
# users.email model constraints
# ---------------------------------------------------------------------------


def test_insert_user_without_email_fails(db):
    db.add(
        User(
            id=str(uuid.uuid4()),
            username="noemail",
            hashed_password=_ph.hash("x"),
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()


def test_duplicate_email_differing_only_by_case_fails(db):
    db.add(
        User(
            id=str(uuid.uuid4()),
            username="first",
            email=normalize_email("Dup@Example.com"),
            hashed_password=_ph.hash("x"),
        )
    )
    db.commit()

    db.add(
        User(
            id=str(uuid.uuid4()),
            username="second",
            email=normalize_email("dup@EXAMPLE.com"),
            hashed_password=_ph.hash("x"),
        )
    )
    with pytest.raises(IntegrityError):
        db.commit()


# ---------------------------------------------------------------------------
# GET /auth/me
# ---------------------------------------------------------------------------


def test_get_me_includes_email(client: TestClient, auth_headers: dict):
    resp = client.get("/auth/me", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "testuser"
    assert body["email"] == "testuser@example.com"
    assert body["is_admin"] is True
    assert "id" in body


# ---------------------------------------------------------------------------
# PUT /auth/username
# ---------------------------------------------------------------------------


def test_update_username_success_returns_full_profile(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/username",
        json={"current_password": "testpass", "new_username": "renamed"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["username"] == "renamed"
    assert body["email"] == "testuser@example.com"
    assert body["is_admin"] is True
    assert "id" in body


def test_update_username_wrong_password(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/username",
        json={"current_password": "wrong", "new_username": "renamed"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Current password is incorrect"


def test_update_username_empty(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/username",
        json={"current_password": "testpass", "new_username": "   "},
        headers=auth_headers,
    )
    assert resp.status_code == 400


def test_update_username_conflict(client: TestClient, auth_headers: dict, db):
    db.add(
        User(
            id=str(uuid.uuid4()),
            username="taken",
            email="taken@example.com",
            hashed_password=_ph.hash("x"),
        )
    )
    db.commit()

    resp = client.put(
        "/auth/username",
        json={"current_password": "testpass", "new_username": "taken"},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "Username already taken"


def test_update_username_unauthenticated(client: TestClient):
    resp = client.put(
        "/auth/username",
        json={"current_password": "testpass", "new_username": "renamed"},
    )
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# PUT /auth/email
# ---------------------------------------------------------------------------


def test_update_email_success(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/email",
        json={"current_password": "testpass", "new_email": "new@example.com"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["email"] == "new@example.com"
    assert body["username"] == "testuser"


def test_update_email_normalizes(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/email",
        json={"current_password": "testpass", "new_email": "  New@Example.COM  "},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "new@example.com"


def test_update_email_unchanged_is_noop_success(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/email",
        json={"current_password": "testpass", "new_email": "testuser@example.com"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["email"] == "testuser@example.com"


def test_update_email_invalid_format(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/email",
        json={"current_password": "testpass", "new_email": "not-an-email"},
        headers=auth_headers,
    )
    assert resp.status_code == 422


def test_update_email_duplicate(client: TestClient, auth_headers: dict, db):
    db.add(
        User(
            id=str(uuid.uuid4()),
            username="other",
            email="taken@example.com",
            hashed_password=_ph.hash("x"),
        )
    )
    db.commit()

    resp = client.put(
        "/auth/email",
        json={"current_password": "testpass", "new_email": "taken@example.com"},
        headers=auth_headers,
    )
    assert resp.status_code == 409
    assert resp.json()["detail"] == "This email is already in use."


def test_update_email_duplicate_case_insensitive(client: TestClient, auth_headers: dict, db):
    db.add(
        User(
            id=str(uuid.uuid4()),
            username="other",
            email="taken@example.com",
            hashed_password=_ph.hash("x"),
        )
    )
    db.commit()

    resp = client.put(
        "/auth/email",
        json={"current_password": "testpass", "new_email": "TAKEN@Example.com"},
        headers=auth_headers,
    )
    assert resp.status_code == 409


def test_update_email_wrong_password(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/auth/email",
        json={"current_password": "wrong", "new_email": "new@example.com"},
        headers=auth_headers,
    )
    assert resp.status_code == 400
    assert resp.json()["detail"] == "Current password is incorrect"


def test_update_email_unauthenticated(client: TestClient):
    resp = client.put(
        "/auth/email",
        json={"current_password": "testpass", "new_email": "new@example.com"},
    )
    assert resp.status_code in (401, 403)


# ---------------------------------------------------------------------------
# Member-list responses never expose other users' emails
# ---------------------------------------------------------------------------


def test_campaign_member_list_does_not_expose_email(client: TestClient, auth_headers: dict, campaign_id: str, db):
    member_user = User(
        id=str(uuid.uuid4()),
        username="player1",
        email="player1@example.com",
        hashed_password=_ph.hash("x"),
    )
    db.add(member_user)
    db.commit()

    resp = client.put(
        f"/campaigns/{campaign_id}/members",
        json={"user_id": member_user.id, "role": "player"},
        headers=auth_headers,
    )
    assert resp.status_code == 201 or resp.status_code == 200

    resp = client.get(f"/campaigns/{campaign_id}/members", headers=auth_headers)
    assert resp.status_code == 200
    for member in resp.json():
        assert "email" not in member
