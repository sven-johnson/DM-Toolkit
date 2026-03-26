export interface Session {
  id: number;
  title: string;
  date: string | null;
  created_at: string;
}

export interface Scene {
  id: number;
  session_id: number;
  title: string;
  body: string;
  order_index: number;
  created_at: string;
  updated_at: string;
}

export interface SessionWithScenes extends Session {
  scenes: Scene[];
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}
