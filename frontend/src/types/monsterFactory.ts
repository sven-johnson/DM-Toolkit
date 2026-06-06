// ── Reference data ────────────────────────────────────────────────────────────

export interface CreatureArchetype {
  id: string
  name: string
  description: string | null
  typical_traits: string[] | null
  damage_immunities: string[] | null
  damage_resistances: string[] | null
  condition_immunities: string[] | null
  created_at: string
  updated_at: string
}

export interface CombatRoleArchetype {
  id: string
  name: string
  description: string | null
  action_weight: number
  hp_share_tier: string
  ac_profile: string
  damage_profile: string
  is_boss_eligible: boolean
  is_minion: boolean
  default_attack_count: number
  preferred_conditions: string[] | null
  created_at: string
  updated_at: string
}

export interface EncounterTemplateSlot {
  id: string
  encounter_template_id: string
  combat_role_archetype_id: string
  combat_role: CombatRoleArchetype
  default_count: number
  is_required: boolean
  sort_order: number
}

export interface EncounterTemplate {
  id: string
  name: string
  description: string | null
  is_custom: boolean
  slots: EncounterTemplateSlot[] | null
  created_at: string
  updated_at: string
}

export interface AbilityFlavor {
  id: string
  name: string
  damage_type: string
  is_custom: boolean
  created_at: string
}

// ── GM Profile settings ───────────────────────────────────────────────────────

export interface LethalitySettings {
  threat_turns_trivial: number
  threat_turns_easy: number
  threat_turns_medium: number
  threat_turns_hard: number
  threat_turns_deadly: number
  damage_smoothing: number
  hp_smoothing: number
  one_shot_prevention_threshold: number
  boss_nova_multiplier: number
  allow_player_death: boolean
}

export interface CombatDurationSettings {
  target_rounds_trivial: number
  target_rounds_easy: number
  target_rounds_medium: number
  target_rounds_hard: number
  target_rounds_deadly: number
  round_variance_tolerance: number
}

export interface ActionEconomySettings {
  multiplier_trivial: number
  multiplier_easy: number
  multiplier_medium: number
  multiplier_hard: number
  multiplier_deadly: number
  bonus_action_estimate: number
  legendary_action_override: number | null
  lair_actions_enabled: boolean
}

export interface HitRateSettings {
  monster_hit_rate_trivial: number
  monster_hit_rate_easy: number
  monster_hit_rate_medium: number
  monster_hit_rate_hard: number
  monster_hit_rate_deadly: number
  player_hit_rate_trivial: number
  player_hit_rate_easy: number
  player_hit_rate_medium: number
  player_hit_rate_hard: number
  player_hit_rate_deadly: number
}

export interface SavingThrowSettings {
  save_dc_base: number
  save_dc_proficiency_scaling: boolean
  save_dc_difficulty_bonus: number
}

export interface MinionSettings {
  minion_one_hit_kill: boolean
  minion_hp_fraction: number
  minion_damage_fraction: number
}

export interface WarningSettings {
  warn_nova_threshold: boolean
  warn_one_shot_risk: boolean
  warn_action_economy_imbalance: boolean
  warn_round_duration_deviation: boolean
  show_math: boolean
}

export interface GMProfile {
  id: string
  name: string
  is_default: boolean
  created_at: string
  updated_at: string
  lethality: LethalitySettings
  combat_duration: CombatDurationSettings
  action_economy: ActionEconomySettings
  hit_rate: HitRateSettings
  saving_throw: SavingThrowSettings
  minion: MinionSettings
  warnings: WarningSettings
}

// ── Calculator I/O ────────────────────────────────────────────────────────────

export type Difficulty = 'trivial' | 'easy' | 'medium' | 'hard' | 'deadly'

export interface PartyMember {
  max_hp: number
  ac: number
  nova_damage: number
  sustained_damage_per_round: number
}

export interface PartyProfile {
  party_size: number
  avg_level: number
  avg_hp: number
  total_hp: number
  lowest_hp: number
  avg_ac: number
  party_nova: number
  party_sustained: number
  proficiency_bonus: number
  estimated_bonus_actions_per_round: number
  avg_attack_bonus: number
}

export interface DifficultyTargets {
  difficulty: string
  target_rounds: number
  target_rounds_min: number
  target_rounds_max: number
  threat_turns: number
  action_economy_multiplier: number
  monster_hit_rate: number
  player_hit_rate: number
  monster_action_budget: number
  target_damage_per_turn_per_monster: number
  target_total_monster_hp: number
  save_dc: number
}

export interface CalculatedMonsterStats {
  hp: number
  ac: number
  attack_bonus: number
  save_dc: number
  damage_per_attack: number
  attack_count: number
  damage_dice: string
  damage_bonus: number
  speed: number
  str_score: number
  dex_score: number
  con_score: number
  int_score: number
  wis_score: number
  cha_score: number
  legendary_action_count: number
  warnings: string[]
  show_math_detail: Record<string, unknown>
}

export interface AssignedAbility {
  name: string
  damage_dice: string
  damage_bonus: number
  damage_type: string
  attack_bonus: number
  range: string
  description: string
  is_legendary: boolean
  action_cost: number
}

export interface MonsterAbilitySet {
  standard_actions: AssignedAbility[]
  legendary_actions: AssignedAbility[]
  lair_actions: AssignedAbility[]
  special_traits: string[]
  multiattack_description: string
}

export interface GeneratedMonster {
  slot_index: number
  combat_role_name: string
  creature_archetype_name: string
  count: number
  is_boss: boolean
  stats: CalculatedMonsterStats
  abilities: MonsterAbilitySet
}

export interface GeneratedEncounter {
  encounter_name: string
  difficulty: string
  party_profile: PartyProfile
  difficulty_targets: DifficultyTargets
  monsters: GeneratedMonster[]
  total_monster_count: number
  total_monster_hp: number
  total_monster_actions_per_round: number
  expected_rounds: number
  expected_rounds_min: number
  expected_rounds_max: number
  all_warnings: string[]
  math_detail: Record<string, unknown>
}

// ── Profile CRUD payloads ─────────────────────────────────────────────────────

export interface GMProfileCreate {
  name: string
  is_default?: boolean
  lethality: LethalitySettings
  combat_duration: CombatDurationSettings
  action_economy: ActionEconomySettings
  hit_rate: HitRateSettings
  saving_throw: SavingThrowSettings
  minion: MinionSettings
  warnings: WarningSettings
}

export type GMProfileUpdate = Omit<GMProfileCreate, 'is_default'>

export interface Preset {
  name: string
  description: string
  lethality: LethalitySettings
  combat_duration: CombatDurationSettings
  action_economy: ActionEconomySettings
  hit_rate: HitRateSettings
  saving_throw: SavingThrowSettings
  minion: MinionSettings
  warnings: WarningSettings
}

// ── D&D Beyond export ─────────────────────────────────────────────────────────

export interface DnDBeyondExport {
  name: string
  meta_line: string
  cr_suggestion: string
  is_legendary: boolean
  hp: number
  hp_dice: string
  ac: number
  speed: string
  str_score: number
  dex_score: number
  con_score: number
  int_score: number
  wis_score: number
  cha_score: number
  special_traits_text: string
  actions_text: string
  bonus_actions_text: string
  reactions_text: string
  legendary_actions_text: string
  lair_actions_text: string
  characteristics_text: string
}

// ── Encounter composition (wizard state) ─────────────────────────────────────

export interface EncounterComposition {
  templateId: string | null
  difficulty: Difficulty | null
  slots: EncounterCompositionSlot[]
}

// ── Request payloads ──────────────────────────────────────────────────────────

export interface EncounterCompositionSlot {
  combat_role_id: string
  creature_archetype_id: string
  count: number
  is_boss: boolean
  override_lair_actions?: boolean | null
}

export interface GenerateEncounterInput {
  party_members: PartyMember[]
  party_level: number
  difficulty: Difficulty
  composition: EncounterCompositionSlot[]
  gm_profile_id: string
  encounter_name?: string
  lair_actions_enabled?: boolean
}

export interface RebalanceChanges {
  composition?: EncounterCompositionSlot[] | null
  party_members?: PartyMember[] | null
  party_level?: number | null
  difficulty?: string | null
}

export interface RebalanceEncounterInput {
  existing_encounter: GeneratedEncounter
  changes: RebalanceChanges
  gm_profile_id: string
}

export interface SaveEncounterInput {
  encounter: GeneratedEncounter
  name: string
  gm_profile_id?: string | null
}

export interface SaveMonsterTemplateInput {
  monster: GeneratedMonster
  name: string
  party_avg_level: number
}

// ── Persistence / saved data ──────────────────────────────────────────────────

export interface MonsterStatBlock {
  id: string
  name: string
  creature_archetype_id: string | null
  combat_role_archetype_id: string
  gm_profile_id: string | null
  is_boss: boolean
  level_tier: number
  hp: number
  ac: number
  attack_bonus: number
  save_dc: number
  speed: number
  str_score: number
  dex_score: number
  con_score: number
  int_score: number
  wis_score: number
  cha_score: number
  damage_immunities: string[] | null
  damage_resistances: string[] | null
  condition_immunities: string[] | null
  has_legendary_actions: boolean
  legendary_action_count: number
  has_lair_actions: boolean
  actions: Record<string, unknown>[] | null
  legendary_actions: Record<string, unknown>[] | null
  lair_actions: Record<string, unknown>[] | null
  is_saved_template: boolean
  created_at: string
  updated_at: string
}

export interface SavedEncounterMonster {
  id: string
  count: number
  sort_order: number
  monster_stat_block: MonsterStatBlock
}

export interface SavedEncounterSummary {
  id: string
  name: string
  difficulty: string
  party_size: number
  party_avg_level: number
  expected_rounds: number
  total_monster_count: number
  created_at: string
}

export interface SavedEncounter {
  id: string
  name: string
  difficulty: string
  party_size: number
  party_avg_level: number
  party_avg_hp: number
  party_total_hp: number
  party_nova_damage: number
  party_sustained_damage: number
  expected_rounds: number
  expected_rounds_min: number
  expected_rounds_max: number
  total_monster_count: number
  encounter_monsters: SavedEncounterMonster[]
  created_at: string
}

export interface PagedEncounters {
  items: SavedEncounterSummary[]
  total: number
  page: number
  per_page: number
}

export interface PagedTemplates {
  items: MonsterStatBlock[]
  total: number
  page: number
  per_page: number
}
