import { useEffect, useRef, useState } from 'react'

const PREVIEW_W = 540
const PREVIEW_H = 304 // ~16:9

export interface CropRect {
  x: number
  y: number
  width: number
  height: number
}

interface Props {
  imageSrc: string       // asset:// URL for display
  originalWidth: number
  originalHeight: number
  onCropChange: (crop: CropRect) => void
}

interface DragState {
  startX: number
  startY: number
}

interface Selection {
  x: number
  y: number
  w: number
  h: number
}

function getRenderedBounds(
  origW: number,
  origH: number,
): { renderedW: number; renderedH: number; offsetX: number; offsetY: number } {
  const imgAspect = origW / origH
  const previewAspect = PREVIEW_W / PREVIEW_H

  if (imgAspect >= previewAspect) {
    const renderedW = PREVIEW_W
    const renderedH = PREVIEW_W / imgAspect
    return { renderedW, renderedH, offsetX: 0, offsetY: (PREVIEW_H - renderedH) / 2 }
  } else {
    const renderedH = PREVIEW_H
    const renderedW = PREVIEW_H * imgAspect
    return { renderedW, renderedH, offsetX: (PREVIEW_W - renderedW) / 2, offsetY: 0 }
  }
}

export function CropSelector({ imageSrc, originalWidth, originalHeight, onCropChange }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drag = useRef<DragState | null>(null)
  const [sel, setSel] = useState<Selection | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    ctx.clearRect(0, 0, PREVIEW_W, PREVIEW_H)

    if (!sel) return

    // Dark overlay
    ctx.fillStyle = 'rgba(0,0,0,0.5)'
    ctx.fillRect(0, 0, PREVIEW_W, PREVIEW_H)

    // Punch out the selection
    ctx.clearRect(sel.x, sel.y, sel.w, sel.h)

    // Dashed border
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 1.5
    ctx.setLineDash([5, 3])
    ctx.strokeRect(sel.x + 0.5, sel.y + 0.5, sel.w, sel.h)
    ctx.setLineDash([])

    // Size label
    const { renderedW, renderedH } = getRenderedBounds(originalWidth, originalHeight)
    const scaleX = originalWidth / renderedW
    const scaleY = originalHeight / renderedH
    const origW = Math.round(sel.w * scaleX)
    const origH = Math.round(sel.h * scaleY)
    ctx.fillStyle = 'rgba(0,0,0,0.65)'
    ctx.fillRect(sel.x, sel.y - 20, 120, 18)
    ctx.fillStyle = '#ffffff'
    ctx.font = '11px sans-serif'
    ctx.fillText(`${origW} × ${origH}`, sel.x + 4, sel.y - 6)
  }, [sel, originalWidth, originalHeight])

  function canvasPos(e: React.MouseEvent<HTMLCanvasElement>) {
    const r = e.currentTarget.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = canvasPos(e)
    drag.current = { startX: x, startY: y }
    setSel({ x, y, w: 0, h: 0 })
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drag.current) return
    const { x, y } = canvasPos(e)
    const { startX, startY } = drag.current
    const newSel = {
      x: Math.min(x, startX),
      y: Math.min(y, startY),
      w: Math.abs(x - startX),
      h: Math.abs(y - startY),
    }
    setSel(newSel)
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drag.current || !sel || sel.w < 4 || sel.h < 4) {
      drag.current = null
      return
    }
    drag.current = null

    const { renderedW, renderedH, offsetX, offsetY } = getRenderedBounds(originalWidth, originalHeight)
    const scaleX = originalWidth / renderedW
    const scaleY = originalHeight / renderedH

    const crop: CropRect = {
      x: Math.max(0, Math.round((sel.x - offsetX) * scaleX)),
      y: Math.max(0, Math.round((sel.y - offsetY) * scaleY)),
      width: Math.min(originalWidth, Math.round(sel.w * scaleX)),
      height: Math.min(originalHeight, Math.round(sel.h * scaleY)),
    }
    onCropChange(crop)
    e.preventDefault()
  }

  return (
    <div className="crop-selector-wrap">
      <img
        src={imageSrc}
        className="crop-preview-img"
        alt="Map preview"
        draggable={false}
        style={{ width: PREVIEW_W, height: PREVIEW_H }}
      />
      <canvas
        ref={canvasRef}
        width={PREVIEW_W}
        height={PREVIEW_H}
        className="crop-canvas"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={() => { drag.current = null }}
      />
    </div>
  )
}
