import { useEffect, useRef } from 'react'

const PREVIEW_W = 300
const PREVIEW_H = 169 // 16:9

interface Props {
  cellPx: number
  tvWidth: number
  color: string
  lineWidth: number
  opacity: number
  originX: number
  originY: number
  onOriginChange: (x: number, y: number) => void
}

interface DragState {
  startX: number
  startY: number
  startOriginX: number
  startOriginY: number
}

export function CalibrationPreview({
  cellPx, tvWidth, color, lineWidth, opacity,
  originX, originY, onOriginChange,
}: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<DragState | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const scale = PREVIEW_W / tvWidth
    const cellPreview = cellPx * scale

    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H)
    ctx.fillStyle = '#111318'
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)

    // Grid lines
    if (cellPreview >= 1) {
      const startX = ((originX * scale) % cellPreview + cellPreview) % cellPreview
      const startY = ((originY * scale) % cellPreview + cellPreview) % cellPreview

      ctx.beginPath()
      for (let x = startX; x <= PREVIEW_W; x += cellPreview) {
        ctx.moveTo(x, 0)
        ctx.lineTo(x, PREVIEW_H)
      }
      for (let y = startY; y <= PREVIEW_H; y += cellPreview) {
        ctx.moveTo(0, y)
        ctx.lineTo(PREVIEW_W, y)
      }
      ctx.strokeStyle = color
      ctx.lineWidth = Math.max(0.5, lineWidth * scale)
      ctx.globalAlpha = opacity
      ctx.stroke()
      ctx.globalAlpha = 1
    }

    // Origin crosshair — clamped to canvas edges
    const ox = Math.max(4, Math.min(PREVIEW_W - 4, originX * scale))
    const oy = Math.max(4, Math.min(PREVIEW_H - 4, originY * scale))
    const arm = 7

    ctx.strokeStyle = '#ff6b35'
    ctx.lineWidth = 1.5
    ctx.globalAlpha = 0.9
    ctx.beginPath()
    ctx.moveTo(ox - arm, oy)
    ctx.lineTo(ox + arm, oy)
    ctx.moveTo(ox, oy - arm)
    ctx.lineTo(ox, oy + arm)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(ox, oy, 4, 0, Math.PI * 2)
    ctx.stroke()
    ctx.globalAlpha = 1
  }, [cellPx, tvWidth, color, lineWidth, opacity, originX, originY])

  function getPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = getPos(e)
    drag.current = { startX: x, startY: y, startOriginX: originX, startOriginY: originY }
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    const { x, y } = getPos(e)
    const scale = PREVIEW_W / tvWidth
    const dx = (x - drag.current.startX) / scale
    const dy = (y - drag.current.startY) / scale
    onOriginChange(
      Math.round(drag.current.startOriginX + dx),
      Math.round(drag.current.startOriginY + dy),
    )
  }

  function handleMouseUp() {
    drag.current = null
  }

  return (
    <canvas
      ref={canvasRef}
      className="cal-preview"
      width={PREVIEW_W}
      height={PREVIEW_H}
      onMouseDown={handleMouseDown}
      onMouseMove={handleMouseMove}
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      title="Drag to reposition grid origin"
    />
  )
}
