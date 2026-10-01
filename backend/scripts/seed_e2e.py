"""Reset the e2e test database to a known seeded state.

Run with DATABASE_URL pointed at the e2e MySQL instance (see
e2e/playwright.config.ts, which chains this into the backend
webServer's start command, after migrations and before uvicorn, so
every e2e run starts from this exact state). Drops and recreates all
tables from
the current SQLAlchemy models (equivalent to being at the latest
Alembic migration) rather than going through Alembic, since this is a
full reset, not an incremental upgrade.
"""

import os
import sys
import uuid

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from argon2 import PasswordHasher

from app.database import Base, _get_engine
from app.models import Campaign, CampaignMember, User
from app.utils import normalize_email

SEED_PASSWORD = "password123"


def main() -> None:
    engine, session_factory = _get_engine()
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)

    ph = PasswordHasher()
    db = session_factory()
    try:
        admin = User(
            id=str(uuid.uuid4()),
            username="e2e_admin",
            email=normalize_email("e2e_admin@example.com"),
            hashed_password=ph.hash(SEED_PASSWORD),
            is_admin=True,
        )
        gm = User(
            id=str(uuid.uuid4()),
            username="e2e_gm",
            email=normalize_email("e2e_gm@example.com"),
            hashed_password=ph.hash(SEED_PASSWORD),
            is_admin=False,
        )
        nonmember = User(
            id=str(uuid.uuid4()),
            username="e2e_nonmember",
            email=normalize_email("e2e_nonmember@example.com"),
            hashed_password=ph.hash(SEED_PASSWORD),
            is_admin=False,
        )
        nonmember2 = User(
            id=str(uuid.uuid4()),
            username="e2e_nonmember2",
            email=normalize_email("e2e_nonmember2@example.com"),
            hashed_password=ph.hash(SEED_PASSWORD),
            is_admin=False,
        )
        db.add_all([admin, gm, nonmember, nonmember2])
        db.flush()

        campaign = Campaign(id=str(uuid.uuid4()), name="E2E Campaign")
        db.add(campaign)
        db.flush()
        db.add(
            CampaignMember(
                id=str(uuid.uuid4()),
                user_id=gm.id,
                campaign_id=campaign.id,
                role="owner",
            )
        )
        db.commit()

        print(f"SEEDED campaign_id={campaign.id}")
    finally:
        db.close()


if __name__ == "__main__":
    main()
