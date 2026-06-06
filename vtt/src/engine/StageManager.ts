import { Application, Assets, Container, Graphics, Sprite, Texture } from 'pixi.js'
import { AoeLayer } from './layers/AoeLayer'
import { BackgroundLayer } from './layers/BackgroundLayer'
import { EffectLayer } from './layers/EffectLayer'
import { GridLayer } from './layers/GridLayer'
import { ShowcaseLayer } from './layers/ShowcaseLayer'
import { TokenLayer } from './layers/TokenLayer'
import type { AoeMarker } from '../shared/types/aoe'
import { AOE_COLOR_NUM } from '../shared/types/aoe'
import type { GhostAoePayload, GhostTokenPayload, LayerName, ShowcaseSetPayload } from '../shared/types/ipc'
import type { Effect, Token } from '../shared/types/tokens'
import type { GridConfig } from '../store/vttStore'

type OnError = (context: string, message: string) => void

export class StageManager {
  readonly containers: Record<LayerName, Container>
  private bg: BackgroundLayer
  private grid: GridLayer
  private tokenLayer: TokenLayer
  private effectLayer: EffectLayer
  private aoeLayer: AoeLayer
  private showcaseLayer: ShowcaseLayer
  private lastGridConfig: GridConfig = {
    color: 0xffffff, opacity: 0.25, cellSize: 70, lineWidth: 1, originX: 0, originY: 0,
  }

  // Ghost rendering (placement previews from Controller)
  private ghostContainer: Container
  private ghostTokenSprite: Sprite | null = null
  private ghostTokenSrc = ''
  private ghostAoeFill: Graphics | null = null
  private ghostAoeStroke: Graphics | null = null

  constructor(private app: Application, onError?: OnError) {
    const background = new Container()
    const aoe = new Container()
    const effects = new Container()
    const tokens = new Container()
    const grid = new Container()
    const showcaseDarken = new Container()
    const showcase = new Container()
    const ghost = new Container()

    this.containers = { background, effects, tokens, grid }
    this.ghostContainer = ghost

    // Draw order: background → aoe → effects → tokens → grid → darken → showcase → ghost
    app.stage.addChild(background, aoe, effects, tokens, grid, showcaseDarken, showcase, ghost)

    this.bg = new BackgroundLayer(background, onError)
    this.grid = new GridLayer(grid)
    this.tokenLayer = new TokenLayer(tokens, onError)
    this.effectLayer = new EffectLayer(effects, onError)
    this.aoeLayer = new AoeLayer(aoe)
    this.showcaseLayer = new ShowcaseLayer(showcaseDarken, showcase)
  }

  setLayerVisible(layer: LayerName, visible: boolean): void {
    this.containers[layer].visible = visible
  }

  async loadBackground(src: string): Promise<void> {
    const { width, height } = this.app.screen
    await this.bg.load(src, width, height)
  }

  redrawGrid(config: GridConfig): void {
    this.lastGridConfig = config
    const { width, height } = this.app.screen
    this.grid.redraw(width, height, config)
  }

  /** Update the stored grid config without triggering a redraw.
   *  Call this before applyFullscreenScale when grid settings change. */
  updateGridConfig(config: GridConfig): void {
    this.lastGridConfig = config
  }

  /**
   * Scale the entire stage to fill the screen while preserving the TV aspect ratio.
   * The background and grid are redrawn to match tvW × tvH in stage coordinates so
   * they cover exactly the TV area when the stage transform is applied.
   */
  applyFullscreenScale(scale: number, offsetX: number, offsetY: number, tvW: number, tvH: number): void {
    this.app.stage.scale.set(scale)
    this.app.stage.x = offsetX
    this.app.stage.y = offsetY
    this.bg.resize(tvW, tvH)
    this.grid.redraw(tvW, tvH, this.lastGridConfig)
    this.showcaseLayer.resize(tvW, tvH)
  }

  /** Undo fullscreen scaling and restore normal window-fill rendering. */
  resetFullscreenScale(config: GridConfig): void {
    this.app.stage.scale.set(1)
    this.app.stage.x = 0
    this.app.stage.y = 0
    this.resize(config)
  }

  upsertToken(token: Token, config: GridConfig): void {
    this.tokenLayer.upsert(token, config)
  }

  removeToken(id: string): void {
    this.tokenLayer.remove(id)
  }

  upsertEffect(effect: Effect, config: GridConfig): void {
    this.effectLayer.upsert(effect, config)
  }

  removeEffect(id: string): void {
    this.effectLayer.remove(id)
  }

  upsertAoe(aoe: AoeMarker, config: GridConfig): void {
    this.aoeLayer.upsert(aoe, config)
  }

  removeAoe(id: string): void {
    this.aoeLayer.remove(id)
  }

  setShowAffectedArea(enabled: boolean, config: GridConfig): void {
    this.aoeLayer.setShowAffectedArea(enabled, config)
  }

  showShowcase(payload: ShowcaseSetPayload): Promise<void> {
    const { width, height } = this.app.screen
    return this.showcaseLayer.show(payload, width, height)
  }

  hideShowcase(): void {
    this.showcaseLayer.hide()
  }

  // ── Ghost: token/effect placement preview ─────────────────────────────────

  async showGhostToken(payload: GhostTokenPayload, config: GridConfig): Promise<void> {
    const { cellSize, originX, originY } = config
    const size = payload.size * cellSize

    if (!this.ghostTokenSprite) {
      this.ghostTokenSprite = new Sprite()
      this.ghostTokenSprite.alpha = 0.5
      this.ghostContainer.addChild(this.ghostTokenSprite)
    }

    const sprite = this.ghostTokenSprite
    sprite.visible = true
    sprite.x = originX + payload.gridX * cellSize
    sprite.y = originY + payload.gridY * cellSize
    sprite.width = size
    sprite.height = size

    if (this.ghostTokenSrc !== payload.src) {
      this.ghostTokenSrc = payload.src
      try {
        const tex = await Assets.load<Texture>(payload.src)
        if (this.ghostTokenSprite && this.ghostTokenSrc === payload.src) {
          this.ghostTokenSprite.texture = tex
          this.ghostTokenSprite.width = size
          this.ghostTokenSprite.height = size
        }
      } catch { /* fall through — ghost renders as blank sprite */ }
    }
  }

  hideGhostToken(): void {
    if (this.ghostTokenSprite) this.ghostTokenSprite.visible = false
  }

  // ── Ghost: AOE placement preview ──────────────────────────────────────────

  showGhostAoe(payload: GhostAoePayload, config: GridConfig): void {
    const { cellSize, originX, originY } = config

    if (!this.ghostAoeFill) {
      this.ghostAoeFill = new Graphics()
      this.ghostAoeStroke = new Graphics()
      this.ghostContainer.addChild(this.ghostAoeFill, this.ghostAoeStroke!)
    }

    const fill = this.ghostAoeFill
    const stroke = this.ghostAoeStroke!
    const pxPerFt = cellSize / 5
    const snapX = originX + payload.intX * cellSize
    const snapY = originY + payload.intY * cellSize
    const rotRad = (payload.rotation * Math.PI) / 180
    const colorNum = AOE_COLOR_NUM[payload.color]

    for (const g of [fill, stroke] as Graphics[]) {
      g.clear(); g.x = snapX; g.y = snapY; g.rotation = rotRad; g.visible = true
    }

    fill.alpha = 0.35
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(fill as any).blendMode = payload.blendMode === 'add' ? 'add' : payload.blendMode
    stroke.alpha = 0.8
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(stroke as any).blendMode = 'normal'

    if (payload.shape === 'circle') {
      const r = payload.radiusFt * pxPerFt
      fill.circle(0, 0, r).fill({ color: colorNum })
      stroke.circle(0, 0, r).stroke({ color: 0x000000, width: 2 })
    } else if (payload.shape === 'rectangle') {
      const w = payload.widthFt * pxPerFt, h = payload.heightFt * pxPerFt
      fill.rect(0, -h, w, h).fill({ color: colorNum })
      stroke.rect(0, -h, w, h).stroke({ color: 0x000000, width: 2 })
    } else {
      const legPx = payload.legFt * pxPerFt, basePx = payload.baseFt * pxPerFt
      const pts = [0, 0, -basePx / 2, legPx, basePx / 2, legPx]
      fill.poly(pts).fill({ color: colorNum })
      stroke.poly(pts).stroke({ color: 0x000000, width: 2 })
    }
  }

  hideGhostAoe(): void {
    if (this.ghostAoeFill) this.ghostAoeFill.visible = false
    if (this.ghostAoeStroke) this.ghostAoeStroke.visible = false
  }

  // ── Lifecycle ─────────────────────────────────────────────────────────────

  resize(gridConfig: GridConfig): void {
    const { width, height } = this.app.screen
    this.bg.resize(width, height)
    this.grid.redraw(width, height, gridConfig)
    this.tokenLayer.reposition(gridConfig)
    this.effectLayer.reposition(gridConfig)
    this.aoeLayer.reposition(gridConfig)
    this.showcaseLayer.resize(width, height)
    this.hideGhostToken()
    this.hideGhostAoe()
  }

  destroy(): void {
    this.bg.destroy()
    this.grid.destroy()
    this.tokenLayer.destroy()
    this.effectLayer.destroy()
    this.aoeLayer.destroy()
    this.showcaseLayer.destroy()
    this.ghostContainer.destroy({ children: true })
  }
}
