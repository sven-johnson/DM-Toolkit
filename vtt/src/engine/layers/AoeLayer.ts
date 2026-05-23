import { Container, Graphics } from 'pixi.js'
import type { AoeMarker } from '../../shared/types/aoe'
import { AOE_COLOR_HEX, AOE_COLOR_NUM } from '../../shared/types/aoe'
import {
  darkenHexColorNum,
  getAffectedSquares,
  greyFromHexColorNum,
} from '../../engine/aoeAffectedSquares'
import type { GridConfig } from '../../store/vttStore'

interface AoeEntry {
  fillG: Graphics         // normal blended fill (hidden when affected-area mode is on)
  strokeG: Graphics       // always-normal black outline
  greyFillG: Graphics     // grey shape for partial squares (shown in affected-area mode)
  affectedCellsG: Graphics // darkened filled squares (shown in affected-area mode)
  aoe: AoeMarker
}

function drawAoeShape(
  g: Graphics,
  aoe: AoeMarker,
  pxPerFt: number,
  fill: { color: number } | null,
  stroke: { color: number; width: number } | null,
): void {
  if (aoe.shape === 'circle') {
    const r = aoe.radiusFt * pxPerFt
    const p = g.circle(0, 0, r)
    if (fill) p.fill(fill)
    if (stroke) p.stroke(stroke)
  } else if (aoe.shape === 'rectangle') {
    const w = aoe.widthFt * pxPerFt, h = aoe.heightFt * pxPerFt
    const p = g.rect(0, -h, w, h)
    if (fill) p.fill(fill)
    if (stroke) p.stroke(stroke)
  } else {
    const legPx = aoe.legFt * pxPerFt, basePx = aoe.baseFt * pxPerFt
    const pts = [0, 0, -basePx / 2, legPx, basePx / 2, legPx]
    const p = g.poly(pts)
    if (fill) p.fill(fill)
    if (stroke) p.stroke(stroke)
  }
}

export class AoeLayer {
  private entries = new Map<string, AoeEntry>()
  private showAffected = false

  constructor(private container: Container) {}

  upsert(aoe: AoeMarker, config: GridConfig): void {
    let entry = this.entries.get(aoe.id)
    if (!entry) {
      const fillG = new Graphics()
      const strokeG = new Graphics()
      const greyFillG = new Graphics()
      const affectedCellsG = new Graphics()
      this.container.addChild(fillG, strokeG, greyFillG, affectedCellsG)
      entry = { fillG, strokeG, greyFillG, affectedCellsG, aoe }
      this.entries.set(aoe.id, entry)
    }
    entry.aoe = aoe
    this._draw(entry, config)
  }

  setShowAffectedArea(enabled: boolean, config: GridConfig): void {
    this.showAffected = enabled
    this.entries.forEach((entry) => this._draw(entry, config))
  }

  private _draw(entry: AoeEntry, config: GridConfig): void {
    const { fillG, strokeG, greyFillG, affectedCellsG, aoe } = entry
    const { cellSize, originX, originY } = config
    const pxPerFt = cellSize / 5
    const snapX = originX + aoe.gridX * cellSize
    const snapY = originY + aoe.gridY * cellSize
    const rotRad = (aoe.rotation * Math.PI) / 180
    const colorNum = AOE_COLOR_NUM[aoe.color]
    const blendMode = aoe.blendMode === 'add' ? 'add' : aoe.blendMode

    // Position snap-relative graphics
    for (const g of [fillG, strokeG, greyFillG] as Graphics[]) {
      g.clear(); g.x = snapX; g.y = snapY; g.rotation = rotRad
    }
    affectedCellsG.clear(); affectedCellsG.x = 0; affectedCellsG.y = 0; affectedCellsG.rotation = 0

    // Stroke is always drawn, always normal blend
    strokeG.alpha = 1
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(strokeG as any).blendMode = 'normal'
    drawAoeShape(strokeG, aoe, pxPerFt, null, { color: 0x000000, width: 2 })

    if (this.showAffected) {
      // Grey fill covers the full AOE shape (partial squares will show grey intersection)
      const hexColor = AOE_COLOR_HEX[aoe.color]
      const greyNum = greyFromHexColorNum(hexColor)
      greyFillG.alpha = aoe.opacity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(greyFillG as any).blendMode = blendMode
      drawAoeShape(greyFillG, aoe, pxPerFt, { color: greyNum }, null)
      greyFillG.visible = true

      // Darkened solid fills for squares that are ≥50% covered
      const darkNum = darkenHexColorNum(hexColor)
      affectedCellsG.alpha = aoe.opacity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(affectedCellsG as any).blendMode = blendMode
      affectedCellsG.visible = true

      const squares = getAffectedSquares(aoe)
      for (const sq of squares) {
        if (sq.affected) {
          affectedCellsG
            .rect(originX + sq.cellX * cellSize, originY + sq.cellY * cellSize, cellSize, cellSize)
            .fill({ color: darkNum })
        }
      }

      fillG.visible = false
    } else {
      fillG.alpha = aoe.opacity
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ;(fillG as any).blendMode = blendMode
      drawAoeShape(fillG, aoe, pxPerFt, { color: colorNum }, null)
      fillG.visible = true

      greyFillG.visible = false
      affectedCellsG.visible = false
    }
  }

  reposition(config: GridConfig): void {
    this.entries.forEach((entry) => this._draw(entry, config))
  }

  remove(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    entry.fillG.destroy(); entry.strokeG.destroy()
    entry.greyFillG.destroy(); entry.affectedCellsG.destroy()
    this.entries.delete(id)
  }

  destroy(): void {
    this.entries.forEach((e) => {
      e.fillG.destroy(); e.strokeG.destroy()
      e.greyFillG.destroy(); e.affectedCellsG.destroy()
    })
    this.entries.clear()
  }
}
