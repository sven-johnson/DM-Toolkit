export interface Campaign {
  id: number
  uuid: string
  name: string
  created_at: string
}

export interface CampaignWithRelations extends Campaign {
  storylines: Storyline[]
}

export interface Storyline {
  id: number
  uuid: string
  campaign_id: number
  title: string
  description: string | null
  order_index: number
  created_at: string
}

export interface StorylineWithScenes extends Storyline {
  scenes: Scene[]
}

export interface Session {
  id: number
  uuid: string
  campaign_id: number
  title: string
  date: string | null
  recap_notes: string | null
  active_storyline_id: number | null
  created_at: string
}

export interface SessionWithScenes extends Session {
  scenes: Scene[]
}

export type SceneType = 'story' | 'puzzle' | 'combat' | 'shop'

export interface SceneEnemy {
  id: number
  scene_id: number
  name: string
  quantity: number
  order_index: number
}

export type Currency = 'copper' | 'silver' | 'gold'

export interface SceneShopItem {
  id: number
  scene_id: number
  name: string
  description: string | null
  price: number
  currency: Currency
  order_index: number
}

export interface Scene {
  id: number
  uuid: string
  storyline_id: number
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
  id: number
  check_id: number
  character_id: number
  die_result: number
}

export interface Check {
  id: number
  scene_id: number
  check_type: 'skill' | 'save'
  subtype: string
  dc: number
  character_ids: number[]
  order_index: number
  rolls: Roll[]
}

export interface Character {
  id: number
  campaign_id: number
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
  id: number
  die_result: number
  character_id: number
  check_id: number
  check_type: string
  subtype: string
  dc: number
  character_ids: number[]
  scene_id: number
  scene_title: string
  session_id: number | null
  session_title: string | null
}

export interface SessionRollOut {
  id: number
  check_id: number
  character_id: number
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
  id: number
  campaign_id: number
  title: string
  category: string
  is_stub: boolean
  image_url: string | null
  tags: string[] | null
  public_content: string
  private_content: string
  created_at: string
  updated_at: string
}

export interface WikiAssociationDisplay {
  id: number
  association_label: string
  other_article_id: number
  other_article_title: string
  other_article_category: string
  direction: 'from' | 'to'
}

export interface WikiArticleDetail extends WikiArticle {
  associations: WikiAssociationDisplay[]
}

export interface WikiAddAssociationRequest {
  target_title: string
  target_category: string
  association_label: string
}

export interface WikiAddAssociationResult {
  association_id: number
  stub_created: boolean
  stub_article_id: number | null
}

export interface WikiImportRequest {
  campaign_id: number
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

export interface WikiExportResponse {
  campaign_id: number
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

export interface WikiSearchResult {
  id: number
  title: string
  category: string
  tags: string[] | null
  is_stub: boolean
  snippet: string | null
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
  campaign_id: number
  storylines: StorylineExportItem[]
}

export interface StorylineImportRequest {
  campaign_id: number
  storylines: StorylineExportItem[]
}

export interface StorylineImportResult {
  storylines_created: number
  storylines_updated: number
  scenes_created: number
  scenes_updated: number
  errors: string[]
}
