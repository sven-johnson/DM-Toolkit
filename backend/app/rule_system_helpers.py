"""Helpers for resolving a campaign's effective rule system.

Imported by both the campaigns router and the character combat service.
"""
from sqlalchemy.orm import Session as DBSession

from .models import Campaign, RuleSystem


def get_campaign_rule_system(campaign_id: str, db: DBSession) -> RuleSystem:
    """Return the rule system for a campaign.

    If the campaign has an explicit rule_system_id, return that system.
    Otherwise return the system marked is_default=True.
    Raises ValueError if neither is found (should not happen after seeding).
    """
    campaign = db.query(Campaign).filter(Campaign.id == campaign_id).first()
    if campaign and campaign.rule_system_id:
        rs = db.query(RuleSystem).filter(RuleSystem.id == campaign.rule_system_id).first()
        if rs:
            return rs

    default = db.query(RuleSystem).filter(RuleSystem.is_default.is_(True)).first()
    if not default:
        raise ValueError("No default rule system found. Run seed_rule_systems() first.")
    return default
