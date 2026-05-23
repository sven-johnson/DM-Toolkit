import { Container, Graphics } from 'pixi.js'
import type { GridConfig } from '../../store/vttStore'

export class GridLayer {
  private graphics: Graphics

  constructor(container: Container) {
    this.graphics = new Graphics()
    container.addChild(this.graphics)
  }

  redraw(width: number, height: number, config: GridConfig): void {
    const { color, opacity, cellSize, lineWidth, originX, originY } = config
    this.graphics.clear()
    if (cellSize <= 0) return

    // Modulo offset so grid tiles correctly from any origin
    const startX = ((originX % cellSize) + cellSize) % cellSize
    const startY = ((originY % cellSize) + cellSize) % cellSize

    for (let x = startX; x <= width; x += cellSize) {
      this.graphics.moveTo(x, 0)
      this.graphics.lineTo(x, height)
    }
    for (let y = startY; y <= height; y += cellSize) {
      this.graphics.moveTo(0, y)
      this.graphics.lineTo(width, y)
    }

    this.graphics.stroke({ color, alpha: opacity, width: lineWidth })
  }

  destroy(): void {
    this.graphics.destroy()
  }
}
