from fastapi.testclient import TestClient


def test_login_success(client: TestClient):
    resp = client.post(
        "/auth/login", json={"username": "testuser", "password": "testpass"}
    )
    assert resp.status_code == 200
    body = resp.json()
    assert "access_token" in body
    assert body["token_type"] == "bearer"
    assert len(body["access_token"]) > 0


def test_login_wrong_username(client: TestClient):
    resp = client.post(
        "/auth/login", json={"username": "wrong", "password": "testpass"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


def test_login_wrong_password(client: TestClient):
    resp = client.post(
        "/auth/login", json={"username": "testuser", "password": "wrong"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid credentials"


def test_login_both_wrong(client: TestClient):
    resp = client.post("/auth/login", json={"username": "x", "password": "y"})
    assert resp.status_code == 401


def test_protected_endpoint_no_token(client: TestClient):
    resp = client.get("/sessions")
    assert resp.status_code in (401, 403)  # varies by FastAPI version


def test_protected_endpoint_invalid_token(client: TestClient):
    resp = client.get(
        "/sessions", headers={"Authorization": "Bearer this.is.not.valid"}
    )
    assert resp.status_code == 401
    assert resp.json()["detail"] == "Invalid token"


def test_protected_endpoint_malformed_header(client: TestClient):
    resp = client.get("/sessions", headers={"Authorization": "NotBearer abc"})
    assert resp.status_code in (401, 403)  # varies by FastAPI version
