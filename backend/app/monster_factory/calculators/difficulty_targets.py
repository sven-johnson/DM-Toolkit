from __future__ import annotations

from typing import Literal, Protocol

from pydantic import BaseModel

from .party_profile import PartyProfile


# ── Types ─────────────────────────────────────────────────────────────────────

Difficulty = Literal["trivial", "easy", "medium", "hard", "deadly"]

# trivial and easy share DC index 0 — neither tier escalates spell difficulty
_DIFFICULTY_DC_INDEX: dict[str, int] = {
    "trivial": 0,
    "easy":    0,
    "medium":  1,
    "hard":    2,
    "deadly":  3,
}


# ── Settings protocols ────────────────────────────────────────────────────────
# Each protocol only declares the fields this module actually reads, so the
# calculator stays compatible with both ORM models and Pydantic schemas.

class _LethalityLike(Protocol):
    threat_turns_trivial: float
    threat_turns_easy:    float
    threat_turns_medium:  float
    threat_turns_hard:    float
    threat_turns_deadly:  float
    hp_smoothing:         float


class _CombatDurationLike(Protocol):
    target_rounds_trivial: float
    target_rounds_easy:    float
    target_rounds_medium:  float
    target_rounds_hard:    float
    target_rounds_deadly:  float
    round_variance_tolerance: float


class _ActionEconomyLike(Protocol):
    multiplier_trivial: float
    multiplier_easy:    float
    multiplier_medium:  float
    multiplier_hard:    float
    multiplier_deadly:  float


class _HitRateLike(Protocol):
    monster_hit_rate_trivial: float
    monster_hit_rate_easy:    float
    monster_hit_rate_medium:  float
    monster_hit_rate_hard:    float
    monster_hit_rate_deadly:  float
    player_hit_rate_trivial:  float
    player_hit_rate_easy:     float
    player_hit_rate_medium:   float
    player_hit_rate_hard:     float
    player_hit_rate_deadly:   float


class _SavingThrowLike(Protocol):
    save_dc_base:               int
    save_dc_proficiency_scaling: bool
    save_dc_difficulty_bonus:   int


class GmSettings(Protocol):
    """Satisfied by GMProfile ORM (with relationships loaded) and Pydantic bundles alike."""
    lethality:       _LethalityLike
    combat_duration: _CombatDurationLike
    action_economy:  _ActionEconomyLike
    hit_rate:        _HitRateLike
    saving_throw:    _SavingThrowLike


# ── Output schema ─────────────────────────────────────────────────────────────

class DifficultyTargets(BaseModel):
    difficulty:                          str
    target_rounds:                       float
    target_rounds_min:                   float
    target_rounds_max:                   float
    threat_turns:                        float
    action_economy_multiplier:           float
    monster_hit_rate:                    float
    player_hit_rate:                     float
    monster_action_budget:               float
    target_damage_per_turn_per_monster:  float
    target_total_monster_hp:             float
    save_dc:                             int


# ── Calculator ────────────────────────────────────────────────────────────────

def calculate_difficulty_targets(
    difficulty: Difficulty,
    party_profile: PartyProfile,
    gm_settings: GmSettings,
) -> DifficultyTargets:
    """
    Translate a difficulty tier + party stats + GM settings into the concrete
    numeric targets an encounter generator must hit.

    All values are derived from the difficulty-specific slices of gm_settings;
    no randomness or DB access is involved.
    """
    leth = gm_settings.lethality
    dur  = gm_settings.combat_duration
    ae   = gm_settings.action_economy
    hr   = gm_settings.hit_rate
    st   = gm_settings.saving_throw

    # Pull per-difficulty scalars from the settings objects
    threat_turns              = getattr(leth, f"threat_turns_{difficulty}")
    target_rounds             = getattr(dur,  f"target_rounds_{difficulty}")
    action_economy_multiplier = getattr(ae,   f"multiplier_{difficulty}")
    monster_hit_rate          = getattr(hr,   f"monster_hit_rate_{difficulty}")
    player_hit_rate           = getattr(hr,   f"player_hit_rate_{difficulty}")

    variance = dur.round_variance_tolerance

    # ── monster_action_budget ─────────────────────────────────────────────────
    # party_action_equivalents accounts for both actions and bonus actions
    party_action_equivalents = (
        party_profile.party_size + party_profile.estimated_bonus_actions_per_round
    )
    monster_action_budget = party_action_equivalents * action_economy_multiplier

    # ── target_damage_per_turn_per_monster ────────────────────────────────────
    # Damage needed to reduce avg_hp to 0 in exactly threat_turns turns.
    # Per-monster share is computed downstream once the monster count is known.
    target_damage_per_turn_per_monster = party_profile.avg_hp / threat_turns

    # ── target_total_monster_hp ───────────────────────────────────────────────
    # Total HP the monster side needs so the party spends the full target_rounds
    # burning it down at their sustained DPR. hp_smoothing adjusts for nova
    # burst vs. sustained variance.
    target_total_monster_hp = (
        party_profile.party_sustained * target_rounds * leth.hp_smoothing
    )

    # ── save_dc ───────────────────────────────────────────────────────────────
    dc_index     = _DIFFICULTY_DC_INDEX[difficulty]
    prof_bonus   = party_profile.proficiency_bonus if st.save_dc_proficiency_scaling else 0
    save_dc      = st.save_dc_base + prof_bonus + (dc_index * st.save_dc_difficulty_bonus)

    return DifficultyTargets(
        difficulty=difficulty,
        target_rounds=target_rounds,
        target_rounds_min=target_rounds - variance,
        target_rounds_max=target_rounds + variance,
        threat_turns=threat_turns,
        action_economy_multiplier=action_economy_multiplier,
        monster_hit_rate=monster_hit_rate,
        player_hit_rate=player_hit_rate,
        monster_action_budget=monster_action_budget,
        target_damage_per_turn_per_monster=target_damage_per_turn_per_monster,
        target_total_monster_hp=target_total_monster_hp,
        save_dc=save_dc,
    )
