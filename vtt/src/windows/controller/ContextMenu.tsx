import { useEffect, useRef, useState } from 'react'
import type { AoeBlendMode, AoeMarker } from '../../shared/types/aoe'
import type { Effect, Token, TokenSize } from '../../shared/types/tokens'

const OUTLINE_COLORS: { value: string | undefined; label: string; display: string }[] = [
  { value: undefined,   label: 'No outline', display: 'transparent' },
  { value: '#000000',   label: 'Black',      display: '#000000' },
  { value: '#22cc44',   label: 'Green',      display: '#22cc44' },
  { value: '#2266ff',   label: 'Blue',       display: '#2266ff' },
  { value: '#ee2222',   label: 'Red',        display: '#ee2222' },
  { value: '#ff8800',   label: 'Orange',     display: '#ff8800' },
  { value: '#ffdd00',   label: 'Yellow',     display: '#ffdd00' },
]

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
  onRotate?: (id: string, dir: 1 | -1) => void
  onSetOutlineColor?: (id: string, color: string | undefined) => void
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
  onRename, onResize, onOpacityChange, onRotate, onSetOutlineColor,
  onAoeUpdate, onAoeRemove, onRemove, onClose,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null)
  const isAoe = item.type === 'aoe'
  const id = item.data.id

  // Local state for live AOE edits (accumulates changes so they compose correctly)
  const [localAoe, setLocalAoe] = useState<AoeMarker | null>(
    isAoe ? (item.data as AoeMarker) : null,
  )
  const [localOutlineColor, setLocalOutlineColor] = useState<string | undefined>(
    item.type === 'token' ? (item.data as Token).outlineColor : undefined,
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

      {(item.type === 'token' || (item.type === 'effect' && (item.data as Effect).shape !== 'circle')) && onRotate && (
        <>
          <div className="ctx-divider" />
          <div className="ctx-group-label">Rotate</div>
          <div className="ctx-size-row">
            <button className="ctx-size-btn" onClick={() => { onRotate(id, -1); onClose() }} title="Rotate counterclockwise">↺ CCW</button>
            <button className="ctx-size-btn" onClick={() => { onRotate(id, 1); onClose() }} title="Rotate clockwise">↻ CW</button>
          </div>
        </>
      )}

      {item.type === 'token' && onSetOutlineColor && (
        <>
          <div className="ctx-divider" />
          <div className="ctx-group-label">Outline</div>
          <div className="ctx-size-row" style={{ flexWrap: 'wrap', gap: '4px', paddingBottom: '2px' }}>
            {OUTLINE_COLORS.map((c) => (
              <button
                key={c.label}
                className={`entity-color-swatch${localOutlineColor === c.value ? ' entity-color-swatch--active' : ''}`}
                style={{ background: c.display, border: c.value === undefined ? '1px dashed var(--border)' : undefined }}
                onClick={() => { setLocalOutlineColor(c.value); onSetOutlineColor(id, c.value) }}
                title={c.label}
              />
            ))}
          </div>
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
