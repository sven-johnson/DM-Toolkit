import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { Token } from '../../shared/types/tokens'
import type { GridConfig } from '../../store/vttStore'
import { useVttStore } from '../../store/vttStore'

interface TokenEntry {
  container: Container
  outline: Graphics
  sprite: Sprite
  /** Badge sits at the top-right of the grid cell and rotates to match the token. */
  badge: Container
  badgeCircle: Graphics
  badgeLabel: Text
  token: Token
}

type OnError = (context: string, message: string) => void

export class TokenLayer {
  private entries = new Map<string, TokenEntry>()
  private lastConfig: GridConfig | null = null

  constructor(private container: Container, private onError?: OnError) {}

  upsert(token: Token, config: GridConfig): void {
    this.lastConfig = config
    let entry = this.entries.get(token.id)

    if (!entry) {
      const c = new Container()
      const outline = new Graphics()
      const sprite = new Sprite()
      sprite.anchor.set(0.5, 0.5)

      // Badge: child of the Container (not the Sprite), so position stays fixed
      // at the grid-cell corner. Its rotation is set to match the token's facing.
      const badge = new Container()
      badge.visible = false
      const badgeCircle = new Graphics()
      const badgeLabel = new Text({
        text: '',
        style: { fill: '#ffffff', fontSize: 11, fontWeight: 'bold', fontFamily: 'sans-serif' },
      })
      badgeLabel.anchor.set(0.5, 0.5)
      badge.addChild(badgeCircle, badgeLabel)

      c.addChild(outline, sprite, badge)
      this.container.addChild(c)

      entry = { container: c, outline, sprite, badge, badgeCircle, badgeLabel, token }
      this.entries.set(token.id, entry)

      Assets.load<Texture>(token.src)
        .then((tex) => {
          const e = this.entries.get(token.id)
          if (e) {
            e.sprite.texture = tex
            this._layoutAll(token.defId, config)
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          this.onError?.('TokenLayer.load', `Token "${token.name}": ${msg}`)
        })
    }

    entry.token = token
    this._layoutAll(token.defId, config)
  }

  private _layoutAll(defId: string, config: GridConfig): void {
    for (const [, e] of this.entries) {
      if (e.token.defId === defId) this._layout(e, config)
    }
  }

  private _layout(entry: TokenEntry, config: GridConfig): void {
    const { token, container, outline, sprite, badge, badgeCircle, badgeLabel } = entry
    const { cellSize, originX, originY } = config
    const size = token.size * cellSize

    container.x = originX + token.gridX * cellSize
    container.y = originY + token.gridY * cellSize

    sprite.x = size / 2
    sprite.y = size / 2
    if (sprite.texture && sprite.texture.width > 0) {
      sprite.width = size
      sprite.height = size
    }
    sprite.angle = token.rotation ?? 0

    // Token outline
    const thicknessPx = useVttStore.getState().tokenOutlineThicknessPx
    outline.clear()
    outline.x = size / 2
    outline.y = size / 2
    outline.angle = token.rotation ?? 0
    if (token.outlineColor && thicknessPx > 0) {
      const color = parseInt(token.outlineColor.replace('#', ''), 16)
      const half = size / 2
      const shape = token.outlineShape ?? 'square'
      if (shape === 'circle') {
        outline.circle(0, 0, half).stroke({ color, width: thicknessPx })
      } else if (shape === 'rounded') {
        outline.roundRect(-half, -half, size, size, half * 0.3).stroke({ color, width: thicknessPx })
      } else {
        outline.rect(-half, -half, size, size).stroke({ color, width: thicknessPx })
      }
    }

    // Badge: centered on the top-right grid intersection of the token's footprint
    const badgeR = Math.max(8, Math.round(cellSize * 0.12))
    badge.x = size  // = (gridX + token.size) intersection
    badge.y = 0     // = gridY intersection
    badge.rotation = ((token.rotation ?? 0) * Math.PI) / 180

    badgeCircle.clear()
    badgeCircle.circle(0, 0, badgeR).fill({ color: 0x000000 })
    badgeLabel.style.fontSize = Math.max(7, Math.round(badgeR * 1.2))

    const sameDefEntries = [...this.entries.entries()].filter(([, e]) => e.token.defId === token.defId)
    if (sameDefEntries.length > 1) {
      const myIdx = sameDefEntries.findIndex(([id]) => id === token.id)
      const letter = myIdx >= 0 ? String.fromCharCode(65 + myIdx) : ''
      badge.visible = letter.length > 0
      badgeLabel.text = letter
    } else {
      badge.visible = false
    }
  }

  reposition(config: GridConfig): void {
    this.lastConfig = config
    this.entries.forEach((entry) => this._layout(entry, config))
  }

  remove(id: string): void {
    const entry = this.entries.get(id)
    if (!entry) return
    const defId = entry.token.defId
    entry.container.destroy({ children: true })
    this.entries.delete(id)
    if (this.lastConfig) {
      for (const [, e] of this.entries) {
        if (e.token.defId === defId) this._layout(e, this.lastConfig)
      }
    }
  }

  destroy(): void {
    this.entries.forEach((e) => e.container.destroy({ children: true }))
    this.entries.clear()
  }
}
