from __future__ import annotations

from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, Field, computed_field


# ── Lethality ─────────────────────────────────────────────────────────────────

class LethalitySettingsIn(BaseModel):
    threat_turns_trivial: float = Field(6.0, gt=0)
    threat_turns_easy: float = Field(5.0, gt=0)
    threat_turns_medium: float = Field(3.5, gt=0)
    threat_turns_hard: float = Field(2.25, gt=0)
    threat_turns_deadly: float = Field(1.5, gt=0)
    damage_smoothing: float = Field(0.85, gt=0)
    hp_smoothing: float = Field(1.10, gt=0)
    one_shot_prevention_threshold: float = Field(0.60, ge=0.0, le=1.0)
    boss_nova_multiplier: float = Field(1.5, gt=0)
    allow_player_death: bool = False


class LethalitySettingsOut(LethalitySettingsIn):
    model_config = ConfigDict(from_attributes=True)


# ── Combat Duration ───────────────────────────────────────────────────────────

class CombatDurationSettingsIn(BaseModel):
    target_rounds_trivial: float = Field(1.5, gt=0)
    target_rounds_easy: float = Field(2.5, gt=0)
    target_rounds_medium: float = Field(3.5, gt=0)
    target_rounds_hard: float = Field(5.0, gt=0)
    target_rounds_deadly: float = Field(6.0, gt=0)
    round_variance_tolerance: float = Field(1.0, ge=0)


class CombatDurationSettingsOut(CombatDurationSettingsIn):
    model_config = ConfigDict(from_attributes=True)


# ── Action Economy ────────────────────────────────────────────────────────────

class ActionEconomySettingsIn(BaseModel):
    multiplier_trivial: float = Field(0.6, gt=0)
    multiplier_easy: float = Field(0.8, gt=0)
    multiplier_medium: float = Field(1.0, gt=0)
    multiplier_hard: float = Field(1.2, gt=0)
    multiplier_deadly: float = Field(1.4, gt=0)
    bonus_action_estimate: float = Field(0.5, ge=0.0, le=1.0)
    legendary_action_override: int | None = Field(None, ge=0)
    lair_actions_enabled: bool = True


class ActionEconomySettingsOut(ActionEconomySettingsIn):
    model_config = ConfigDict(from_attributes=True)


# ── Hit Rate ──────────────────────────────────────────────────────────────────

class HitRateSettingsIn(BaseModel):
    monster_hit_rate_trivial: float = Field(0.40, ge=0.0, le=1.0)
    monster_hit_rate_easy: float = Field(0.50, ge=0.0, le=1.0)
    monster_hit_rate_medium: float = Field(0.60, ge=0.0, le=1.0)
    monster_hit_rate_hard: float = Field(0.65, ge=0.0, le=1.0)
    monster_hit_rate_deadly: float = Field(0.70, ge=0.0, le=1.0)
    player_hit_rate_trivial: float = Field(0.75, ge=0.0, le=1.0)
    player_hit_rate_easy: float = Field(0.65, ge=0.0, le=1.0)
    player_hit_rate_medium: float = Field(0.55, ge=0.0, le=1.0)
    player_hit_rate_hard: float = Field(0.50, ge=0.0, le=1.0)
    player_hit_rate_deadly: float = Field(0.45, ge=0.0, le=1.0)


class HitRateSettingsOut(HitRateSettingsIn):
    model_config = ConfigDict(from_attributes=True)


# ── Saving Throw ──────────────────────────────────────────────────────────────

class SavingThrowSettingsIn(BaseModel):
    save_dc_base: int = Field(8, ge=0)
    save_dc_proficiency_scaling: bool = True
    save_dc_difficulty_bonus: int = Field(1, ge=0)


class SavingThrowSettingsOut(SavingThrowSettingsIn):
    model_config = ConfigDict(from_attributes=True)


# ── Minion ────────────────────────────────────────────────────────────────────

class MinionSettingsIn(BaseModel):
    minion_one_hit_kill: bool = False
    minion_hp_fraction: float = Field(0.25, ge=0.0, le=1.0)
    minion_damage_fraction: float = Field(0.40, ge=0.0, le=1.0)


class MinionSettingsOut(MinionSettingsIn):
    model_config = ConfigDict(from_attributes=True)


# ── Warnings ──────────────────────────────────────────────────────────────────

class WarningSettingsIn(BaseModel):
    warn_nova_threshold: bool = True
    warn_one_shot_risk: bool = True
    warn_action_economy_imbalance: bool = True
    warn_round_duration_deviation: bool = True
    show_math: bool = False


class WarningSettingsOut(WarningSettingsIn):
    model_config = ConfigDict(from_attributes=True)


# ── GM Profile ────────────────────────────────────────────────────────────────

class GMProfileCreate(BaseModel):
    name: str
    is_default: bool = False
    lethality: LethalitySettingsIn = Field(default_factory=LethalitySettingsIn)
    combat_duration: CombatDurationSettingsIn = Field(default_factory=CombatDurationSettingsIn)
    action_economy: ActionEconomySettingsIn = Field(default_factory=ActionEconomySettingsIn)
    hit_rate: HitRateSettingsIn = Field(default_factory=HitRateSettingsIn)
    saving_throw: SavingThrowSettingsIn = Field(default_factory=SavingThrowSettingsIn)
    minion: MinionSettingsIn = Field(default_factory=MinionSettingsIn)
    warnings: WarningSettingsIn = Field(default_factory=WarningSettingsIn)


class GMProfileUpdate(BaseModel):
    """Full replacement of a profile's name and all settings. is_default is managed via set-default."""
    name: str
    lethality: LethalitySettingsIn
    combat_duration: CombatDurationSettingsIn
    action_economy: ActionEconomySettingsIn
    hit_rate: HitRateSettingsIn
    saving_throw: SavingThrowSettingsIn
    minion: MinionSettingsIn
    warnings: WarningSettingsIn


class GMProfileOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    is_default: bool
    created_at: datetime
    updated_at: datetime
    lethality: LethalitySettingsOut
    combat_duration: CombatDurationSettingsOut
    action_economy: ActionEconomySettingsOut
    hit_rate: HitRateSettingsOut
    saving_throw: SavingThrowSettingsOut
    minion: MinionSettingsOut
    warnings: WarningSettingsOut


# ── Presets ───────────────────────────────────────────────────────────────────

class PresetOut(BaseModel):
    name: str
    description: str
    lethality: LethalitySettingsIn
    combat_duration: CombatDurationSettingsIn
    action_economy: ActionEconomySettingsIn
    hit_rate: HitRateSettingsIn
    saving_throw: SavingThrowSettingsIn
    minion: MinionSettingsIn
    warnings: WarningSettingsIn


class ProfileFromPresetIn(BaseModel):
    preset_name: str
    profile_name: str
    is_default: bool = False


# ── Archetype reference ───────────────────────────────────────────────────────

class CreatureArchetypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str | None
    typical_traits: list[str] | None
    damage_immunities: list[str] | None
    damage_resistances: list[str] | None
    condition_immunities: list[str] | None
    created_at: datetime
    updated_at: datetime


class CombatRoleArchetypeOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str | None
    action_weight: float
    hp_share_tier: str
    ac_profile: str
    damage_profile: str
    is_boss_eligible: bool
    is_minion: bool
    default_attack_count: int
    preferred_conditions: list[str] | None
    created_at: datetime
    updated_at: datetime


class EncounterTemplateSlotOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    encounter_template_id: str
    combat_role_archetype_id: str
    combat_role: CombatRoleArchetypeOut
    default_count: int
    is_required: bool
    sort_order: int


class EncounterTemplateOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    description: str | None
    is_custom: bool
    created_at: datetime
    updated_at: datetime
    slots: list[EncounterTemplateSlotOut] | None = None


class AbilityFlavorOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    damage_type: str
    is_custom: bool
    created_at: datetime


class AbilityFlavorCreate(BaseModel):
    name: str
    damage_type: str


# ── Saved Monster Stat Block ──────────────────────────────────────────────────

class MonsterStatBlockOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    creature_archetype_id: str | None
    combat_role_archetype_id: str
    gm_profile_id: str | None
    is_boss: bool
    level_tier: int
    hp: int
    ac: int
    attack_bonus: int
    save_dc: int
    speed: int
    str_score: int
    dex_score: int
    con_score: int
    int_score: int
    wis_score: int
    cha_score: int
    damage_immunities: list[str] | None
    damage_resistances: list[str] | None
    condition_immunities: list[str] | None
    has_legendary_actions: bool
    legendary_action_count: int
    has_lair_actions: bool
    actions: list[dict[str, Any]] | None
    legendary_actions: list[dict[str, Any]] | None
    lair_actions: list[dict[str, Any]] | None
    is_saved_template: bool
    created_at: datetime
    updated_at: datetime


# ── Saved Encounter ───────────────────────────────────────────────────────────

class SavedEncounterMonsterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    count: int
    sort_order: int
    monster_stat_block: MonsterStatBlockOut


class SavedEncounterSummaryOut(BaseModel):
    id: str
    name: str
    difficulty: str
    party_size: int
    party_avg_level: int
    expected_rounds: float
    total_monster_count: int
    created_at: datetime


class SavedEncounterOut(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: str
    name: str
    difficulty: str
    party_size: int
    party_avg_level: int
    party_avg_hp: float
    party_total_hp: float
    party_nova_damage: float
    party_sustained_damage: float
    expected_rounds: float
    expected_rounds_min: float
    expected_rounds_max: float
    created_at: datetime
    encounter_monsters: list[SavedEncounterMonsterOut]

    @computed_field
    @property
    def total_monster_count(self) -> int:
        return sum(m.count for m in self.encounter_monsters)


class PagedEncountersOut(BaseModel):
    items: list[SavedEncounterSummaryOut]
    total: int
    page: int
    per_page: int


class PagedTemplatesOut(BaseModel):
    items: list[MonsterStatBlockOut]
    total: int
    page: int
    per_page: int
