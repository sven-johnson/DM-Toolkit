from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Session CRUD
# ---------------------------------------------------------------------------


def test_list_sessions_empty(client: TestClient, auth_headers: dict):
    resp = client.get("/sessions", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json() == []


def test_create_session_minimal(client: TestClient, auth_headers: dict):
    resp = client.post("/sessions", json={"title": "My Session"}, headers=auth_headers)
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "My Session"
    assert body["date"] is None
    assert "id" in body
    assert "created_at" in body


def test_create_session_with_date(client: TestClient, auth_headers: dict):
    resp = client.post(
        "/sessions",
        json={"title": "Dated Session", "date": "2026-03-15"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["date"] == "2026-03-15"


def test_list_sessions_returns_newest_first(client: TestClient, auth_headers: dict):
    r1 = client.post("/sessions", json={"title": "First"}, headers=auth_headers)
    r2 = client.post("/sessions", json={"title": "Second"}, headers=auth_headers)
    resp = client.get("/sessions", headers=auth_headers)
    assert resp.status_code == 200
    ids = [s["id"] for s in resp.json()]
    # Higher ID (Second) should appear before lower ID (First)
    assert ids.index(r2.json()["id"]) < ids.index(r1.json()["id"])


def test_get_session_not_found(client: TestClient, auth_headers: dict):
    resp = client.get("/sessions/999", headers=auth_headers)
    assert resp.status_code == 404


def test_get_session_with_scenes(
    client: TestClient, auth_headers: dict, session_id: int
):
    # Add two scenes
    client.post(
        f"/sessions/{session_id}/scenes",
        json={"title": "Scene A"},
        headers=auth_headers,
    )
    client.post(
        f"/sessions/{session_id}/scenes",
        json={"title": "Scene B"},
        headers=auth_headers,
    )

    resp = client.get(f"/sessions/{session_id}", headers=auth_headers)
    assert resp.status_code == 200
    body = resp.json()
    assert body["id"] == session_id
    assert len(body["scenes"]) == 2
    assert body["scenes"][0]["title"] == "Scene A"
    assert body["scenes"][1]["title"] == "Scene B"


def test_update_session_title(
    client: TestClient, auth_headers: dict, session_id: int
):
    resp = client.put(
        f"/sessions/{session_id}",
        json={"title": "Updated Title"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated Title"


def test_update_session_date(client: TestClient, auth_headers: dict, session_id: int):
    resp = client.put(
        f"/sessions/{session_id}",
        json={"date": "2026-04-01"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    assert resp.json()["date"] == "2026-04-01"


def test_update_session_not_found(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/sessions/999", json={"title": "Ghost"}, headers=auth_headers
    )
    assert resp.status_code == 404


def test_delete_session(client: TestClient, auth_headers: dict, session_id: int):
    resp = client.delete(f"/sessions/{session_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Confirm it's gone
    resp = client.get(f"/sessions/{session_id}", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_session_not_found(client: TestClient, auth_headers: dict):
    resp = client.delete("/sessions/999", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_session_cascades_scenes(
    client: TestClient, auth_headers: dict, session_id: int, scene_id: int
):
    # Scene exists
    resp = client.get(f"/sessions/{session_id}", headers=auth_headers)
    assert len(resp.json()["scenes"]) == 1

    # Delete the session
    client.delete(f"/sessions/{session_id}", headers=auth_headers)

    # Scene endpoint should 404 now
    resp = client.put(
        f"/scenes/{scene_id}", json={"title": "Ghost"}, headers=auth_headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Scene creation within a session
# ---------------------------------------------------------------------------


def test_create_scene(client: TestClient, auth_headers: dict, session_id: int):
    resp = client.post(
        f"/sessions/{session_id}/scenes",
        json={"title": "Opening Scene", "body": "It was a dark night."},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    body = resp.json()
    assert body["title"] == "Opening Scene"
    assert body["body"] == "It was a dark night."
    assert body["session_id"] == session_id
    assert body["order_index"] == 0


def test_create_scene_default_body(client: TestClient, auth_headers: dict, session_id: int):
    resp = client.post(
        f"/sessions/{session_id}/scenes",
        json={"title": "Empty Scene"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    assert resp.json()["body"] == ""


def test_create_scene_increments_order_index(
    client: TestClient, auth_headers: dict, session_id: int
):
    for i in range(3):
        resp = client.post(
            f"/sessions/{session_id}/scenes",
            json={"title": f"Scene {i}"},
            headers=auth_headers,
        )
        assert resp.json()["order_index"] == i


def test_create_scene_session_not_found(client: TestClient, auth_headers: dict):
    resp = client.post(
        "/sessions/999/scenes", json={"title": "Orphan"}, headers=auth_headers
    )
    assert resp.status_code == 404


# ---------------------------------------------------------------------------
# Reorder scenes
# ---------------------------------------------------------------------------


def test_reorder_scenes(client: TestClient, auth_headers: dict, session_id: int):
    # Create three scenes
    ids = []
    for title in ["A", "B", "C"]:
        resp = client.post(
            f"/sessions/{session_id}/scenes",
            json={"title": title},
            headers=auth_headers,
        )
        ids.append(resp.json()["id"])

    # Reverse the order
    reversed_ids = list(reversed(ids))
    resp = client.put(
        f"/sessions/{session_id}/scenes/reorder",
        json={"scene_ids": reversed_ids},
        headers=auth_headers,
    )
    assert resp.status_code == 204

    # Verify new order via GET
    resp = client.get(f"/sessions/{session_id}", headers=auth_headers)
    scenes = resp.json()["scenes"]
    assert [s["id"] for s in scenes] == reversed_ids


def test_reorder_scenes_partial_ids_ignored(
    client: TestClient, auth_headers: dict, session_id: int
):
    ids = []
    for title in ["X", "Y"]:
        resp = client.post(
            f"/sessions/{session_id}/scenes",
            json={"title": title},
            headers=auth_headers,
        )
        ids.append(resp.json()["id"])

    # Include a foreign id — should be silently ignored
    resp = client.put(
        f"/sessions/{session_id}/scenes/reorder",
        json={"scene_ids": [ids[1], ids[0], 99999]},
        headers=auth_headers,
    )
    assert resp.status_code == 204
