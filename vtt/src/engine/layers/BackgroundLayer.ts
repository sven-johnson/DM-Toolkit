import { Assets, Container, Sprite, Texture } from 'pixi.js'

type OnError = (context: string, message: string) => void

export class BackgroundLayer {
  private sprite: Sprite | null = null
  private stageW = 0
  private stageH = 0

  constructor(private container: Container, private onError?: OnError) {}

  async load(src: string, stageW: number, stageH: number): Promise<void> {
    this.stageW = stageW
    this.stageH = stageH

    if (this.sprite) {
      this.container.removeChild(this.sprite)
      this.sprite.destroy()
      this.sprite = null
    }

    if (!src) return

    try {
      const texture = await Assets.load<Texture>(src)
      const sprite = new Sprite(texture)
      this.sprite = sprite
      this.container.addChild(sprite)
      this._applyScale()
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err)
      this.onError?.('BackgroundLayer.load', `Failed to load "${src.split(/[\\/]/).pop()}": ${msg}`)
    }
  }

  resize(stageW: number, stageH: number): void {
    this.stageW = stageW
    this.stageH = stageH
    this._applyScale()
  }

  private _applyScale(): void {
    if (!this.sprite) return
    const texW = this.sprite.texture.width
    const texH = this.sprite.texture.height
    const scale = Math.max(this.stageW / texW, this.stageH / texH)
    this.sprite.scale.set(scale)
    this.sprite.x = (this.stageW - texW * scale) / 2
    this.sprite.y = (this.stageH - texH * scale) / 2
  }

  destroy(): void {
    this.sprite?.destroy()
    this.sprite = null
  }
}
