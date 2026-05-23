import type { AoeBlendMode, AoeColor, AoeShape } from './aoe'
import type { TokenSize } from './tokens'

/** All VTT event names — single source of truth for both windows. */
export const VTT_EVENTS = {
  /** Controller → PlayerView: arbitrary test message. */
  TEST_MESSAGE: 'vtt:test-message',
  /** Controller → PlayerView: active theme changed. */
  THEME_CHANGED: 'vtt:theme-changed',
  /** PlayerView → Controller: PlayerView mounted and listening. */
  PLAYER_READY: 'vtt:player-ready',
  /** Controller → PlayerView: toggle a layer's visibility. */
  LAYER_VISIBILITY: 'vtt:layer-visibility',
  /** Controller → PlayerView: asset URL of the background image to display. */
  BACKGROUND_LOADED: 'vtt:background-loaded',
  /** Controller → PlayerView: partial grid configuration update. */
  GRID_CONFIG: 'vtt:grid-config',
  /** Controller → PlayerView: place or update a token. */
  TOKEN_UPSERT: 'vtt:token-upsert',
  /** Controller → PlayerView: remove a token by id. */
  TOKEN_REMOVE: 'vtt:token-remove',
  /** Controller → PlayerView: place or update an effect. */
  EFFECT_UPSERT: 'vtt:effect-upsert',
  /** Controller → PlayerView: remove an effect by id. */
  EFFECT_REMOVE: 'vtt:effect-remove',
  /** Controller → PlayerView: place or update an AOE marker. */
  AOE_UPSERT: 'vtt:aoe-upsert',
  /** Controller → PlayerView: remove an AOE marker by id. */
  AOE_REMOVE: 'vtt:aoe-remove',
  /** Controller → PlayerView: toggle affected-area grid shading on/off. */
  SHOW_AFFECTED_AREA: 'vtt:show-affected-area',
  /** Controller → PlayerView: show/update token or effect placement ghost. */
  GHOST_TOKEN: 'vtt:ghost-token',
  /** Controller → PlayerView: hide token/effect placement ghost. */
  GHOST_TOKEN_CLEAR: 'vtt:ghost-token-clear',
  /** Controller → PlayerView: show/update AOE placement ghost. */
  GHOST_AOE: 'vtt:ghost-aoe',
  /** Controller → PlayerView: hide AOE placement ghost. */
  GHOST_AOE_CLEAR: 'vtt:ghost-aoe-clear',
  /** PlayerView → Controller: an error occurred in the player window. */
  ERROR_REPORTED: 'vtt:error-reported',
  /** Controller → PlayerView: display a showcase visual with darken overlay. */
  SHOWCASE_SET: 'vtt:showcase-set',
  /** Controller → PlayerView: remove the active showcase visual. */
  SHOWCASE_CLEAR: 'vtt:showcase-clear',
} as const

export type VttEvent = (typeof VTT_EVENTS)[keyof typeof VTT_EVENTS]

export type LayerName = 'background' | 'effects' | 'tokens' | 'grid'

// ---------------------------------------------------------------------------
// Payload shapes
// ---------------------------------------------------------------------------

export interface TestMessagePayload {
  message: string
  timestamp: number
}

export interface ThemeChangedPayload {
  theme: 'light' | 'dark'
}

export interface PlayerReadyPayload {
  windowLabel: string
}

export interface LayerVisibilityPayload {
  layer: LayerName
  visible: boolean
}

export interface BackgroundLoadedPayload {
  /** Asset-protocol URL produced by toAssetUrl(), or empty string to clear. */
  src: string
}

export interface GridConfigPayload {
  color?: number
  opacity?: number
  cellSize?: number
  lineWidth?: number
  originX?: number
  originY?: number
}

export interface TokenRemovePayload {
  id: string
}

export interface EffectRemovePayload {
  id: string
}

export interface AoeRemovePayload {
  id: string
}

export interface ShowAffectedAreaPayload {
  enabled: boolean
}

export interface GhostTokenPayload {
  src: string
  gridX: number
  gridY: number
  size: TokenSize
  /** Defined only for effect ghosts */
  effectShape?: 'square' | 'circle'
  opacity?: number
}

export interface GhostAoePayload {
  shape: AoeShape
  color: AoeColor
  blendMode: AoeBlendMode
  opacity: number
  rotation: number
  radiusFt: number
  widthFt: number
  heightFt: number
  legFt: number
  baseFt: number
  intX: number
  intY: number
}

export interface ErrorReportedPayload {
  /** Short location label, e.g. "BackgroundLayer.load" */
  context: string
  message: string
}

export interface ShowcaseSetPayload {
  src: string
  rotation: number      // 0 | 90 | 180 | 270
  darkenAmount: number  // 0–100
}
