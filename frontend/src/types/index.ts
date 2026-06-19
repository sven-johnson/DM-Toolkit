export interface StatBlockSummary {
  id: string
  name: string
  hp: number
  ac: number
  is_boss: boolean
  combat_role_name: string
}

export interface Campaign {
  id: string
  name: string
  created_at: string
  my_role: 'owner' | 'game_master' | 'player' | null
}

export interface CampaignWithRelations extends Campaign {
  storylines: Storyline[]
}

export interface Storyline {
  id: string
  campaign_id: string
  title: string
  description: string | null
  order_index: number
  created_at: string
}

export interface StorylineWithScenes extends Storyline {
  scenes: Scene[]
}

export interface Session {
  id: string
  campaign_id: string
  title: string
  date: string | null
  recap_notes: string | null
  active_storyline_id: string | null
  created_at: string
}

export interface SessionWithScenes extends Session {
  scenes: Scene[]
}

export type SceneType = 'story' | 'puzzle' | 'combat' | 'shop'

export interface SceneEnemy {
  id: string
  scene_id: string
  name: string
  quantity: number
  order_index: number
  saved_encounter_monster_id: string | null
  stat_block_summary: StatBlockSummary | null
}

export type Currency = 'copper' | 'silver' | 'gold'

export interface SceneShopItem {
  id: string
  scene_id: string
  name: string
  description: string | null
  price: number
  currency: Currency
  order_index: number
}

export interface Scene {
  id: string
  storyline_id: string
  title: string
  body: string
  dm_notes: string | null
  scene_type: SceneType
  puzzle_clues: string | null
  puzzle_solution: string | null
  music_cue: string | null
  order_index: number
  created_at: string
  updated_at: string
  checks: Check[]
  enemies: SceneEnemy[]
  shop_items: SceneShopItem[]
}

export interface Roll {
  id: string
  check_id: string
  character_id: string
  die_result: number
}

export interface Check {
  id: string
  scene_id: string
  check_type: 'skill' | 'save'
  subtype: string
  dc: number
  character_ids: string[]
  order_index: number
  rolls: Roll[]
}

export interface Character {
  id: string
  campaign_id: string
  name: string
  char_class: string
  subclass: string
  level: number
  str_score: number
  dex_score: number
  con_score: number
  int_score: number
  wis_score: number
  cha_score: number
  str_mod: number
  dex_mod: number
  con_mod: number
  int_mod: number
  wis_mod: number
  cha_mod: number
  acrobatics: number
  animal_handling: number
  arcana: number
  athletics: number
  deception: number
  history: number
  insight: number
  intimidation: number
  investigation: number
  medicine: number
  nature: number
  perception: number
  performance: number
  persuasion: number
  religion: number
  sleight_of_hand: number
  stealth: number
  survival: number
  str_save: number
  dex_save: number
  con_save: number
  int_save: number
  wis_save: number
  cha_save: number
  ac: number
  max_hp: number
}

export interface RollHistoryItem {
  id: string
  die_result: number
  character_id: string
  check_id: string
  check_type: string
  subtype: string
  dc: number
  character_ids: string[]
  scene_id: string
  scene_title: string
  session_id: string | null
  session_title: string | null
}

export interface SessionRollOut {
  id: string
  check_id: string
  character_id: string
  die_result: number
  check_type: string
  subtype: string
  dc: number
}

export interface TokenResponse {
  access_token: string
  token_type: string
}

export interface WikiArticle {
  id: string
  campaign_id: string
  title: string
  category: string
  location_subtype: string | null
  is_stub: boolean
  image_url: string | null
  tags: string[] | null
  public_content: string
  private_content: string
  created_at: string
  updated_at: string
}

export interface WikiAssociationDisplay {
  id: string
  association_label: string
  other_article_id: string
  other_article_title: string
  other_article_category: string
  other_article_location_subtype: string | null
  direction: 'from' | 'to'
}

export interface WikiAddAssociationAsTargetRequest {
  source_title: string
  source_category: string
  source_location_subtype?: string | null
  association_label: string
}

export interface WikiArticleDetail extends WikiArticle {
  associations: WikiAssociationDisplay[]
}

export interface WikiAddAssociationRequest {
  target_title: string
  target_category: string
  target_location_subtype?: string | null
  association_label: string
}

export interface WikiAddAssociationResult {
  association_id: string
  stub_created: boolean
  stub_article_id: string | null
}

export interface WikiImportRequest {
  campaign_id: string
  articles: WikiImportArticle[]
}

export interface WikiImportArticle {
  title: string
  category: string
  is_stub: boolean
  image_url: string | null
  tags: string[] | null
  public_content: string
  private_content: string
  associations: WikiImportAssociation[]
}

export interface WikiImportAssociation {
  target_title: string
  target_category: string
  association_label: string
}

export interface WikiImportResult {
  created: number
  updated: number
  stubs_created: number
  errors: string[]
}

export interface WikiSearchResult {
  id: string
  title: string
  category: string
  tags: string[] | null
  is_stub: boolean
  snippet: string | null
}

export interface WikiExportResponse {
  campaign_id: string
  articles: WikiExportArticle[]
}

export interface WikiExportArticle {
  title: string
  category: string
  is_stub: boolean
  image_url: string | null
  tags: string[] | null
  public_content: string
  private_content: string
  associations: WikiExportAssociation[]
}

export interface WikiExportAssociation {
  target_title: string
  target_category: string
  association_label: string
}

// ---------------------------------------------------------------------------
// Storyline import / export
// ---------------------------------------------------------------------------

export interface StorylineExportEnemy {
  name: string
  quantity: number
}

export interface StorylineExportShopItem {
  name: string
  description: string | null
  price: number
  currency: string
}

export interface StorylineExportScene {
  title: string
  body: string
  dm_notes: string | null
  scene_type: string
  puzzle_clues: string | null
  puzzle_solution: string | null
  enemies: StorylineExportEnemy[]
  shop_items: StorylineExportShopItem[]
}

export interface StorylineExportItem {
  title: string
  description: string | null
  scenes: StorylineExportScene[]
}

export interface StorylineExportResponse {
  campaign_id: string
  storylines: StorylineExportItem[]
}

export interface StorylineImportRequest {
  campaign_id: string
  storylines: StorylineExportItem[]
}

export interface StorylineImportResult {
  storylines_created: number
  storylines_updated: number
  scenes_created: number
  scenes_updated: number
  errors: string[]
}

// ── Combat stats types ────────────────────────────────────────────────────────

export interface RuleSystemBrief {
  id: number
  slug: string
  name: string
  version: string
  is_default: boolean
}

export interface CampaignDetail extends Campaign {
  rule_system: RuleSystemBrief | null
}

export interface StatDefinition {
  id: number
  slug: string
  name: string
  abbreviation: string
  stat_type: string
  has_modifier: boolean
  modifier_formula: string | null
  sort_order: number
}

export interface StatOut {
  stat_definition: StatDefinition
  value: number
  computed_modifier: number
}

// ── Combat turn types ─────────────────────────────────────────────────────────

export type TurnType = 'nova' | 'sustained' | 'variant'

export interface TurnLineItemSummary {
  id: number
  name: string
  dice_notation: string | null
  average_damage: number
  is_bonus_action: boolean
  notes: string | null
  sort_order: number
}

export interface CharacterTurnSummary {
  id: number
  name: string
  turn_type: TurnType
  is_primary: boolean
  notes: string | null
  sort_order: number
  line_items: TurnLineItemSummary[]
  turn_total: number
}

export interface CreateTurnInput {
  name: string
  turn_type: TurnType
  is_primary?: boolean
  notes?: string | null
  sort_order?: number
}

export type UpdateTurnInput = CreateTurnInput

export interface CreateLineItemInput {
  name: string
  dice_notation?: string | null
  average_damage: number
  is_bonus_action?: boolean
  notes?: string | null
  sort_order?: number
}

export type UpdateLineItemInput = CreateLineItemInput

export interface ReorderItemInput {
  id: number
  sort_order: number
}

export interface CharacterProfileBrief {
  character_id: string
  character_name: string
  max_hp: number
  armor_class: number
  nova_damage: number
  sustained_damage_per_round: number
  proficiency_bonus: number
  level: number
}

export interface PartySummaryOut {
  campaign_id: string
  rule_system_slug: string
  party_size: number
  avg_level: number
  avg_hp: number
  total_hp: number
  lowest_hp: number
  avg_ac: number
  party_nova: number
  party_sustained: number
  has_complete_data: boolean
  incomplete_characters: string[]
  characters: CharacterProfileBrief[]
}

export interface CharacterCombatProfileOut {
  character_id: string
  character_name: string
  rule_system_slug: string
  max_hp: number
  armor_class: number
  stats: Record<string, number>
  modifiers: Record<string, number>
  skills: Record<string, string>
  nova_damage: number
  sustained_damage_per_round: number
  proficiency_bonus: number
  level: number
}
