"""Unit tests for get_campaign_rule_system helper.

Run from backend/ with:  pytest tests/test_rule_system_helper.py -v
"""
import os

os.environ.setdefault("DATABASE_URL", "sqlite:///:memory:")
os.environ.setdefault("AUTH_USERNAME", "testuser")
os.environ.setdefault("AUTH_PASSWORD", "testpass")
os.environ.setdefault("SECRET_KEY", "test-secret-key-minimum-32-characters-long!!")
os.environ.setdefault("ACCESS_TOKEN_EXPIRE_MINUTES", "30")

import uuid

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Campaign, RuleSystem
from app.rule_system_helpers import get_campaign_rule_system

_ENGINE = create_engine(
    "sqlite:///:memory:",
    connect_args={"check_same_thread": False},
    poolclass=StaticPool,
)


@event.listens_for(_ENGINE, "connect")
def _fk(dbapi_conn, _rec):
    dbapi_conn.cursor().execute("PRAGMA foreign_keys=ON")


_Session = sessionmaker(autocommit=False, autoflush=False, bind=_ENGINE)


@pytest.fixture(autouse=True)
def _reset():
    Base.metadata.create_all(bind=_ENGINE)
    yield
    Base.metadata.drop_all(bind=_ENGINE)


@pytest.fixture
def db():
    session = _Session()
    try:
        yield session
    finally:
        session.close()


def _seed_default_rs(db) -> RuleSystem:
    rs = RuleSystem(slug="dnd_5_5e", name="D&D 5.5e", version="2024", is_default=True)
    db.add(rs)
    db.commit()
    db.refresh(rs)
    return rs


def _make_campaign(db, rule_system_id=None) -> Campaign:
    c = Campaign(id=str(uuid.uuid4()), name="Test Campaign", rule_system_id=rule_system_id)
    db.add(c)
    db.commit()
    db.refresh(c)
    return c


# ── Test 1: returns default when campaign.rule_system_id is null ──────────────

def test_returns_default_when_campaign_has_no_rule_system(db):
    default_rs = _seed_default_rs(db)
    campaign = _make_campaign(db, rule_system_id=None)

    result = get_campaign_rule_system(campaign.id, db)

    assert result.id == default_rs.id
    assert result.slug == "dnd_5_5e"
    assert result.is_default is True


# ── Test 2: returns explicit rule system when set ─────────────────────────────

def test_returns_explicit_rule_system_when_set(db):
    _seed_default_rs(db)
    other_rs = RuleSystem(slug="custom_v1", name="Custom v1", version="1.0", is_default=False)
    db.add(other_rs)
    db.commit()
    db.refresh(other_rs)

    campaign = _make_campaign(db, rule_system_id=other_rs.id)

    result = get_campaign_rule_system(campaign.id, db)

    assert result.id == other_rs.id
    assert result.slug == "custom_v1"
