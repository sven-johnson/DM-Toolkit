import Database from '@tauri-apps/plugin-sql'
import type { AoeBlendMode, AoeColor, AoeMarker, AoeShape } from '../shared/types/aoe'
import type { LayerName } from '../shared/types/ipc'
import type { Effect, EffectDef, Token, TokenDef } from '../shared/types/tokens'
import type { GridConfig } from '../store/vttStore'

// ── Types ────────────────────────────────────────────────────────────────────

export interface ScenePresetData {
  backgroundSrc: string
  tokenDefs: TokenDef[]
  tokens: Token[]
  effectDefs: EffectDef[]
  effects: Effect[]
  aoeMarkers: AoeMarker[]
  grid: GridConfig
  layers: Record<LayerName, boolean>
  showAffectedArea: boolean
}

export interface ScenePreset {
  id: string
  name: string
  createdAt: number
  updatedAt: number
  data: ScenePresetData
}

export interface AoePreset {
  id: string
  name: string
  shape: AoeShape
  color: AoeColor
  blendMode: AoeBlendMode
  opacity: number
  radiusFt: number
  widthFt: number
  heightFt: number
  legFt: number
  baseFt: number
  alignTo: 'intersection' | 'center' | 'either'
  rotation: number
}

// ── Database singleton ────────────────────────────────────────────────────────

let _db: Database | null = null

async function getDb(): Promise<Database> {
  if (_db) return _db
  _db = await Database.load('sqlite:vtt-presets.db')
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS scene_presets (
      id         TEXT    PRIMARY KEY,
      name       TEXT    NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      data       TEXT    NOT NULL
    )
  `)
  await _db.execute(`
    CREATE TABLE IF NOT EXISTS aoe_presets (
      id         TEXT    PRIMARY KEY,
      name       TEXT    NOT NULL,
      shape      TEXT    NOT NULL,
      color      TEXT    NOT NULL,
      blend_mode TEXT    NOT NULL,
      opacity    REAL    NOT NULL,
      radius_ft  REAL    NOT NULL,
      width_ft   REAL    NOT NULL,
      height_ft  REAL    NOT NULL,
      leg_ft     REAL    NOT NULL,
      base_ft    REAL    NOT NULL,
      align_to   TEXT    NOT NULL,
      rotation   REAL    NOT NULL
    )
  `)
  return _db
}

// ── Scene presets ─────────────────────────────────────────────────────────────

interface ScenePresetRow {
  id: string
  name: string
  created_at: number
  updated_at: number
  data: string
}

export async function loadScenePresets(): Promise<ScenePreset[]> {
  const db = await getDb()
  const rows = await db.select<ScenePresetRow[]>(
    'SELECT id, name, created_at, updated_at, data FROM scene_presets ORDER BY updated_at DESC',
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
    data: JSON.parse(r.data) as ScenePresetData,
  }))
}

export async function saveScenePreset(id: string, name: string, data: ScenePresetData): Promise<void> {
  const db = await getDb()
  const now = Date.now()
  await db.execute(
    `INSERT INTO scene_presets (id, name, created_at, updated_at, data)
     VALUES (?, ?, ?, ?, ?)`,
    [id, name, now, now, JSON.stringify(data)],
  )
}

export async function deleteScenePreset(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM scene_presets WHERE id = ?', [id])
}

// ── AOE presets ───────────────────────────────────────────────────────────────

interface AoePresetRow {
  id: string
  name: string
  shape: string
  color: string
  blend_mode: string
  opacity: number
  radius_ft: number
  width_ft: number
  height_ft: number
  leg_ft: number
  base_ft: number
  align_to: string
  rotation: number
}

export async function loadAoePresets(): Promise<AoePreset[]> {
  const db = await getDb()
  const rows = await db.select<AoePresetRow[]>(
    'SELECT * FROM aoe_presets ORDER BY name ASC',
  )
  return rows.map((r) => ({
    id: r.id,
    name: r.name,
    shape: r.shape as AoeShape,
    color: r.color as AoeColor,
    blendMode: r.blend_mode as AoeBlendMode,
    opacity: r.opacity,
    radiusFt: r.radius_ft,
    widthFt: r.width_ft,
    heightFt: r.height_ft,
    legFt: r.leg_ft,
    baseFt: r.base_ft,
    alignTo: r.align_to as AoePreset['alignTo'],
    rotation: r.rotation,
  }))
}

export async function saveAoePreset(preset: AoePreset): Promise<void> {
  const db = await getDb()
  await db.execute(
    `INSERT INTO aoe_presets
       (id, name, shape, color, blend_mode, opacity,
        radius_ft, width_ft, height_ft, leg_ft, base_ft, align_to, rotation)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      preset.id, preset.name, preset.shape, preset.color, preset.blendMode,
      preset.opacity, preset.radiusFt, preset.widthFt, preset.heightFt,
      preset.legFt, preset.baseFt, preset.alignTo, preset.rotation,
    ],
  )
}

export async function deleteAoePreset(id: string): Promise<void> {
  const db = await getDb()
  await db.execute('DELETE FROM aoe_presets WHERE id = ?', [id])
}
