import { Assets, Container, Graphics, Sprite, Texture } from 'pixi.js'
import type { ShowcaseSetPayload } from '../../shared/types/ipc'

export class ShowcaseLayer {
  private overlay: Graphics
  private sprite: Sprite | null = null
  private loadedSrc = ''
  private rotation = 0
  private darkenAmount = 20

  constructor(
    overlayContainer: Container,
    private showcaseContainer: Container,
  ) {
    this.overlay = new Graphics()
    overlayContainer.addChild(this.overlay)
  }

  async show(payload: ShowcaseSetPayload, w: number, h: number): Promise<void> {
    this.rotation = payload.rotation
    this.darkenAmount = payload.darkenAmount

    this.drawOverlay(w, h)

    if (this.loadedSrc !== payload.src) {
      this.loadedSrc = payload.src
      this.sprite?.destroy()
      this.sprite = null
      try {
        const tex = await Assets.load<Texture>(payload.src)
        if (this.loadedSrc !== payload.src) return  // superseded by a later call
        this.sprite = new Sprite(tex)
        this.sprite.anchor.set(0.5, 0.5)
        this.showcaseContainer.addChild(this.sprite)
      } catch {
        return
      }
    }

    if (this.sprite) {
      this.sprite.visible = true
      this.positionSprite(w, h)
    }
  }

  hide(): void {
    this.overlay.clear()
    this.overlay.visible = false
    if (this.sprite) this.sprite.visible = false
  }

  resize(w: number, h: number): void {
    if (!this.sprite?.visible) return
    this.drawOverlay(w, h)
    this.positionSprite(w, h)
  }

  destroy(): void {
    this.overlay.destroy()
    this.sprite?.destroy()
  }

  private drawOverlay(w: number, h: number): void {
    this.overlay.clear()
    this.overlay.rect(0, 0, w, h).fill({ color: 0x000000, alpha: this.darkenAmount / 100 })
    this.overlay.visible = true
  }

  private positionSprite(w: number, h: number): void {
    const s = this.sprite
    if (!s) return
    const imgW = s.texture.width
    const imgH = s.texture.height
    // After 90°/270° the image's long axis is swapped on screen
    const isSwapped = this.rotation === 90 || this.rotation === 270
    const effectiveW = isSwapped ? imgH : imgW
    const effectiveH = isSwapped ? imgW : imgH
    const scale = Math.min(w / effectiveW, h / effectiveH)
    s.x = w / 2
    s.y = h / 2
    s.rotation = (this.rotation * Math.PI) / 180
    s.scale.set(scale)
  }
}
