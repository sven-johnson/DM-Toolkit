import { create } from 'zustand'
import type { AoeMarker } from '../shared/types/aoe'
import type { LayerName } from '../shared/types/ipc'
import type { ShowcaseDef, ShowcaseInstance } from '../shared/types/showcase'
import type { Effect, EffectDef, Token, TokenDef } from '../shared/types/tokens'

export interface GridConfig {
  color: number
  opacity: number
  cellSize: number
  lineWidth: number
  originX: number
  originY: number
}

interface VttState {
  layers: Record<LayerName, boolean>
  backgroundSrc: string
  grid: GridConfig
  tvDimensions: { width: number; height: number }
  tokenDefs: TokenDef[]
  tokens: Token[]
  effectDefs: EffectDef[]
  effects: Effect[]
  aoeMarkers: AoeMarker[]

  setLayerVisible: (layer: LayerName, visible: boolean) => void
  setBackgroundSrc: (src: string) => void
  setGridConfig: (config: Partial<GridConfig>) => void
  setTvDimensions: (width: number, height: number) => void

  addTokenDef: (def: TokenDef) => void
  removeTokenDef: (id: string) => void
  upsertToken: (token: Token) => void
  removeToken: (id: string) => void

  addEffectDef: (def: EffectDef) => void
  removeEffectDef: (id: string) => void
  upsertEffect: (effect: Effect) => void
  removeEffect: (id: string) => void

  upsertAoeMarker: (marker: AoeMarker) => void
  removeAoeMarker: (id: string) => void

  showAffectedArea: boolean
  setShowAffectedArea: (enabled: boolean) => void

  showcaseDefs: ShowcaseDef[]
  activeShowcase: ShowcaseInstance | null
  addShowcaseDef: (def: ShowcaseDef) => void
  removeShowcaseDef: (id: string) => void
  setActiveShowcase: (instance: ShowcaseInstance | null) => void
}

export const useVttStore = create<VttState>((set) => ({
  layers: { background: true, effects: true, tokens: true, grid: true },
  backgroundSrc: '',
  grid: { color: 0xffffff, opacity: 0.25, cellSize: 70, lineWidth: 1, originX: 0, originY: 0 },
  tvDimensions: { width: 1920, height: 1080 },
  tokenDefs: [],
  tokens: [],
  effectDefs: [],
  effects: [],
  aoeMarkers: [],
  showAffectedArea: false,
  showcaseDefs: [],
  activeShowcase: null,

  setLayerVisible: (layer, visible) =>
    set((s) => ({ layers: { ...s.layers, [layer]: visible } })),

  setBackgroundSrc: (src) => set({ backgroundSrc: src }),

  setGridConfig: (config) =>
    set((s) => ({ grid: { ...s.grid, ...config } })),

  setTvDimensions: (width, height) =>
    set({ tvDimensions: { width, height } }),

  addTokenDef: (def) =>
    set((s) => ({ tokenDefs: [...s.tokenDefs, def] })),

  removeTokenDef: (id) =>
    set((s) => ({ tokenDefs: s.tokenDefs.filter((d) => d.id !== id) })),

  upsertToken: (token) =>
    set((s) => ({
      tokens: s.tokens.some((t) => t.id === token.id)
        ? s.tokens.map((t) => (t.id === token.id ? token : t))
        : [...s.tokens, token],
    })),

  removeToken: (id) =>
    set((s) => ({ tokens: s.tokens.filter((t) => t.id !== id) })),

  addEffectDef: (def) =>
    set((s) => ({ effectDefs: [...s.effectDefs, def] })),

  removeEffectDef: (id) =>
    set((s) => ({ effectDefs: s.effectDefs.filter((d) => d.id !== id) })),

  upsertEffect: (effect) =>
    set((s) => ({
      effects: s.effects.some((e) => e.id === effect.id)
        ? s.effects.map((e) => (e.id === effect.id ? effect : e))
        : [...s.effects, effect],
    })),

  removeEffect: (id) =>
    set((s) => ({ effects: s.effects.filter((e) => e.id !== id) })),

  upsertAoeMarker: (marker) =>
    set((s) => ({
      aoeMarkers: s.aoeMarkers.some((a) => a.id === marker.id)
        ? s.aoeMarkers.map((a) => (a.id === marker.id ? marker : a))
        : [...s.aoeMarkers, marker],
    })),

  removeAoeMarker: (id) =>
    set((s) => ({ aoeMarkers: s.aoeMarkers.filter((a) => a.id !== id) })),

  setShowAffectedArea: (enabled) => set({ showAffectedArea: enabled }),

  addShowcaseDef: (def) =>
    set((s) => ({ showcaseDefs: [...s.showcaseDefs, def] })),

  removeShowcaseDef: (id) =>
    set((s) => ({
      showcaseDefs: s.showcaseDefs.filter((d) => d.id !== id),
      activeShowcase: s.activeShowcase?.defId === id ? null : s.activeShowcase,
    })),

  setActiveShowcase: (instance) => set({ activeShowcase: instance }),
}))
