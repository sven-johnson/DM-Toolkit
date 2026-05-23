import { useEffect, useRef, useState } from 'react'
import type { AoeBlendMode, AoeColor, AoeConfig, AoeShape } from '../../shared/types/aoe'
import { AOE_COLOR_HEX, AOE_COLOR_LABELS, AOE_COLORS } from '../../shared/types/aoe'
import {
  type AoePreset,
  deleteAoePreset,
  loadAoePresets,
  saveAoePreset,
} from '../../lib/vttDatabase'

type AlignTo = 'intersection' | 'center' | 'either'

interface Props {
  onPlace: (config: AoeConfig) => void
  isPlacing: boolean
}

export function AoePanel({ onPlace, isPlacing }: Props) {
  const [shape, setShape] = useState<AoeShape>('circle')
  const [radiusFt, setRadiusFt] = useState(20)
  const [widthFt, setWidthFt] = useState(20)
  const [heightFt, setHeightFt] = useState(20)
  const [rectLocked, setRectLocked] = useState(true)
  const [legFt, setLegFt] = useState(30)
  const [baseFt, setBaseFt] = useState(30)
  const [triLocked, setTriLocked] = useState(true)
  const [alignTo, setAlignTo] = useState<AlignTo>('intersection')
  const [color, setColor] = useState<AoeColor>('red')
  const [blendMode, setBlendMode] = useState<AoeBlendMode>('multiply')
  const [opacity, setOpacity] = useState(0.5)

  // Preset state
  const [presets, setPresets] = useState<AoePreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)
  const [presetError, setPresetError] = useState<string | null>(null)
  const presetInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadAoePresets().then(setPresets).catch(() => {/* best-effort */})
  }, [])

  async function refreshPresets() {
    setPresets(await loadAoePresets())
  }

  function clamp(val: number): number { return Math.max(1, Number.isFinite(val) ? val : 1) }

  function handleWidthChange(val: number) {
    const v = clamp(val); setWidthFt(v); if (rectLocked) setHeightFt(v)
  }
  function handleHeightChange(val: number) {
    const v = clamp(val); setHeightFt(v); if (rectLocked) setWidthFt(v)
  }
  function handleRectLock() {
    const next = !rectLocked; setRectLocked(next); if (next) setHeightFt(widthFt)
  }
  function handleLegChange(val: number) {
    const v = clamp(val); setLegFt(v); if (triLocked) setBaseFt(v)
  }
  function handleBaseChange(val: number) {
    const v = clamp(val); setBaseFt(v); if (triLocked) setLegFt(v)
  }
  function handleTriLock() {
    const next = !triLocked; setTriLocked(next); if (next) setBaseFt(legFt)
  }

  function handlePlace() {
    onPlace({ shape, color, blendMode, opacity, rotation: 0, radiusFt, widthFt, heightFt, legFt, baseFt, alignTo })
  }

  function applyPreset(p: AoePreset) {
    setShape(p.shape)
    setColor(p.color)
    setBlendMode(p.blendMode)
    setOpacity(p.opacity)
    setRadiusFt(p.radiusFt)
    setWidthFt(p.widthFt)
    setHeightFt(p.heightFt)
    setLegFt(p.legFt)
    setBaseFt(p.baseFt)
    setAlignTo(p.alignTo)
    setRectLocked(p.widthFt === p.heightFt)
    setTriLocked(p.legFt === p.baseFt)
  }

  async function handleSavePreset() {
    const name = presetName.trim()
    if (!name) return
    setSavingPreset(true)
    setPresetError(null)
    try {
      await saveAoePreset({
        id: crypto.randomUUID(),
        name,
        shape,
        color,
        blendMode,
        opacity,
        radiusFt,
        widthFt,
        heightFt,
        legFt,
        baseFt,
        alignTo,
        rotation: 0,
      })
      setPresetName('')
      await refreshPresets()
    } catch {
      setPresetError('Failed to save preset.')
    } finally {
      setSavingPreset(false)
    }
  }

  async function handleDeletePreset(id: string) {
    try {
      await deleteAoePreset(id)
      await refreshPresets()
    } catch {
      setPresetError('Failed to delete preset.')
    }
  }

  function shapeSummary(p: AoePreset): string {
    if (p.shape === 'circle') return `${p.radiusFt}ft radius`
    if (p.shape === 'rectangle') return `${p.widthFt}×${p.heightFt}ft`
    return `${p.legFt}ft cone`
  }

  return (
    <div>
      {/* Shape selector */}
      <div className="aoe-shape-row">
        {(['circle', 'rectangle', 'triangle'] as AoeShape[]).map((s) => (
          <button
            key={s}
            className={`btn ${shape === s ? 'btn-primary' : 'btn-secondary'}`}
            style={{ flex: 1, padding: '0.3rem 0', fontSize: '0.8rem' }}
            onClick={() => setShape(s)}
          >
            {s === 'circle' ? 'Circle' : s === 'rectangle' ? 'Rect' : 'Triangle'}
          </button>
        ))}
      </div>

      {/* Dimensions */}
      {shape === 'circle' && (
        <div className="aoe-field-row">
          <span className="aoe-field-label">Radius</span>
          <input className="aoe-ft-input" type="number" min={1} value={radiusFt}
            onChange={(e) => setRadiusFt(clamp(Number(e.target.value)))} />
          <span className="aoe-ft-unit">ft</span>
        </div>
      )}

      {shape === 'rectangle' && (
        <>
          <div className="aoe-field-row">
            <span className="aoe-field-label">{rectLocked ? 'Size' : 'Width'}</span>
            <input className="aoe-ft-input" type="number" min={1} value={widthFt}
              onChange={(e) => handleWidthChange(Number(e.target.value))} />
            <span className="aoe-ft-unit">ft</span>
            <button
              className={`aoe-lock-btn ${rectLocked ? 'aoe-lock-btn--active' : ''}`}
              onClick={handleRectLock}
              title={rectLocked ? 'Unlock — set width and height separately' : 'Lock as square'}
            >
              {rectLocked ? 'Square' : 'Unlock'}
            </button>
          </div>
          {!rectLocked && (
            <div className="aoe-field-row">
              <span className="aoe-field-label">Height</span>
              <input className="aoe-ft-input" type="number" min={1} value={heightFt}
                onChange={(e) => handleHeightChange(Number(e.target.value))} />
              <span className="aoe-ft-unit">ft</span>
            </div>
          )}
        </>
      )}

      {shape === 'triangle' && (
        <>
          <div className="aoe-field-row">
            <span className="aoe-field-label">{triLocked ? 'Size' : 'Range'}</span>
            <input className="aoe-ft-input" type="number" min={1} value={legFt}
              onChange={(e) => handleLegChange(Number(e.target.value))} />
            <span className="aoe-ft-unit">ft</span>
            <button
              className={`aoe-lock-btn ${triLocked ? 'aoe-lock-btn--active' : ''}`}
              onClick={handleTriLock}
              title={triLocked ? 'Unlock — set range and base separately' : 'Lock range = base'}
            >
              {triLocked ? '= Base' : 'Unlock'}
            </button>
          </div>
          {!triLocked && (
            <div className="aoe-field-row">
              <span className="aoe-field-label">Base</span>
              <input className="aoe-ft-input" type="number" min={1} value={baseFt}
                onChange={(e) => handleBaseChange(Number(e.target.value))} />
              <span className="aoe-ft-unit">ft</span>
            </div>
          )}
          <div className="aoe-field-row" style={{ marginTop: '0.35rem' }}>
            <span className="aoe-field-label">Align To</span>
            <label className="aoe-radio-label">
              <input type="radio" name="aoe-align" value="intersection"
                checked={alignTo === 'intersection'} onChange={() => setAlignTo('intersection')} />
              Intersection
            </label>
            <label className="aoe-radio-label">
              <input type="radio" name="aoe-align" value="center"
                checked={alignTo === 'center'} onChange={() => setAlignTo('center')} />
              Center
            </label>
            <label className="aoe-radio-label">
              <input type="radio" name="aoe-align" value="either"
                checked={alignTo === 'either'} onChange={() => setAlignTo('either')} />
              Either
            </label>
          </div>
        </>
      )}

      {/* Color swatches */}
      <div className="aoe-color-row">
        {AOE_COLORS.map((c) => (
          <button
            key={c}
            className={`aoe-swatch ${color === c ? 'aoe-swatch--active' : ''}`}
            style={{ background: AOE_COLOR_HEX[c] }}
            onClick={() => setColor(c)}
            title={AOE_COLOR_LABELS[c]}
          />
        ))}
      </div>

      {/* Blend mode */}
      <div className="aoe-field-row">
        <span className="aoe-field-label">Blend</span>
        <select className="aoe-blend-select" value={blendMode}
          onChange={(e) => setBlendMode(e.target.value as AoeBlendMode)}>
          <option value="normal">Normal</option>
          <option value="multiply">Multiply</option>
          <option value="add">Add</option>
        </select>
      </div>

      {/* Opacity slider */}
      <div className="slider-row" style={{ marginBottom: '0.75rem' }}>
        <span className="slider-label">Opacity</span>
        <input type="range" min={0.1} max={1} step={0.05} value={opacity}
          onChange={(e) => setOpacity(Number(e.target.value))} />
        <span className="slider-value">{Math.round(opacity * 100)}%</span>
      </div>

      {isPlacing && <p className="cal-hint">Click the map to place · Esc to cancel</p>}
      <button
        className={`btn ${isPlacing ? 'btn-primary' : 'btn-secondary'}`}
        onClick={handlePlace}
      >
        {isPlacing ? 'Placing…' : 'Place on Map'}
      </button>

      {/* ── AOE Presets ── */}
      <div className="aoe-presets-section">
        <div className="aoe-presets-header">Presets</div>

        <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
          <input
            ref={presetInputRef}
            className="cal-input"
            style={{ flex: 1, width: 'auto' }}
            placeholder="Preset name…"
            value={presetName}
            onChange={(e) => setPresetName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') void handleSavePreset() }}
          />
          <button
            className="btn btn-secondary"
            style={{ fontSize: '0.75rem', padding: '0.2rem 0.6rem', whiteSpace: 'nowrap' }}
            onClick={() => void handleSavePreset()}
            disabled={!presetName.trim() || savingPreset}
          >
            {savingPreset ? '…' : 'Save'}
          </button>
        </div>

        {presetError && (
          <p style={{ fontSize: '0.75rem', color: 'var(--danger)', margin: '0 0 0.4rem' }}>{presetError}</p>
        )}

        {presets.length === 0 ? (
          <p className="cal-hint" style={{ margin: 0 }}>No AOE presets saved yet.</p>
        ) : (
          <div className="preset-list">
            {presets.map((p) => (
              <div key={p.id} className="preset-row">
                <div className="preset-info">
                  <span className="preset-name">{p.name}</span>
                  <span className="preset-date" style={{ display: 'flex', alignItems: 'center', gap: '0.3rem' }}>
                    <span
                      className="aoe-swatch"
                      style={{
                        background: AOE_COLOR_HEX[p.color],
                        width: 10, height: 10,
                        display: 'inline-block',
                        borderRadius: '50%',
                        flexShrink: 0,
                        border: 'none',
                      }}
                    />
                    {shapeSummary(p)}
                  </span>
                </div>
                <div className="preset-actions">
                  <button
                    className="btn btn-secondary"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                    onClick={() => applyPreset(p)}
                  >
                    Load
                  </button>
                  <button
                    className="btn btn-danger"
                    style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                    onClick={() => void handleDeletePreset(p.id)}
                    title="Delete preset"
                  >
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
