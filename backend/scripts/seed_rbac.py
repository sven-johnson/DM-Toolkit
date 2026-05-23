"""
One-time script: set the campaign owner and admin flag for the primary user.

Run from the backend/ directory:
    python -m scripts.seed_rbac

Works on both local and production by detecting which user ID exists in the DB.
"""
import sys
import uuid
from pathlib import Path

# Make sure backend/app is importable
sys.path.insert(0, str(Path(__file__).parent.parent))

from dotenv import load_dotenv
load_dotenv(Path(__file__).parent.parent / ".env")

from app.database import get_db  # noqa: E402
from app.models import Campaign, CampaignMember, User  # noqa: E402

LOCAL_USER_ID = "40e087ce-4988-11f1-aac2-c22aa659348f"
PROD_USER_ID = "0106671b-498a-11f1-a2dd-a2aa7a18203d"

db = next(get_db())

try:
    # Find whichever user ID exists in this environment
    user = db.query(User).filter(
        User.id.in_([LOCAL_USER_ID, PROD_USER_ID])
    ).first()

    if not user:
        print("ERROR: Neither user ID was found in this database.")
        print(f"  Local  ID: {LOCAL_USER_ID}")
        print(f"  Prod   ID: {PROD_USER_ID}")
        sys.exit(1)

    print(f"Found user: {user.username!r} ({user.id})")

    # Set admin flag
    user.is_admin = True
    db.flush()
    print(f"  ✓ Set {user.username!r} as admin")

    # Make owner of every campaign
    campaigns = db.query(Campaign).all()
    if not campaigns:
        print("  (no campaigns found — nothing to assign)")
    for campaign in campaigns:
        existing = db.query(CampaignMember).filter(
            CampaignMember.user_id == user.id,
            CampaignMember.campaign_id == campaign.id,
        ).first()
        if existing:
            existing.role = "owner"
            print(f"  ✓ Updated role to owner for: {campaign.name!r}")
        else:
            db.add(CampaignMember(
                id=str(uuid.uuid4()),
                user_id=user.id,
                campaign_id=campaign.id,
                role="owner",
            ))
            print(f"  ✓ Added as owner of: {campaign.name!r}")

    db.commit()
    print("Done.")
finally:
    db.close()
