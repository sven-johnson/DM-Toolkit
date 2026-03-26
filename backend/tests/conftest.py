import os

# Must be set before any app module is imported, because they read from
# os.environ at module load time (and load_dotenv won't override existing vars).
os.environ["DATABASE_URL"] = "sqlite:///:memory:"
os.environ["AUTH_USERNAME"] = "testuser"
os.environ["AUTH_PASSWORD"] = "testpass"
os.environ["SECRET_KEY"] = "test-secret-key-minimum-32-characters-long!!"
os.environ["ACCESS_TOKEN_EXPIRE_MINUTES"] = "30"

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base, get_db
from app.main import app

# ---------------------------------------------------------------------------
# In-memory SQLite engine for tests
# ---------------------------------------------------------------------------

TEST_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(TEST_ENGINE, "connect")
def _enable_foreign_keys(dbapi_conn, _record):
    cursor = dbapi_conn.cursor()
    cursor.execute("PRAGMA foreign_keys=ON")
    cursor.close()


TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=TEST_ENGINE)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


@pytest.fixture(autouse=True)
def reset_db():
    """Create tables before each test and drop them after."""
    Base.metadata.create_all(bind=TEST_ENGINE)
    yield
    Base.metadata.drop_all(bind=TEST_ENGINE)


@pytest.fixture
def client() -> TestClient:
    with TestClient(app) as c:
        yield c


@pytest.fixture
def auth_headers(client: TestClient) -> dict:
    resp = client.post(
        "/auth/login", json={"username": "testuser", "password": "testpass"}
    )
    assert resp.status_code == 200
    token = resp.json()["access_token"]
    return {"Authorization": f"Bearer {token}"}


@pytest.fixture
def session_id(client: TestClient, auth_headers: dict) -> int:
    resp = client.post(
        "/sessions", json={"title": "Test Session"}, headers=auth_headers
    )
    assert resp.status_code == 201
    return resp.json()["id"]


@pytest.fixture
def scene_id(client: TestClient, auth_headers: dict, session_id: int) -> int:
    resp = client.post(
        f"/sessions/{session_id}/scenes",
        json={"title": "Test Scene", "body": "Test body"},
        headers=auth_headers,
    )
    assert resp.status_code == 201
    return resp.json()["id"]
