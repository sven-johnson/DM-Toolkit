import { load } from '@tauri-apps/plugin-store'
import type { AoeMarker } from '../shared/types/aoe'
import type { BackgroundDef } from '../shared/types/background'
import type { ShowcaseDef, ShowcaseInstance } from '../shared/types/showcase'
import type { Effect, EffectDef, Token, TokenDef } from '../shared/types/tokens'

export interface VttManifest {
  tokenDefs: TokenDef[]
  effectDefs: EffectDef[]
  tokens: Token[]
  effects: Effect[]
  aoeMarkers: AoeMarker[]
  backgroundSrc: string
  showcaseDefs: ShowcaseDef[]
  activeShowcase: ShowcaseInstance | null
  backgroundDefs: BackgroundDef[]
}

const STORE_PATH = 'vtt-manifest.json'
const STORE_KEY = 'state'
const STORE_OPTS = { defaults: {} }

export async function loadManifest(): Promise<Partial<VttManifest>> {
  try {
    const store = await load(STORE_PATH, STORE_OPTS)
    return await store.get<VttManifest>(STORE_KEY) ?? {}
  } catch {
    return {}
  }
}

export async function saveManifest(data: VttManifest): Promise<void> {
  try {
    const store = await load(STORE_PATH, STORE_OPTS)
    await store.set(STORE_KEY, data)
    await store.save()
  } catch { /* persistence is best-effort */ }
}
