import { useCallback, useEffect, useRef, useState } from 'react'
import { emit } from '@tauri-apps/api/event'
import { VTT_EVENTS } from '../../shared/types/ipc'
import type { GhostAoePayload, GhostTokenPayload } from '../../shared/types/ipc'
import { useVttStore } from '../../store/vttStore'
import type { AoeBlendMode, AoeColor, AoeConfig, AoeMarker } from '../../shared/types/aoe'
import { AOE_COLOR_HEX } from '../../shared/types/aoe'
import {
  darkenHexColor,
  getAffectedSquares,
  greyFromHexColor,
} from '../../engine/aoeAffectedSquares'
import type { Effect, EffectDef, Token, TokenDef, TokenSize } from '../../shared/types/tokens'
import { ContextMenu, type ContextItem } from './ContextMenu'

// ── Module-level pure helpers ─────────────────────────────────────────────────

type AoeRenderData = Readonly<{
  shape: string; color: AoeColor; blendMode: AoeBlendMode; rotation: number
  radiusFt: number; widthFt: number; heightFt: number; legFt: number; baseFt: number
  gridX: number; gridY: number
}>

function renderAoeOnCanvas(
  ctx: CanvasRenderingContext2D,
  aoe: AoeRenderData,
  cellSize: number, originX: number, originY: number, scale: number, alpha: number,
  colorOverride?: string,
): void {
  const pxPerFt = (cellSize * scale) / 5
  const snapX = (originX + aoe.gridX * cellSize) * scale
  const snapY = (originY + aoe.gridY * cellSize) * scale
  const colorStr = colorOverride ?? AOE_COLOR_HEX[aoe.color as AoeColor]
  const blendCanvas: GlobalCompositeOperation =
    aoe.blendMode === 'add' ? 'lighter' : aoe.blendMode === 'multiply' ? 'multiply' : 'source-over'
  const rotRad = (aoe.rotation * Math.PI) / 180

  ctx.save()
  ctx.translate(snapX, snapY)
  ctx.rotate(rotRad)

  ctx.beginPath()
  if (aoe.shape === 'circle') {
    ctx.arc(0, 0, aoe.radiusFt * pxPerFt, 0, 2 * Math.PI)
  } else if (aoe.shape === 'rectangle') {
    const w = aoe.widthFt * pxPerFt, h = aoe.heightFt * pxPerFt
    ctx.rect(0, -h, w, h)
  } else {
    const legPx = aoe.legFt * pxPerFt, basePx = aoe.baseFt * pxPerFt
    ctx.moveTo(0, 0); ctx.lineTo(-basePx / 2, legPx); ctx.lineTo(basePx / 2, legPx)
    ctx.closePath()
  }

  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = blendCanvas
  ctx.fillStyle = colorStr
  ctx.fill()
  ctx.globalAlpha = alpha
  ctx.globalCompositeOperation = 'source-over'
  ctx.strokeStyle = '#000000'; ctx.lineWidth = 2
  ctx.stroke()
  ctx.restore()
}

/** Snap to the nearest grid-edge midpoint (0.5 offset in one axis). */
function computeEdgeCenterSnap(
  fullX: number, fullY: number,
  cellSize: number, originX: number, originY: number,
): { intX: number; intY: number } {
  const gx = (fullX - originX) / cellSize
  const gy = (fullY - originY) / cellSize
  // Candidate 1: midpoint of the nearest horizontal edge (x = n+0.5, y = integer)
  const hx = Math.floor(gx) + 0.5, hy = Math.round(gy)
  // Candidate 2: midpoint of the nearest vertical edge (x = integer, y = n+0.5)
  const vx = Math.round(gx), vy = Math.floor(gy) + 0.5
  const hDist = (gx - hx) ** 2 + (gy - hy) ** 2
  const vDist = (gx - vx) ** 2 + (gy - vy) ** 2
  return hDist <= vDist ? { intX: hx, intY: hy } : { intX: vx, intY: vy }
}

/** True when gridX or gridY is a half-integer — indicates an edge-center snap. */
function isEdgeCenterSnap(x: number, y: number): boolean {
  return x % 1 !== 0 || y % 1 !== 0
}

/**
 * For a triangle whose apex is on an edge midpoint, return the rotation that
 * points perpendicularly outward from that edge, nearest to `currentRotation`:
 *   horizontal edge (x = n+0.5) → 0° (down) or 180° (up)
 *   vertical edge   (y = n+0.5) → 90° (right) or 270° (left)
 */
function alignRotationToEdge(intX: number, currentRotation: number): number {
  const norm = ((currentRotation % 360) + 360) % 360
  if (intX % 1 !== 0) {
    // Horizontal edge: perpendicular = down (0°) or up (180°)
    return (norm < 90 || norm >= 270) ? 0 : 180
  }
  // Vertical edge: perpendicular = right (90°) or left (270°)
  return norm < 180 ? 90 : 270
}

/** Effective rotation for the AOE ghost/placement, applying edge alignment when needed. */
function computeAoeRotation(
  shape: string,
  alignTo: 'intersection' | 'center' | 'either',
  intX: number, intY: number,
  currentRotation: number,
): number {
  if (shape !== 'triangle') return currentRotation
  if (alignTo === 'center' || (alignTo === 'either' && isEdgeCenterSnap(intX, intY))) {
    return alignRotationToEdge(intX, currentRotation)
  }
  return currentRotation
}

/** Snap AOE apex to intersection, edge-center, or nearest of both. */
function computeAoeSnap(
  fullX: number, fullY: number,
  cellSize: number, originX: number, originY: number,
  alignTo: 'intersection' | 'center' | 'either' | undefined,
): { intX: number; intY: number } {
  if (alignTo === 'center') return computeEdgeCenterSnap(fullX, fullY, cellSize, originX, originY)
  if (alignTo === 'either') {
    const gx = (fullX - originX) / cellSize
    const gy = (fullY - originY) / cellSize
    const ix = Math.round(gx), iy = Math.round(gy)
    const intDist = (gx - ix) ** 2 + (gy - iy) ** 2
    const edge = computeEdgeCenterSnap(fullX, fullY, cellSize, originX, originY)
    const edgeDist = (gx - edge.intX) ** 2 + (gy - edge.intY) ** 2
    return intDist <= edgeDist ? { intX: ix, intY: iy } : edge
  }
  return {
    intX: Math.round((fullX - originX) / cellSize),
    intY: Math.round((fullY - originY) / cellSize),
  }
}

function hitTestAoeAt(
  aoe: AoeMarker, fullX: number, fullY: number, cellSize: number, originX: number, originY: number,
): boolean {
  const pxPerFt = cellSize / 5
  const snapX = originX + aoe.gridX * cellSize
  const snapY = originY + aoe.gridY * cellSize
  const dx = fullX - snapX, dy = fullY - snapY
  const rad = (-aoe.rotation * Math.PI) / 180
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad)
  if (aoe.shape === 'circle') {
    const r = aoe.radiusFt * pxPerFt; return lx * lx + ly * ly <= r * r
  }
  if (aoe.shape === 'rectangle') {
    const w = aoe.widthFt * pxPerFt, h = aoe.heightFt * pxPerFt
    return lx >= 0 && lx <= w && ly >= -h && ly <= 0
  }
  const h = aoe.legFt * pxPerFt, b = aoe.baseFt * pxPerFt
  if (ly < 0 || ly > h) return false
  return Math.abs(lx) <= (b / 2) * (ly / h)
}

// ── Interfaces ────────────────────────────────────────────────────────────────

interface MoveDrag {
  entity: Token | Effect; type: 'token' | 'effect'
  gridOffsetX: number; gridOffsetY: number
  currentGridX: number; currentGridY: number
}

interface AoeDrag {
  marker: AoeMarker
  offsetIntX: number; offsetIntY: number
  currentIntX: number; currentIntY: number
}

interface DropPreview { gridX: number; gridY: number; size: TokenSize; isCircle: boolean }
interface GhostPos { gridX: number; gridY: number }
interface AoeGhost { intX: number; intY: number }

interface Props {
  playerReady: boolean
  activeDef: TokenDef | EffectDef | null
  activeType: 'token' | 'effect' | null
  onDeactivate: () => void
  activeAoe: AoeConfig | null
  onAoeDeactivate: () => void
  stageRotation: 0 | 90 | 180 | 270
}

export function StageMap({
  playerReady, activeDef, activeType, onDeactivate, activeAoe, onAoeDeactivate, stageRotation,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef    = useRef<HTMLCanvasElement>(null)

  const tokens       = useVttStore((s) => s.tokens)
  const effects      = useVttStore((s) => s.effects)
  const tokenDefs    = useVttStore((s) => s.tokenDefs)
  const effectDefs   = useVttStore((s) => s.effectDefs)
  const tokenOutlineThicknessPx = useVttStore((s) => s.tokenOutlineThicknessPx)
  const aoeMarkers        = useVttStore((s) => s.aoeMarkers)
  const showAffectedArea  = useVttStore((s) => s.showAffectedArea)
  const grid              = useVttStore((s) => s.grid)
  const tvDimensions = useVttStore((s) => s.tvDimensions)
  const backgroundSrc = useVttStore((s) => s.backgroundSrc)
  const showcaseDefs   = useVttStore((s) => s.showcaseDefs)
  const activeShowcase = useVttStore((s) => s.activeShowcase)

  const [mapW, setMapW] = useState(300)
  const tvAspect = (tvDimensions.height || 1080) / (tvDimensions.width || 1920)
  const mapH  = Math.round(mapW * tvAspect)
  const scale = mapW / (tvDimensions.width || 1920)

  useEffect(() => {
    const el = containerRef.current; if (!el) return
    const ro = new ResizeObserver(([entry]) => {
      const w = Math.floor(entry.contentRect.width); if (w > 0) setMapW(w)
    })
    ro.observe(el); return () => ro.disconnect()
  }, [])

  const imgCache  = useRef<Map<string, HTMLImageElement | 'loading'>>(new Map())
  const moveDrag  = useRef<MoveDrag | null>(null)
  const aoeDrag   = useRef<AoeDrag | null>(null)

  // ── Active entity selection ────────────────────────────────────────────────
  type ActiveEntity = { id: string; type: 'token' | 'effect' | 'aoe' }
  const [activeEntity, setActiveEntity] = useState<ActiveEntity | null>(null)

  const [dropPreview, setDropPreview] = useState<DropPreview | null>(null)
  const [ghostPos,    setGhostPos]    = useState<GhostPos | null>(null)
  const [aoeGhost,    setAoeGhost]    = useState<AoeGhost | null>(null)
  const [contextMenu, setContextMenu] = useState<{ item: ContextItem; x: number; y: number } | null>(null)
  const [drawTick,    setDrawTick]    = useState(0)

  // Refs for IPC ghost deduplication
  const lastTokenGhostPos = useRef<{ gridX: number; gridY: number } | null>(null)
  const lastAoeGhostPos   = useRef<{ intX: number; intY: number } | null>(null)

  // Tracks the timestamp of the last rotation so the wheel cooldown can be applied
  const lastRotationRef = useRef(0)

  const rotationCooldownMs = useVttStore((s) => s.rotationCooldownMs)

  // Ref snapshot for native event handlers (wheel)
  const wheelRef = useRef({ playerReady, mapW, mapH, scale, grid: grid, activeEntity: null as ActiveEntity | null, cooldownMs: rotationCooldownMs })
  useEffect(() => { wheelRef.current = { playerReady, mapW, mapH, scale, grid, activeEntity, cooldownMs: rotationCooldownMs } })

  // Escape clears active selection
  useEffect(() => {
    if (!activeEntity) return
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') setActiveEntity(null) }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [activeEntity])

  // ── Image cache ──────────────────────────────────────────────────────────

  const triggerDraw = useCallback(() => setDrawTick((n) => n + 1), [])

  function getImage(src: string): HTMLImageElement | null {
    const hit = imgCache.current.get(src)
    if (hit && hit !== 'loading') return hit
    if (!hit) {
      imgCache.current.set(src, 'loading')
      const img = new Image()
      img.onload = () => { imgCache.current.set(src, img); triggerDraw() }
      img.src = src
    }
    return null
  }

  useEffect(() => {
    tokenDefs.forEach((d) => getImage(d.src))
    effectDefs.forEach((d) => getImage(d.src))
    showcaseDefs.forEach((d) => getImage(d.src))
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokenDefs, effectDefs, showcaseDefs])

  useEffect(() => { if (backgroundSrc) getImage(backgroundSrc)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [backgroundSrc])

  useEffect(() => { if (activeDef) getImage(activeDef.src)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeDef])

  useEffect(() => { if (!activeDef) setGhostPos(null) }, [activeDef])
  useEffect(() => { if (!activeAoe) setAoeGhost(null) }, [activeAoe])

  // Emit ghost CLEAR to PlayerView when placement modes end
  useEffect(() => {
    if (!activeDef) {
      lastTokenGhostPos.current = null
      if (playerReady) void emit(VTT_EVENTS.GHOST_TOKEN_CLEAR, null)
    }
  }, [activeDef, playerReady])

  useEffect(() => {
    if (!activeAoe) {
      lastAoeGhostPos.current = null
      if (playerReady) void emit(VTT_EVENTS.GHOST_AOE_CLEAR, null)
    }
  }, [activeAoe, playerReady])

  // Click outside canvas → deactivate
  useEffect(() => {
    if (!activeDef) return
    function onDocMouseDown(e: MouseEvent) {
      if (canvasRef.current && !canvasRef.current.contains(e.target as Node)) onDeactivate()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [activeDef, onDeactivate])

  useEffect(() => {
    if (!activeAoe) return
    function onDocMouseDown(e: MouseEvent) {
      if (canvasRef.current && !canvasRef.current.contains(e.target as Node)) onAoeDeactivate()
    }
    document.addEventListener('mousedown', onDocMouseDown)
    return () => document.removeEventListener('mousedown', onDocMouseDown)
  }, [activeAoe, onAoeDeactivate])

  // ── Mouse wheel rotation ──────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return

    function rotateToken(token: Token, dir: number, playerReady: boolean) {
      const updated: Token = { ...token, rotation: ((token.rotation ?? 0) + dir * 90 + 360) % 360 }
      useVttStore.getState().upsertToken(updated)
      if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, updated)
      setDrawTick((n) => n + 1)
    }

    function rotateAoe(aoe: AoeMarker, dir: number, playerReady: boolean) {
      if (aoe.shape === 'circle') return
      const onEdgeCenter = aoe.shape === 'triangle' && isEdgeCenterSnap(aoe.gridX, aoe.gridY)
      const useCenterRotation = onEdgeCenter && (aoe.alignTo === 'center' || aoe.alignTo === 'either')
      const step = useCenterRotation ? 180 : aoe.shape === 'triangle' ? 45 : 90
      let newRotation = ((aoe.rotation + dir * step) + 360) % 360
      if (useCenterRotation) newRotation = alignRotationToEdge(aoe.gridX, newRotation)
      const updated: AoeMarker = { ...aoe, rotation: newRotation }
      useVttStore.getState().upsertAoeMarker(updated)
      if (playerReady) void emit(VTT_EVENTS.AOE_UPSERT, updated)
      setDrawTick((n) => n + 1)
    }

    function onWheel(e: WheelEvent) {
      e.preventDefault()
      const { playerReady, mapW, mapH, scale, grid, activeEntity, cooldownMs } = wheelRef.current
      const now = Date.now()
      if (now - lastRotationRef.current < cooldownMs) return
      lastRotationRef.current = now
      const { cellSize, originX, originY } = grid
      const { tokens, aoeMarkers } = useVttStore.getState()
      const dir = e.deltaY > 0 ? 1 : -1  // 1 = clockwise (scroll down)

      // ── Active entity has priority: rotate regardless of cursor position ──
      if (activeEntity) {
        if (activeEntity.type === 'token') {
          const t = tokens.find((t) => t.id === activeEntity.id)
          if (t) rotateToken(t, dir, playerReady)
        } else if (activeEntity.type === 'aoe') {
          const a = aoeMarkers.find((a) => a.id === activeEntity.id)
          if (a) rotateAoe(a, dir, playerReady)
        }
        // effects: no rotation
        return
      }

      // ── Fallback: hover-based rotation ────────────────────────────────────
      const r = canvas!.getBoundingClientRect()
      const fullX = ((e.clientX - r.left) * (mapW / r.width)) / scale
      const fullY = ((e.clientY - r.top)  * (mapH / r.height)) / scale

      const gx = Math.floor((fullX - originX) / cellSize)
      const gy = Math.floor((fullY - originY) / cellSize)
      const token = tokens.find(
        (t) => gx >= t.gridX && gx < t.gridX + t.size && gy >= t.gridY && gy < t.gridY + t.size,
      )
      if (token) { rotateToken(token, dir, playerReady); return }

      for (let i = aoeMarkers.length - 1; i >= 0; i--) {
        const aoe = aoeMarkers[i]
        if (!hitTestAoeAt(aoe, fullX, fullY, cellSize, originX, originY)) continue
        rotateAoe(aoe, dir, playerReady); return
      }
    }

    canvas.addEventListener('wheel', onWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', onWheel)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // ── Canvas drawing ────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d'); if (!ctx) return

    const { cellSize, originX, originY, color, lineWidth, opacity } = grid
    const cellPreview = cellSize * scale

    ctx.clearRect(0, 0, mapW, mapH)
    ctx.fillStyle = '#111318'
    ctx.fillRect(0, 0, mapW, mapH)

    // Background image (cover-scaled)
    const bgImg = backgroundSrc ? getImage(backgroundSrc) : null
    if (bgImg) {
      const ia = bgImg.naturalWidth / bgImg.naturalHeight
      const ma = mapW / mapH
      let sx = 0, sy = 0, sw = bgImg.naturalWidth, sh = bgImg.naturalHeight
      if (ia > ma) { sw = Math.round(sh * ma); sx = Math.round((bgImg.naturalWidth - sw) / 2) }
      else { sh = Math.round(sw / ma); sy = Math.round((bgImg.naturalHeight - sh) / 2) }
      ctx.drawImage(bgImg, sx, sy, sw, sh, 0, 0, mapW, mapH)
    }

    // AOE markers (skip the one being dragged)
    const draggingAoeId = aoeDrag.current?.marker.id
    for (const aoe of aoeMarkers) {
      if (aoe.id === draggingAoeId) continue
      if (showAffectedArea) {
        const hex = AOE_COLOR_HEX[aoe.color]
        const grey = greyFromHexColor(hex)
        const dark = darkenHexColor(hex)
        const blendCanvas: GlobalCompositeOperation =
          aoe.blendMode === 'add' ? 'lighter' : aoe.blendMode === 'multiply' ? 'multiply' : 'source-over'
        // 1. Grey shape (partial squares will show the grey AOE intersection)
        renderAoeOnCanvas(ctx, aoe, cellSize, originX, originY, scale, aoe.opacity, grey)
        // 2. Darkened solid fill for squares that are ≥50% covered
        const squares = getAffectedSquares(aoe)
        ctx.globalAlpha = aoe.opacity
        ctx.globalCompositeOperation = blendCanvas
        ctx.fillStyle = dark
        for (const sq of squares) {
          if (!sq.affected) continue
          ctx.fillRect(
            (originX + sq.cellX * cellSize) * scale,
            (originY + sq.cellY * cellSize) * scale,
            cellSize * scale, cellSize * scale,
          )
        }
        ctx.globalAlpha = 1
        ctx.globalCompositeOperation = 'source-over'
      } else {
        renderAoeOnCanvas(ctx, aoe, cellSize, originX, originY, scale, aoe.opacity)
      }
    }
    if (aoeDrag.current) {
      const { marker, currentIntX, currentIntY } = aoeDrag.current
      renderAoeOnCanvas(ctx, { ...marker, gridX: currentIntX, gridY: currentIntY },
        cellSize, originX, originY, scale, 0.55)
    }

    // Active AOE highlight — dashed accent outline over the shape
    if (activeEntity?.type === 'aoe') {
      const aoe = aoeMarkers.find((a) => a.id === activeEntity.id)
      if (aoe) {
        const pxPerFt = (cellSize * scale) / 5
        const snapX = (originX + aoe.gridX * cellSize) * scale
        const snapY = (originY + aoe.gridY * cellSize) * scale
        ctx.save()
        ctx.translate(snapX, snapY)
        ctx.rotate((aoe.rotation * Math.PI) / 180)
        ctx.beginPath()
        if (aoe.shape === 'circle') {
          ctx.arc(0, 0, aoe.radiusFt * pxPerFt, 0, 2 * Math.PI)
        } else if (aoe.shape === 'rectangle') {
          const w = aoe.widthFt * pxPerFt, h = aoe.heightFt * pxPerFt
          ctx.rect(0, -h, w, h)
        } else {
          const lp = aoe.legFt * pxPerFt, bp = aoe.baseFt * pxPerFt
          ctx.moveTo(0, 0); ctx.lineTo(-bp / 2, lp); ctx.lineTo(bp / 2, lp); ctx.closePath()
        }
        ctx.strokeStyle = '#7c4bff'; ctx.lineWidth = 3
        ctx.setLineDash([5, 3]); ctx.globalAlpha = 0.9
        ctx.globalCompositeOperation = 'source-over'
        ctx.stroke(); ctx.setLineDash([]); ctx.restore()
      }
    }

    // Placed effects
    for (const effect of effects) {
      const img = getImage(effect.src)
      const sizePx = effect.size * cellPreview
      let ex: number, ey: number
      if (effect.shape === 'circle') {
        ex = (originX + effect.gridX * cellSize) * scale - sizePx / 2
        ey = (originY + effect.gridY * cellSize) * scale - sizePx / 2
      } else {
        ex = (originX + effect.gridX * cellSize) * scale
        ey = (originY + effect.gridY * cellSize) * scale
      }
      ctx.globalAlpha = effect.opacity
      if (img) ctx.drawImage(img, ex, ey, sizePx, sizePx)
      else { ctx.fillStyle = '#44aaff'; ctx.fillRect(ex, ey, sizePx, sizePx) }
      ctx.globalAlpha = 1
      if (activeEntity?.id === effect.id && activeEntity?.type === 'effect') {
        ctx.strokeStyle = '#7c4bff'; ctx.lineWidth = 2.5
        ctx.setLineDash([5, 3]); ctx.strokeRect(ex + 1, ey + 1, sizePx - 2, sizePx - 2); ctx.setLineDash([])
      }
    }

    // Build defId groups for A/B/C badges
    const defIdGroups = new Map<string, string[]>()
    for (const token of tokens) {
      const arr = defIdGroups.get(token.defId) ?? []; arr.push(token.id)
      defIdGroups.set(token.defId, arr)
    }

    // Placed tokens
    const draggingEntityId = moveDrag.current?.entity.id
    for (const token of tokens) {
      if (token.id === draggingEntityId) continue
      const img = getImage(token.src)
      const sizePx = token.size * cellPreview
      const tx = (originX + token.gridX * cellSize) * scale
      const ty = (originY + token.gridY * cellSize) * scale
      const cx = tx + sizePx / 2, cy = ty + sizePx / 2
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(((token.rotation ?? 0) * Math.PI) / 180)
      if (img) ctx.drawImage(img, -sizePx / 2, -sizePx / 2, sizePx, sizePx)
      else { ctx.fillStyle = '#ff8844'; ctx.fillRect(-sizePx / 2, -sizePx / 2, sizePx, sizePx) }

      // Token outline
      if (token.outlineColor && tokenOutlineThicknessPx > 0) {
        ctx.strokeStyle = token.outlineColor
        ctx.lineWidth = tokenOutlineThicknessPx * scale
        ctx.globalAlpha = 1
        const half = sizePx / 2
        ctx.beginPath()
        if (token.outlineShape === 'circle') {
          ctx.arc(0, 0, half, 0, 2 * Math.PI)
        } else if (token.outlineShape === 'rounded') {
          const r = half * 0.3
          ctx.roundRect(-half, -half, sizePx, sizePx, r)
        } else {
          ctx.rect(-half, -half, sizePx, sizePx)
        }
        ctx.stroke()
      }
      ctx.restore()

      // Badge: centered on the top-right grid intersection of the token's footprint
      const group = defIdGroups.get(token.defId)
      if (group && group.length > 1) {
        const letterIdx = group.indexOf(token.id)
        if (letterIdx >= 0) {
          const letter = String.fromCharCode(65 + letterIdx)
          const badgeR = Math.max(6, Math.round(cellPreview * 0.13))
          const bx = tx + sizePx   // top-right intersection (gridX + size, gridY)
          const by = ty
          ctx.beginPath(); ctx.arc(bx, by, badgeR, 0, 2 * Math.PI)
          ctx.fillStyle = '#000000'; ctx.fill()
          ctx.save()
          ctx.translate(bx, by)
          ctx.rotate(-(stageRotation * Math.PI) / 180)  // keep text upright
          ctx.font = `bold ${Math.max(6, Math.round(badgeR * 1.2))}px sans-serif`
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
          ctx.fillStyle = '#ffffff'; ctx.fillText(letter, 0, 0)
          ctx.restore()
        }
      }
      // Active-selection highlight
      if (activeEntity?.id === token.id && activeEntity?.type === 'token') {
        ctx.strokeStyle = '#7c4bff'; ctx.lineWidth = 2.5
        ctx.setLineDash([5, 3]); ctx.strokeRect(tx + 1, ty + 1, sizePx - 2, sizePx - 2); ctx.setLineDash([])
      }
    }

    // Grid — drawn on top of entities to match the player view layer order
    if (cellPreview >= 1) {
      const startX = ((originX * scale) % cellPreview + cellPreview) % cellPreview
      const startY = ((originY * scale) % cellPreview + cellPreview) % cellPreview
      const hexColor = `#${color.toString(16).padStart(6, '0')}`
      ctx.beginPath()
      for (let x = startX; x <= mapW; x += cellPreview) { ctx.moveTo(x, 0); ctx.lineTo(x, mapH) }
      for (let y = startY; y <= mapH; y += cellPreview) { ctx.moveTo(0, y); ctx.lineTo(mapW, y) }
      ctx.strokeStyle = hexColor; ctx.lineWidth = Math.max(0.5, lineWidth * scale)
      ctx.globalAlpha = opacity; ctx.stroke(); ctx.globalAlpha = 1
    }

    // Showcase — darken overlay + fit-to-canvas art (above grid, same as player view)
    if (activeShowcase) {
      const def = showcaseDefs.find((d) => d.id === activeShowcase.defId)
      // Darken overlay
      ctx.globalAlpha = activeShowcase.darkenAmount / 100
      ctx.fillStyle = '#000000'
      ctx.fillRect(0, 0, mapW, mapH)
      ctx.globalAlpha = 1
      // Showcase image
      if (def) {
        const img = getImage(def.src)
        if (img) {
          const rotDeg = activeShowcase.rotation
          const isSwapped = rotDeg === 90 || rotDeg === 270
          const effectiveW = isSwapped ? img.naturalHeight : img.naturalWidth
          const effectiveH = isSwapped ? img.naturalWidth : img.naturalHeight
          const sc = Math.min(mapW / effectiveW, mapH / effectiveH)
          ctx.save()
          ctx.translate(mapW / 2, mapH / 2)
          ctx.rotate((rotDeg * Math.PI) / 180)
          ctx.drawImage(img, -img.naturalWidth * sc / 2, -img.naturalHeight * sc / 2, img.naturalWidth * sc, img.naturalHeight * sc)
          ctx.restore()
        }
      }
    }

    // Entity move-drag ghost
    if (moveDrag.current) {
      const { entity, type, currentGridX, currentGridY } = moveDrag.current
      const img = getImage(entity.src); const sizePx = entity.size * cellPreview
      let gx: number, gy: number
      if (type === 'effect' && (entity as Effect).shape === 'circle') {
        gx = (originX + currentGridX * cellSize) * scale - sizePx / 2
        gy = (originY + currentGridY * cellSize) * scale - sizePx / 2
      } else {
        gx = (originX + currentGridX * cellSize) * scale
        gy = (originY + currentGridY * cellSize) * scale
      }
      ctx.globalAlpha = 0.6
      if (img) ctx.drawImage(img, gx, gy, sizePx, sizePx)
      else { ctx.fillStyle = '#aaaaaa'; ctx.fillRect(gx, gy, sizePx, sizePx) }
      ctx.globalAlpha = 1
    }

    // Token/effect placement ghost
    if (activeDef && ghostPos) {
      const img = getImage(activeDef.src)
      const isCircle = activeType === 'effect' && (activeDef as EffectDef).shape === 'circle'
      const sizePx = activeDef.defaultSize * cellPreview
      let gx: number, gy: number
      if (isCircle) {
        gx = (originX + ghostPos.gridX * cellSize) * scale - sizePx / 2
        gy = (originY + ghostPos.gridY * cellSize) * scale - sizePx / 2
      } else {
        gx = (originX + ghostPos.gridX * cellSize) * scale
        gy = (originY + ghostPos.gridY * cellSize) * scale
      }
      ctx.globalAlpha = 0.75
      if (img) ctx.drawImage(img, gx, gy, sizePx, sizePx)
      else { ctx.fillStyle = activeType === 'effect' ? '#44aaff' : '#ff8844'; ctx.fillRect(gx, gy, sizePx, sizePx) }
      ctx.globalAlpha = 1
      ctx.strokeStyle = 'var(--accent, #7c4bff)'; ctx.lineWidth = 2
      ctx.setLineDash([4, 3]); ctx.strokeRect(gx + 1, gy + 1, sizePx - 2, sizePx - 2); ctx.setLineDash([])
    }

    // AOE placement ghost
    if (activeAoe && aoeGhost) {
      const ghostRotation = computeAoeRotation(
        activeAoe.shape, activeAoe.alignTo, aoeGhost.intX, aoeGhost.intY, activeAoe.rotation,
      )
      renderAoeOnCanvas(ctx, { ...activeAoe, gridX: aoeGhost.intX, gridY: aoeGhost.intY, rotation: ghostRotation },
        cellSize, originX, originY, scale, 0.45)
      const snapX = (originX + aoeGhost.intX * cellSize) * scale
      const snapY = (originY + aoeGhost.intY * cellSize) * scale
      ctx.strokeStyle = 'var(--accent, #7c4bff)'; ctx.lineWidth = 1.5
      ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.arc(snapX, snapY, 5, 0, 2 * Math.PI)
      ctx.stroke(); ctx.setLineDash([])
    }

    // Drag-and-drop preview
    if (dropPreview) {
      const { gridX, gridY, size, isCircle } = dropPreview; const sizePx = size * cellPreview
      let px: number, py: number
      if (isCircle) { px = (originX + gridX * cellSize) * scale - sizePx / 2; py = (originY + gridY * cellSize) * scale - sizePx / 2 }
      else { px = (originX + gridX * cellSize) * scale; py = (originY + gridY * cellSize) * scale }
      ctx.globalAlpha = 0.45; ctx.fillStyle = '#ffffff'; ctx.fillRect(px, py, sizePx, sizePx)
      ctx.globalAlpha = 1; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 1; ctx.strokeRect(px, py, sizePx, sizePx)
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tokens, effects, aoeMarkers, showAffectedArea, grid, tvDimensions, backgroundSrc,
      activeEntity, dropPreview, ghostPos, aoeGhost, activeDef, activeType, activeAoe,
      showcaseDefs, activeShowcase, mapW, mapH, drawTick, stageRotation, tokenOutlineThicknessPx, tokenDefs])

  // ── Coordinate helpers ────────────────────────────────────────────────────

  function mouseToFull(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    const cx = r.left + r.width / 2
    const cy = r.top + r.height / 2
    const dx = e.clientX - cx
    const dy = e.clientY - cy
    // Inverse-rotate to recover canvas-local offset
    let cdx: number, cdy: number
    if      (stageRotation === 90)  { cdx =  dy; cdy = -dx }
    else if (stageRotation === 180) { cdx = -dx; cdy = -dy }
    else if (stageRotation === 270) { cdx = -dy; cdy =  dx }
    else                            { cdx =  dx; cdy =  dy }
    return {
      fullX: (mapW / 2 + cdx) / scale,
      fullY: (mapH / 2 + cdy) / scale,
    }
  }

  function fullToGrid(fullX: number, fullY: number, snapRound = false) {
    const { cellSize, originX, originY } = grid
    const fn = snapRound ? Math.round : Math.floor
    return { gridX: fn((fullX - originX) / cellSize), gridY: fn((fullY - originY) / cellSize) }
  }

  function findEntityAt(gridX: number, gridY: number): { entity: Token | Effect; type: 'token' | 'effect' } | null {
    const token = tokens.find((t) => gridX >= t.gridX && gridX < t.gridX + t.size && gridY >= t.gridY && gridY < t.gridY + t.size)
    if (token) return { entity: token, type: 'token' }
    const effect = effects.find((e) => {
      if (e.shape === 'circle') { const half = e.size / 2; return Math.abs(gridX - e.gridX) < half && Math.abs(gridY - e.gridY) < half }
      return gridX >= e.gridX && gridX < e.gridX + e.size && gridY >= e.gridY && gridY < e.gridY + e.size
    })
    return effect ? { entity: effect, type: 'effect' } : null
  }

  function findAoeAt(fullX: number, fullY: number): AoeMarker | null {
    const { cellSize, originX, originY } = grid
    for (let i = aoeMarkers.length - 1; i >= 0; i--) {
      if (hitTestAoeAt(aoeMarkers[i], fullX, fullY, cellSize, originX, originY)) return aoeMarkers[i]
    }
    return null
  }

  // ── Place helpers ─────────────────────────────────────────────────────────

  function placeEntity(def: TokenDef | EffectDef, type: 'token' | 'effect', gridX: number, gridY: number) {
    const safeX = Math.max(0, gridX), safeY = Math.max(0, gridY)
    if (type === 'token') {
      const d = def as TokenDef
      const token: Token = {
        id: crypto.randomUUID(), defId: d.id, name: d.name, src: d.src,
        gridX: safeX, gridY: safeY, size: d.defaultSize,
        outlineColor: '#000000', outlineShape: d.shape ?? 'square',
      }
      useVttStore.getState().upsertToken(token); if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, token)
    } else {
      const d = def as EffectDef
      const effect: Effect = { id: crypto.randomUUID(), defId: d.id, name: d.name, src: d.src, gridX: safeX, gridY: safeY, size: d.defaultSize, opacity: d.defaultOpacity, shape: d.shape }
      useVttStore.getState().upsertEffect(effect); if (playerReady) void emit(VTT_EVENTS.EFFECT_UPSERT, effect)
    }
  }

  function placeAoe(intX: number, intY: number) {
    if (!activeAoe) return
    const rotation = computeAoeRotation(activeAoe.shape, activeAoe.alignTo, intX, intY, activeAoe.rotation)
    const aoe: AoeMarker = { ...activeAoe, id: crypto.randomUUID(), gridX: intX, gridY: intY, rotation }
    useVttStore.getState().upsertAoeMarker(aoe); if (playerReady) void emit(VTT_EVENTS.AOE_UPSERT, aoe)
  }

  // ── Drag-and-drop from TokenPanel ─────────────────────────────────────────

  function handleDragOver(e: React.DragEvent<HTMLCanvasElement>) {
    e.preventDefault()
    const raw = e.dataTransfer.getData('application/vtt'); if (!raw) return
    const { defId, type } = JSON.parse(raw) as { defId: string; type: 'token' | 'effect' }
    const def = type === 'token' ? tokenDefs.find((d) => d.id === defId) : effectDefs.find((d) => d.id === defId)
    if (!def) return
    const r = e.currentTarget.getBoundingClientRect()
    const fullX = ((e.clientX - r.left) * (mapW / r.width)) / scale
    const fullY = ((e.clientY - r.top)  * (mapH / r.height)) / scale
    const isCircle = type === 'effect' && (def as EffectDef).shape === 'circle'
    const { gridX, gridY } = fullToGrid(fullX, fullY, isCircle)
    setDropPreview({ gridX, gridY, size: def.defaultSize, isCircle })
  }

  function handleDragLeave() { setDropPreview(null) }

  function handleDrop(e: React.DragEvent<HTMLCanvasElement>) {
    e.preventDefault(); setDropPreview(null)
    const raw = e.dataTransfer.getData('application/vtt'); if (!raw) return
    const { defId, type } = JSON.parse(raw) as { defId: string; type: 'token' | 'effect' }
    const r = e.currentTarget.getBoundingClientRect()
    const fullX = ((e.clientX - r.left) * (mapW / r.width)) / scale
    const fullY = ((e.clientY - r.top)  * (mapH / r.height)) / scale
    if (type === 'token') {
      const def = tokenDefs.find((d) => d.id === defId); if (!def) return
      placeEntity(def, 'token', ...Object.values(fullToGrid(fullX, fullY, false)) as [number, number])
    } else {
      const def = effectDefs.find((d) => d.id === defId) as EffectDef | undefined; if (!def) return
      placeEntity(def, 'effect', ...Object.values(fullToGrid(fullX, fullY, def.shape === 'circle')) as [number, number])
    }
  }

  // ── Mouse events ──────────────────────────────────────────────────────────

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    const { fullX, fullY } = mouseToFull(e)

    if (activeDef && activeType) {
      const isCircle = activeType === 'effect' && (activeDef as EffectDef).shape === 'circle'
      const { gridX, gridY } = fullToGrid(fullX, fullY, isCircle)
      setGhostPos((prev) => prev?.gridX === gridX && prev?.gridY === gridY ? prev : { gridX, gridY })

      // Emit live ghost to PlayerView when grid cell changes
      if (playerReady) {
        const last = lastTokenGhostPos.current
        if (!last || last.gridX !== gridX || last.gridY !== gridY) {
          lastTokenGhostPos.current = { gridX, gridY }
          const payload: GhostTokenPayload = {
            src: activeDef.src, gridX, gridY, size: activeDef.defaultSize,
            effectShape: activeType === 'effect' ? (activeDef as EffectDef).shape : undefined,
            opacity: activeType === 'effect' ? (activeDef as EffectDef).defaultOpacity : undefined,
          }
          void emit(VTT_EVENTS.GHOST_TOKEN, payload)
        }
      }
      return
    }

    if (activeAoe) {
      const { cellSize, originX, originY } = grid
      const { intX, intY } = computeAoeSnap(fullX, fullY, cellSize, originX, originY, activeAoe.alignTo)
      setAoeGhost((prev) => prev?.intX === intX && prev?.intY === intY ? prev : { intX, intY })

      if (playerReady) {
        const last = lastAoeGhostPos.current
        if (!last || last.intX !== intX || last.intY !== intY) {
          lastAoeGhostPos.current = { intX, intY }
          const ghostRotation = computeAoeRotation(activeAoe.shape, activeAoe.alignTo, intX, intY, activeAoe.rotation)
          const payload: GhostAoePayload = { ...activeAoe, rotation: ghostRotation, intX, intY }
          void emit(VTT_EVENTS.GHOST_AOE, payload)
        }
      }
      return
    }

    if (moveDrag.current) {
      const isCircle = moveDrag.current.type === 'effect' && (moveDrag.current.entity as Effect).shape === 'circle'
      const { gridX, gridY } = fullToGrid(fullX, fullY, isCircle)
      const newX = Math.max(0, gridX - moveDrag.current.gridOffsetX)
      const newY = Math.max(0, gridY - moveDrag.current.gridOffsetY)
      if (newX !== moveDrag.current.currentGridX || newY !== moveDrag.current.currentGridY) {
        moveDrag.current.currentGridX = newX; moveDrag.current.currentGridY = newY; triggerDraw()
      }
      return
    }

    if (aoeDrag.current) {
      const { cellSize, originX, originY } = grid
      const { intX, intY } = computeAoeSnap(fullX, fullY, cellSize, originX, originY, aoeDrag.current.marker.alignTo)
      const newIntX = Math.max(0, intX - aoeDrag.current.offsetIntX)
      const newIntY = Math.max(0, intY - aoeDrag.current.offsetIntY)
      if (newIntX !== aoeDrag.current.currentIntX || newIntY !== aoeDrag.current.currentIntY) {
        aoeDrag.current.currentIntX = newIntX; aoeDrag.current.currentIntY = newIntY; triggerDraw()
      }
    }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    if (e.button !== 0) return
    const { fullX, fullY } = mouseToFull(e)

    if (activeDef && activeType) {
      const isCircle = activeType === 'effect' && (activeDef as EffectDef).shape === 'circle'
      const { gridX, gridY } = fullToGrid(fullX, fullY, isCircle)
      placeEntity(activeDef, activeType, gridX, gridY); return
    }

    if (activeAoe) {
      const { cellSize, originX, originY } = grid
      const { intX, intY } = computeAoeSnap(fullX, fullY, cellSize, originX, originY, activeAoe.alignTo)
      placeAoe(intX, intY); return
    }

    const { gridX, gridY } = fullToGrid(fullX, fullY)
    const hit = findEntityAt(gridX, gridY)
    if (hit) {
      const { entity, type } = hit
      setActiveEntity({ id: entity.id, type })
      moveDrag.current = { entity, type, gridOffsetX: gridX - entity.gridX, gridOffsetY: gridY - entity.gridY, currentGridX: entity.gridX, currentGridY: entity.gridY }
      return
    }

    const aoe = findAoeAt(fullX, fullY)
    if (aoe) {
      setActiveEntity({ id: aoe.id, type: 'aoe' })
      const { cellSize, originX, originY } = grid
      const { intX, intY } = computeAoeSnap(fullX, fullY, cellSize, originX, originY, aoe.alignTo)
      aoeDrag.current = { marker: aoe, offsetIntX: intX - aoe.gridX, offsetIntY: intY - aoe.gridY, currentIntX: aoe.gridX, currentIntY: aoe.gridY }
      return
    }

    // Clicked empty space — deselect
    setActiveEntity(null)
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    const drag = moveDrag.current
    if (drag) {
      moveDrag.current = null
      const { entity, type, currentGridX, currentGridY } = drag
      if (type === 'token') {
        const updated: Token = { ...(entity as Token), gridX: currentGridX, gridY: currentGridY }
        useVttStore.getState().upsertToken(updated); if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, updated)
      } else {
        const updated: Effect = { ...(entity as Effect), gridX: currentGridX, gridY: currentGridY }
        useVttStore.getState().upsertEffect(updated); if (playerReady) void emit(VTT_EVENTS.EFFECT_UPSERT, updated)
      }
      triggerDraw(); e.preventDefault(); return
    }

    const aDrag = aoeDrag.current
    if (aDrag) {
      aoeDrag.current = null
      const updated: AoeMarker = { ...aDrag.marker, gridX: aDrag.currentIntX, gridY: aDrag.currentIntY }
      useVttStore.getState().upsertAoeMarker(updated); if (playerReady) void emit(VTT_EVENTS.AOE_UPSERT, updated)
      triggerDraw(); e.preventDefault()
    }
  }

  function handleMouseLeave() {
    moveDrag.current = null; aoeDrag.current = null
    setGhostPos(null); setAoeGhost(null)
    if (playerReady) {
      void emit(VTT_EVENTS.GHOST_TOKEN_CLEAR, null)
      void emit(VTT_EVENTS.GHOST_AOE_CLEAR, null)
    }
    lastTokenGhostPos.current = null; lastAoeGhostPos.current = null
  }

  function handleContextMenu(e: React.MouseEvent<HTMLCanvasElement>) {
    e.preventDefault()
    if (activeDef || activeAoe) return
    const { fullX, fullY } = mouseToFull(e)
    const { gridX, gridY } = fullToGrid(fullX, fullY)
    const hit = findEntityAt(gridX, gridY)
    if (hit) {
      setActiveEntity({ id: hit.entity.id, type: hit.type })
      const item: ContextItem = hit.type === 'token'
        ? { type: 'token', data: hit.entity as Token }
        : { type: 'effect', data: hit.entity as Effect }
      setContextMenu({ item, x: e.clientX, y: e.clientY }); return
    }
    const aoe = findAoeAt(fullX, fullY)
    if (aoe) {
      setActiveEntity({ id: aoe.id, type: 'aoe' })
      setContextMenu({ item: { type: 'aoe', data: aoe }, x: e.clientX, y: e.clientY })
    }
  }

  // ── Context menu handlers ─────────────────────────────────────────────────

  function handleRename(id: string, name: string, type: 'token' | 'effect') {
    if (type === 'token') {
      const t = tokens.find((t) => t.id === id); if (!t) return
      const u = { ...t, name }; useVttStore.getState().upsertToken(u); if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, u)
    } else {
      const ef = effects.find((e) => e.id === id); if (!ef) return
      const u = { ...ef, name }; useVttStore.getState().upsertEffect(u); if (playerReady) void emit(VTT_EVENTS.EFFECT_UPSERT, u)
    }
  }

  function handleResize(id: string, size: TokenSize, type: 'token' | 'effect') {
    if (type === 'token') {
      const t = tokens.find((t) => t.id === id); if (!t) return
      const u = { ...t, size }; useVttStore.getState().upsertToken(u); if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, u)
    } else {
      const ef = effects.find((e) => e.id === id); if (!ef) return
      const u = { ...ef, size }; useVttStore.getState().upsertEffect(u); if (playerReady) void emit(VTT_EVENTS.EFFECT_UPSERT, u)
    }
  }

  function handleOpacity(id: string, opacity: number) {
    const ef = effects.find((e) => e.id === id); if (!ef) return
    const u = { ...ef, opacity }; useVttStore.getState().upsertEffect(u); if (playerReady) void emit(VTT_EVENTS.EFFECT_UPSERT, u)
  }

  function handleRotate(id: string, dir: 1 | -1) {
    const t = tokens.find((t) => t.id === id); if (!t) return
    const u: Token = { ...t, rotation: ((t.rotation ?? 0) + dir * 90 + 360) % 360 }
    useVttStore.getState().upsertToken(u); if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, u)
  }

  function handleRemove(id: string, type: 'token' | 'effect') {
    setActiveEntity((prev) => (prev?.id === id && prev?.type === type) ? null : prev)
    if (type === 'token') { useVttStore.getState().removeToken(id); if (playerReady) void emit(VTT_EVENTS.TOKEN_REMOVE, { id }) }
    else { useVttStore.getState().removeEffect(id); if (playerReady) void emit(VTT_EVENTS.EFFECT_REMOVE, { id }) }
  }

  function handleAoeUpdate(updated: AoeMarker) {
    useVttStore.getState().upsertAoeMarker(updated); if (playerReady) void emit(VTT_EVENTS.AOE_UPSERT, updated)
  }

  function handleAoeRemove(id: string) {
    setActiveEntity((prev) => (prev?.id === id && prev?.type === 'aoe') ? null : prev)
    useVttStore.getState().removeAoeMarker(id); if (playerReady) void emit(VTT_EVENTS.AOE_REMOVE, { id })
  }

  function handleSetOutlineColor(id: string, color: string | undefined) {
    const t = tokens.find((t) => t.id === id); if (!t) return
    const updated: Token = { ...t, outlineColor: color }
    useVttStore.getState().upsertToken(updated)
    if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, updated)
    setDrawTick((n) => n + 1)
  }

  // ── Arrow key movement for selected entity ────────────────────────────────

  useEffect(() => {
    if (!activeEntity || activeEntity.type === 'aoe' || contextMenu) return
    const sel = activeEntity  // captured non-null for closure
    function onKey(e: KeyboardEvent) {
      if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) return
      e.preventDefault()
      const dx = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0
      const dy = e.key === 'ArrowUp'   ? -1 : e.key === 'ArrowDown'  ? 1 : 0
      if (sel.type === 'token') {
        const t = useVttStore.getState().tokens.find((t) => t.id === sel.id); if (!t) return
        const updated: Token = { ...t, gridX: Math.max(0, t.gridX + dx), gridY: Math.max(0, t.gridY + dy) }
        useVttStore.getState().upsertToken(updated)
        if (playerReady) void emit(VTT_EVENTS.TOKEN_UPSERT, updated)
        setDrawTick((n) => n + 1)
      } else {
        const ef = useVttStore.getState().effects.find((e) => e.id === sel.id); if (!ef) return
        const updated: Effect = { ...ef, gridX: Math.max(0, ef.gridX + dx), gridY: Math.max(0, ef.gridY + dy) }
        useVttStore.getState().upsertEffect(updated)
        if (playerReady) void emit(VTT_EVENTS.EFFECT_UPSERT, updated)
        setDrawTick((n) => n + 1)
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEntity, contextMenu, playerReady])

  const containerH = stageRotation % 180 === 90 ? mapW : mapH

  return (
    <div ref={containerRef} style={{ position: 'relative', width: '100%', height: containerH }}>
      <canvas
        ref={canvasRef}
        className={`stage-map ${activeDef || activeAoe ? 'stage-map--placing' : ''}`}
        style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: `translate(-50%, -50%) rotate(${stageRotation}deg)`,
        }}
        width={mapW} height={mapH}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onContextMenu={handleContextMenu}
        title={
          activeDef ? `Placing: ${activeDef.name} — click to place, Esc to cancel`
          : activeAoe ? 'Click to place AOE marker — Esc to cancel'
          : 'Click token to select, then click map to place · Scroll over token/AOE to rotate'
        }
      />
      {contextMenu && (
        <ContextMenu
          item={contextMenu.item}
          x={contextMenu.x} y={contextMenu.y}
          onRename={handleRename}
          onResize={handleResize}
          onOpacityChange={handleOpacity}
          onRotate={handleRotate}
          onSetOutlineColor={handleSetOutlineColor}
          onAoeUpdate={handleAoeUpdate}
          onAoeRemove={handleAoeRemove}
          onRemove={handleRemove}
          onClose={() => setContextMenu(null)}
        />
      )}
    </div>
  )
}
