from __future__ import annotations

import math
from typing import Protocol

from pydantic import BaseModel, Field


# ── Settings protocol ─────────────────────────────────────────────────────────
# Accepts any object with a bonus_action_estimate attribute — works with both
# the ActionEconomySettings ORM model and ActionEconomySettingsIn Pydantic schema.

class _ActionEconomyLike(Protocol):
    bonus_action_estimate: float


# ── I/O schemas ───────────────────────────────────────────────────────────────

class PartyMember(BaseModel):
    max_hp: int = Field(..., ge=1)
    ac: int = Field(..., ge=0)
    nova_damage: float = Field(..., ge=0)
    sustained_damage_per_round: float = Field(..., ge=0)


class PartyProfileInput(BaseModel):
    members: list[PartyMember] = Field(..., min_length=1, max_length=12)
    level: int = Field(..., ge=1, le=20)


class PartyProfile(BaseModel):
    party_size: int
    avg_level: int
    avg_hp: float
    total_hp: float
    lowest_hp: int
    avg_ac: float
    party_nova: float
    party_sustained: float
    proficiency_bonus: int
    estimated_bonus_actions_per_round: float
    avg_attack_bonus: float


# ── Helpers ───────────────────────────────────────────────────────────────────

def proficiency_bonus_for_level(level: int) -> int:
    """Return the D&D 5e proficiency bonus for the given character level (1–20)."""
    if level <= 4:
        return 2
    if level <= 8:
        return 3
    if level <= 12:
        return 4
    if level <= 16:
        return 5
    return 6


# ── Calculator ────────────────────────────────────────────────────────────────

def calculate_party_profile(
    input: PartyProfileInput,
    settings: _ActionEconomyLike,
) -> PartyProfile:
    """
    Derive aggregate party statistics from individual member data.

    avg_attack_bonus is estimated as floor(level / 2) + proficiency_bonus,
    a reasonable approximation across mixed martial and spellcasting classes.
    """
    members = input.members
    n = len(members)
    prof = proficiency_bonus_for_level(input.level)

    total_hp = float(sum(m.max_hp for m in members))
    avg_hp = total_hp / n
    lowest_hp = min(m.max_hp for m in members)
    avg_ac = sum(m.ac for m in members) / n
    party_nova = sum(m.nova_damage for m in members)
    party_sustained = sum(m.sustained_damage_per_round for m in members)

    return PartyProfile(
        party_size=n,
        avg_level=input.level,
        avg_hp=avg_hp,
        total_hp=total_hp,
        lowest_hp=lowest_hp,
        avg_ac=avg_ac,
        party_nova=party_nova,
        party_sustained=party_sustained,
        proficiency_bonus=prof,
        estimated_bonus_actions_per_round=n * settings.bonus_action_estimate,
        avg_attack_bonus=math.floor(input.level / 2) + prof,
    )
