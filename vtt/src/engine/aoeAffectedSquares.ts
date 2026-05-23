import type { AoeMarker } from '../shared/types/aoe'

export interface AoeCellResult {
  cellX: number    // column index (integer) — left edge in grid-intersection units
  cellY: number    // row index (integer) — top edge (Y increases downward)
  affected: boolean // true = ≥50 of 100 sample points inside the shape
}

// ── Geometry helpers ──────────────────────────────────────────────────────────

function rotatePt(x: number, y: number, rotDeg: number): [number, number] {
  const rad = (rotDeg * Math.PI) / 180
  const c = Math.cos(rad), s = Math.sin(rad)
  return [x * c - y * s, x * s + y * c]
}

function isPointInShape(
  px: number, py: number,
  shape: string,
  ox: number, oy: number, rotDeg: number,
  radiusCells: number, widthCells: number, heightCells: number,
  legCells: number, baseCells: number,
): boolean {
  const dx = px - ox, dy = py - oy
  const rad = (-rotDeg * Math.PI) / 180
  const lx = dx * Math.cos(rad) - dy * Math.sin(rad)
  const ly = dx * Math.sin(rad) + dy * Math.cos(rad)

  if (shape === 'circle') {
    return lx * lx + ly * ly <= radiusCells * radiusCells
  }
  if (shape === 'rectangle') {
    return lx >= 0 && lx <= widthCells && ly >= -heightCells && ly <= 0
  }
  // triangle: apex at origin, opens toward positive Y
  if (ly < 0 || ly > legCells) return false
  return Math.abs(lx) <= (baseCells / 2) * (ly / legCells)
}

// ── Affected-square computation ───────────────────────────────────────────────

export function getAffectedSquares(aoe: AoeMarker): AoeCellResult[] {
  const { gridX: ox, gridY: oy, rotation, shape } = aoe
  const radiusCells  = aoe.radiusFt  / 5
  const widthCells   = aoe.widthFt   / 5
  const heightCells  = aoe.heightFt  / 5
  const legCells     = aoe.legFt     / 5
  const baseCells    = aoe.baseFt    / 5

  const args = [shape, ox, oy, rotation, radiusCells, widthCells, heightCells, legCells, baseCells] as const
  const inside = (px: number, py: number) => isPointInShape(px, py, ...args)

  // Bounding box of the shape in continuous grid units
  let minX: number, maxX: number, minY: number, maxY: number

  if (shape === 'circle') {
    minX = ox - radiusCells; maxX = ox + radiusCells
    minY = oy - radiusCells; maxY = oy + radiusCells
  } else if (shape === 'rectangle') {
    const corners: [number, number][] = [
      [0, 0], [widthCells, 0], [0, -heightCells], [widthCells, -heightCells],
    ]
    const pts = corners.map(([cx, cy]) => { const [rx, ry] = rotatePt(cx, cy, rotation); return [rx + ox, ry + oy] })
    minX = Math.min(...pts.map(([x]) => x)); maxX = Math.max(...pts.map(([x]) => x))
    minY = Math.min(...pts.map(([, y]) => y)); maxY = Math.max(...pts.map(([, y]) => y))
  } else {
    // triangle
    const corners: [number, number][] = [
      [0, 0], [-baseCells / 2, legCells], [baseCells / 2, legCells],
    ]
    const pts = corners.map(([cx, cy]) => { const [rx, ry] = rotatePt(cx, cy, rotation); return [rx + ox, ry + oy] })
    minX = Math.min(...pts.map(([x]) => x)); maxX = Math.max(...pts.map(([x]) => x))
    minY = Math.min(...pts.map(([, y]) => y)); maxY = Math.max(...pts.map(([, y]) => y))
  }

  const startCX = Math.floor(minX), endCX = Math.floor(maxX)
  const startCY = Math.floor(minY), endCY = Math.floor(maxY)
  const results: AoeCellResult[] = []

  // Each grid cell has 4 corners. We test all 4 and use the count to decide:
  //   0 corners inside → skip (very likely no intersection in the bounding box fringe)
  //   1 corner inside  → not affected (< half covered), no sampling needed
  //   2 corners inside → exactly half: ambiguous, run 10×10 precision sampling
  //   3-4 corners inside → affected (> half covered), no sampling needed
  for (let cy = startCY; cy <= endCY; cy++) {
    for (let cx = startCX; cx <= endCX; cx++) {
      const c00 = inside(cx,     cy    )
      const c10 = inside(cx + 1, cy    )
      const c01 = inside(cx,     cy + 1)
      const c11 = inside(cx + 1, cy + 1)
      const cornersInside = +c00 + +c10 + +c01 + +c11  // 0–4

      if (cornersInside > 2) {
        // More than half covered — definitely affected
        results.push({ cellX: cx, cellY: cy, affected: true })
        continue
      }

      if (cornersInside === 1) {
        // Less than half covered — not affected, but has some intersection
        results.push({ cellX: cx, cellY: cy, affected: false })
        continue
      }

      if (cornersInside === 0) {
        // Very likely no intersection at all; skip without sampling
        continue
      }

      // cornersInside === 2: exactly half the corners covered — run precision sampling
      let hits = 0
      outer: for (let sy = 0; sy < 10; sy++) {
        for (let sx = 0; sx < 10; sx++) {
          if (inside(cx + (sx + 0.5) / 10, cy + (sy + 0.5) / 10)) {
            hits++
            if (hits >= 50) break outer  // already ≥50%, no need to continue
          }
        }
      }

      if (hits > 0) {
        results.push({ cellX: cx, cellY: cy, affected: hits >= 50 })
      }
    }
  }

  return results
}

// ── Color utilities ───────────────────────────────────────────────────────────

function hexToRgb(hex: string): [number, number, number] {
  const n = parseInt(hex.replace('#', ''), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** Darken an AOE hex color by 15% — for filling affected grid squares. */
export function darkenHexColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  return `rgb(${Math.round(r * 0.85)},${Math.round(g * 0.85)},${Math.round(b * 0.85)})`
}

/** Convert a color to greyscale — for partially-covered squares. */
export function greyFromHexColor(hex: string): string {
  const [r, g, b] = hexToRgb(hex)
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  return `rgb(${v},${v},${v})`
}

/** darkenHexColor but as a 24-bit integer for PixiJS. */
export function darkenHexColorNum(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (Math.round(r * 0.85) << 16) | (Math.round(g * 0.85) << 8) | Math.round(b * 0.85)
}

/** greyFromHexColor but as a 24-bit integer for PixiJS. */
export function greyFromHexColorNum(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  const v = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
  return (v << 16) | (v << 8) | v
}
