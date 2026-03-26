export interface Session {
  id: number;
  title: string;
  date: string | null;
  created_at: string;
}

export interface Roll {
  id: number;
  check_id: number;
  character_id: number;
  die_result: number;
}

export interface Check {
  id: number;
  scene_id: number;
  check_type: 'skill' | 'save';
  subtype: string;
  dc: number;
  character_ids: number[];
  order_index: number;
  rolls: Roll[];
}

export interface Scene {
  id: number;
  session_id: number;
  title: string;
  body: string;
  order_index: number;
  created_at: string;
  updated_at: string;
  checks: Check[];
}

export interface SessionWithScenes extends Session {
  scenes: Scene[];
}

export interface Character {
  id: number;
  name: string;
  char_class: string;
  subclass: string;
  level: number;
  str_score: number;
  dex_score: number;
  con_score: number;
  int_score: number;
  wis_score: number;
  cha_score: number;
  str_mod: number;
  dex_mod: number;
  con_mod: number;
  int_mod: number;
  wis_mod: number;
  cha_mod: number;
  acrobatics: number;
  animal_handling: number;
  arcana: number;
  athletics: number;
  deception: number;
  history: number;
  insight: number;
  intimidation: number;
  investigation: number;
  medicine: number;
  nature: number;
  perception: number;
  performance: number;
  persuasion: number;
  religion: number;
  sleight_of_hand: number;
  stealth: number;
  survival: number;
  str_save: number;
  dex_save: number;
  con_save: number;
  int_save: number;
  wis_save: number;
  cha_save: number;
  ac: number;
  max_hp: number;
}

export interface RollHistoryItem {
  id: number;
  die_result: number;
  character_id: number;
  check_id: number;
  check_type: string;
  subtype: string;
  dc: number;
  character_ids: number[];
  scene_id: number;
  scene_title: string;
  session_id: number;
  session_title: string;
}

export interface SessionRollOut {
  id: number;
  check_id: number;
  character_id: number;
  die_result: number;
  check_type: string;
  subtype: string;
  dc: number;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
