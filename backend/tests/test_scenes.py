from fastapi.testclient import TestClient


def test_update_scene_title(
    client: TestClient, auth_headers: dict, scene_id: int
):
    resp = client.put(
        f"/scenes/{scene_id}",
        json={"title": "New Title"},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "New Title"
    assert body["body"] == "Test body"  # unchanged


def test_update_scene_body(
    client: TestClient, auth_headers: dict, scene_id: int
):
    resp = client.put(
        f"/scenes/{scene_id}",
        json={"body": "# Updated\n\nNew content here."},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["body"] == "# Updated\n\nNew content here."
    assert body["title"] == "Test Scene"  # unchanged


def test_update_scene_title_and_body(
    client: TestClient, auth_headers: dict, scene_id: int
):
    resp = client.put(
        f"/scenes/{scene_id}",
        json={"title": "Both Updated", "body": "Both fields."},
        headers=auth_headers,
    )
    assert resp.status_code == 200
    body = resp.json()
    assert body["title"] == "Both Updated"
    assert body["body"] == "Both fields."


def test_update_scene_not_found(client: TestClient, auth_headers: dict):
    resp = client.put(
        "/scenes/999", json={"title": "Ghost"}, headers=auth_headers
    )
    assert resp.status_code == 404


def test_update_scene_returns_full_schema(
    client: TestClient, auth_headers: dict, scene_id: int
):
    resp = client.put(
        f"/scenes/{scene_id}", json={"title": "Check Schema"}, headers=auth_headers
    )
    assert resp.status_code == 200
    body = resp.json()
    for field in ("id", "session_id", "title", "body", "order_index", "created_at", "updated_at"):
        assert field in body, f"Missing field: {field}"


def test_delete_scene(
    client: TestClient, auth_headers: dict, session_id: int, scene_id: int
):
    resp = client.delete(f"/scenes/{scene_id}", headers=auth_headers)
    assert resp.status_code == 204

    # Scene should be gone from the session
    resp = client.get(f"/sessions/{session_id}", headers=auth_headers)
    assert len(resp.json()["scenes"]) == 0


def test_delete_scene_not_found(client: TestClient, auth_headers: dict):
    resp = client.delete("/scenes/999", headers=auth_headers)
    assert resp.status_code == 404


def test_delete_scene_does_not_delete_session(
    client: TestClient, auth_headers: dict, session_id: int, scene_id: int
):
    client.delete(f"/scenes/{scene_id}", headers=auth_headers)

    # Session still exists
    resp = client.get(f"/sessions/{session_id}", headers=auth_headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == session_id
