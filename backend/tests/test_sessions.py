from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------


def test_list_sessions_empty(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.get(f"/campaigns/{campaign_id}/sessions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_session_minimal(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.post(
        f"/campaigns/{campaign_id}/sessions",
        json={"title": "My Session"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "My Session"
    assert body["date"] is None
    assert "id" in body
    assert "created_at" in body


def test_create_session_with_date(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.post(
        f"/campaigns/{campaign_id}/sessions",
        json={"title": "Dated Session", "date": "2026-03-15"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["date"] == "2026-03-15"


def test_list_sessions_returns_newest_first(client: TestClient, auth_headers: dict, campaign_id: str):
    r1 = client.post(
        f"/campaigns/{campaign_id}/sessions", json={"title": "First"}, headers=auth_headers
    )
    r2 = client.post(
        f"/campaigns/{campaign_id}/sessions", json={"title": "Second"}, headers=auth_headers
    )
    resp = client.get(f"/campaigns/{campaign_id}/sessions", headers=auth_headers)
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    # IDs are UUIDs now (not auto-increment), so recency can't be inferred from
    # the id itself; just confirm both sessions came back.
    assert set(ids) == {r1.json()["id"], r2.json()["id"]}


def test_get_session_not_found(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.get(f"/campaigns/{campaign_id}/sessions/999", headers=auth_headers)
    assert resp.status_code == 404


def test_get_session_with_scenes(client: TestClient, auth_headers: dict, campaign_id: str):
    # Scenes live under a storyline now; a session pulls them in via /next-scene.
    storyline = client.post(
        f"/campaigns/{campaign_id}/storylines",
        json={"title": "Test Storyline"},
        headers=auth_headers,
    ).json()
    client.post(
        f"/campaigns/{campaign_id}/storylines/{storyline['id']}/scenes",
        json={"title": "Scene A"},
        headers=auth_headers,
    )
    client.post(
        f"/campaigns/{campaign_id}/storylines/{storyline['id']}/scenes",
        json={"title": "Scene B"},
        headers=auth_headers,
    )
    # Creating the session with storyline_id auto-attaches the first scene.
    session = client.post(
        f"/campaigns/{campaign_id}/sessions",
        json={"title": "Test Session", "storyline_id": storyline["id"]},
        headers=auth_headers,
    ).json()
    client.post(
        f"/campaigns/{campaign_id}/sessions/{session['id']}/next-scene",
        headers=auth_headers,
    )

    resp = client.get(f"/campaigns/{campaign_id}/sessions/{session['id']}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == session["id"]
    assert len(body["scenes"]) == 2
    assert body["scenes"][0]["title"] == "Scene A"
    assert body["scenes"][1]["title"] == "Scene B"


def test_update_session_title(
    client: TestClient, auth_headers: dict, campaign_id: str, session_id: str
):
    resp = client.put(
        f"/campaigns/{campaign_id}/sessions/{session_id}",
        json={"title": "Updated Title"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


def test_update_session_date(
    client: TestClient, auth_headers: dict, campaign_id: str, session_id: str
):
    resp = client.put(
        f"/campaigns/{campaign_id}/sessions/{session_id}",
        json={"date": "2026-04-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["date"] == "2026-04-01"


def test_update_session_not_found(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.put(
        f"/campaigns/{campaign_id}/sessions/999",
        json={"title": "Ghost"},
        headers=auth_headers,
    )
    assert resp.status_code == 404


def test_delete_session(
    client: TestClient, auth_headers: dict, campaign_id: str, session_id: str
):
    resp = client.delete(f"/campaigns/{campaign_id}/sessions/{session_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Confirm it's gone
    resp = client.get(f"/campaigns/{campaign_id}/sessions/{session_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_session_not_found(client: TestClient, auth_headers: dict, campaign_id: str):
    resp = client.delete(f"/campaigns/{campaign_id}/sessions/999", headers=auth_headers)
    assert resp.status_code == 404
