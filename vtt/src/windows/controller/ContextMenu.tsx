import { useEffect, useRef, useState } from 'react'
import type { AoeBlendMode, AoeMarker } from '../../shared/types/aoe'
import type { Effect, Token, TokenSize } from '../../shared/types/tokens'

export type ContextItem =
  | { type: 'token'; data: Token }
  | { type: 'effect'; data: Effect }
  | { type: 'aoe'; data: AoeMarker }

interface Props {
  item: ContextItem
  x: number
  y: number
  onRename: (id: string, name: string, type: 'token' | 'effect') => void
  onResize: (id: string, size: TokenSize, type: 'token' | 'effect') => void
  onOpacityChange: (id: string, opacity: number) => void
  onRotate?: (id: string) => void
  onAoeUpdate?: (updated: AoeMarker) => void
  onAoeRemove?: (id: string) => void
  onRemove: (id: string, type: 'token' | 'effect') => void
  onClose: () => void
}

const SIZES: TokenSize[] = [1, 2, 3]
const SIZE_LABELS = ['1×1', '2×2', '3×3']

const AOE_SHAPE_LABELS = { circle: 'Circle', rectangle: 'Rectangle', triangle: 'Triangle' }

export function ContextMenu({
  item, x, y,
  onRename, onResize, onOpacityChange, onRotate,
  onAoeUpdate, onAoeRemove, onRemove, onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const isAoe = item.type === 'aoe'
  const id = item.data.id

  // Local state for live AOE edits (accumulates changes so they compose correctly)
  const [localAoe, setLocalAoe] = useState<AoeMarker | null>(
    isAoe ? (item.data as AoeMarker) : null,
  )

  function handleAoeChange(patch: Partial<AoeMarker>) {
    if (!localAoe) return
    const updated = { ...localAoe, ...patch }
    setLocalAoe(updated)
    onAoeUpdate?.(updated)
  }

  // Close on outside click or Escape
  useEffect(() => {
    function onMouseDown(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose()
    }
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('mousedown', onMouseDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onMouseDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [onClose])

  function handleRename() {
    if (isAoe) return
    const name = (item.data as Token | Effect).name
    const next = window.prompt('Rename:', name)
    if (next !== null && next.trim()) onRename(id, next.trim(), item.type as 'token' | 'effect')
    onClose()
  }

  const displayName = isAoe
    ? `${AOE_SHAPE_LABELS[(item.data as AoeMarker).shape]} AOE`
    : (item.data as Token | Effect).name

  return (
    <div ref={menuRef} className="ctx-menu" style={{ left: x, top: y }}>
      <div className="ctx-header">{displayName}</div>

      {/* ── Token / Effect items ── */}
      {!isAoe && (
        <button className="ctx-item" onClick={handleRename}>Rename…</button>
      )}

      {!isAoe && (
        <>
          <div className="ctx-divider" />
          <div className="ctx-group-label">Size</div>
          <div className="ctx-size-row">
            {SIZES.map((s, i) => (
              <button
                key={s}
                className={`ctx-size-btn ${(item.data as Token | Effect).size === s ? 'ctx-size-btn--active' : ''}`}
                onClick={() => { onResize(id, s, item.type as 'token' | 'effect'); onClose() }}
              >
                {SIZE_LABELS[i]}
              </button>
            ))}
          </div>
        </>
      )}

      {item.type === 'effect' && (
        <>
          <div className="ctx-divider" />
          <div className="ctx-group-label">Opacity</div>
          <div className="ctx-slider-row">
            <input type="range" min={0} max={1} step={0.05}
              defaultValue={(item.data as Effect).opacity}
              onChange={(e) => onOpacityChange(id, Number(e.target.value))}
            />
          </div>
        </>
      )}

      {item.type === 'token' && onRotate && (
        <>
          <div className="ctx-divider" />
          <button className="ctx-item" onClick={() => { onRotate(id); onClose() }}>
            Rotate 90°
          </button>
        </>
      )}

      {/* ── AOE items ── */}
      {isAoe && localAoe && (
        <>
          {localAoe.shape !== 'circle' && (
            <>
              <div className="ctx-divider" />
              <button className="ctx-item" onClick={() => {
                const step = localAoe.shape === 'triangle' ? 45 : 90
                handleAoeChange({ rotation: (localAoe.rotation + step) % 360 })
              }}>
                Rotate {localAoe.shape === 'triangle' ? '45°' : '90°'}
              </button>
            </>
          )}
          <div className="ctx-divider" />
          <div className="ctx-group-label">Blend</div>
          <div className="ctx-slider-row">
            <select
              value={localAoe.blendMode}
              onChange={(e) => handleAoeChange({ blendMode: e.target.value as AoeBlendMode })}
              style={{
                width: '100%', background: 'var(--bg-input)', color: 'var(--text)',
                border: '1px solid var(--border)', borderRadius: 'var(--radius)',
                padding: '0.2rem 0.3rem', fontSize: '0.8rem', cursor: 'pointer',
              }}
            >
              <option value="normal">Normal</option>
              <option value="multiply">Multiply</option>
              <option value="add">Add</option>
            </select>
          </div>
          <div className="ctx-divider" />
          <div className="ctx-group-label">Opacity</div>
          <div className="ctx-slider-row">
            <input type="range" min={0.1} max={1} step={0.05}
              value={localAoe.opacity}
              onChange={(e) => handleAoeChange({ opacity: Number(e.target.value) })}
            />
          </div>
        </>
      )}

      {/* ── Remove ── */}
      <div className="ctx-divider" />
      {isAoe ? (
        <button className="ctx-item ctx-item--danger"
          onClick={() => { onAoeRemove?.(id); onClose() }}>
          Remove
        </button>
      ) : (
        <button className="ctx-item ctx-item--danger"
          onClick={() => { onRemove(id, item.type as 'token' | 'effect'); onClose() }}>
          Remove
        </button>
      )}
    </div>
  )
}
