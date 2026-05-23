import { Assets, Container, Graphics, Sprite, Text, Texture } from 'pixi.js'
import type { Effect } from '../../shared/types/tokens'
import type { GridConfig } from '../../store/vttStore'

interface EffectEntry {
  container: Container
  sprite: Sprite
  circleMask: Graphics | null
  label: Text
  effect: Effect
}

type OnError = (context: string, message: string) => void

export class EffectLayer {
  private entries = new Map<string, EffectEntry>()

  constructor(private container: Container, private onError?: OnError) {}

  upsert(effect: Effect, config: GridConfig): void {
    let entry = this.entries.get(effect.id)

    if (!entry) {
      const c = new Container()
      const sprite = new Sprite()
      const label = new Text({
        text: effect.name,
        style: {
          fill: '#ffcc44',
          fontSize: 11,
          stroke: { color: '#000000', width: 2 },
          fontFamily: 'sans-serif',
        },
      })
      label.anchor.set(0.5, 0)
      c.addChild(sprite, label)
      this.container.addChild(c)

      entry = { container: c, sprite, circleMask: null, label, effect }
      this.entries.set(effect.id, entry)

      Assets.load<Texture>(effect.src)
        .then((tex) => {
          const e = this.entries.get(effect.id)
          if (e) {
            e.sprite.texture = tex
            this._layout(e, config)
          }
        })
        .catch((err: unknown) => {
          const msg = err instanceof Error ? err.message : String(err)
          this.onError?.('EffectLayer.load', `Effect "${effect.name}": ${msg}`)
        })
    }

    entry.effect = effect
    this._layout(entry, config)
  }

  private _layout(entry: EffectEntry, config: GridConfig): void {
    const { effect, container, sprite, label } = entry
    const { cellSize, originX, originY } = config
    const size = effect.size * cellSize

    sprite.alpha = effect.opacity

    if (effect.shape === 'circle') {
      const radius = size / 2
      // Center circle effects on a grid intersection
      container.x = originX + effect.gridX * cellSize - radius
      container.y = originY + effect.gridY * cellSize - radius

      // Rebuild circular mask
      if (entry.circleMask) {
        sprite.mask = null
        entry.circleMask.destroy()
      }
      const mask = new Graphics()
      mask.circle(radius, radius, radius).fill(0xffffff)
      container.addChild(mask)
      sprite.mask = mask
      entry.circleMask = mask
    } else {
      container.x = originX + effect.gridX * cellSize
      container.y = originY + effect.gridY * cellSize

      if (entry.circleMask) {
        sprite.mask = null
        entry.circleMask.destroy()
        entry.circleMask = null
      }
    }

    if (sprite.texture && sprite.texture.width > 0) {
      sprite.width = size
      sprite.height = size
    }

    label.text = effect.name
    label.x = size / 2
    label.y = size + 2
  }

  reposition(config: GridConfig): void {
    this.entries.forEach((entry) => this._layout(entry, config))
  }

  remove(id: string): void {
    const entry = this.entries.get(id)
    if (entry) {
      entry.container.destroy({ children: true })
      this.entries.delete(id)
    }
  }

  destroy(): void {
    this.entries.forEach((e) => e.container.destroy({ children: true }))
    this.entries.clear()
  }
}
