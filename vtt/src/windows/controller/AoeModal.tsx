import { useEffect, useState } from 'react'
import type { AoeBlendMode, AoeColor, AoeConfig, AoeShape } from '../../shared/types/aoe'
import { AOE_COLOR_HEX, AOE_COLOR_LABELS, AOE_COLORS } from '../../shared/types/aoe'
import { type AoePreset, deleteAoePreset, loadAoePresets, saveAoePreset } from '../../lib/vttDatabase'

type AlignTo = 'intersection' | 'center' | 'either'

interface Props {
  onPlace: (config: AoeConfig) => void
  isPlacing: boolean
  onClose: () => void
}

function CircleSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <circle cx="10" cy="10" r="8" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function RectSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <rect x="2" y="4" width="16" height="12" stroke="currentColor" strokeWidth="1.5" />
    </svg>
  )
}

function TriSvg() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <polygon points="10,2 19,18 1,18" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  )
}

const SHAPE_ICONS: Record<AoeShape, React.ReactNode> = {
  circle: <CircleSvg />,
  rectangle: <RectSvg />,
  triangle: <TriSvg />,
}

const SHAPE_LABELS: Record<AoeShape, string> = {
  circle: 'Circle',
  rectangle: 'Rect',
  triangle: 'Triangle',
}

export function AoeModal({ onPlace, isPlacing, onClose }: Props) {
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
  const [presets, setPresets] = useState<AoePreset[]>([])
  const [presetName, setPresetName] = useState('')
  const [savingPreset, setSavingPreset] = useState(false)

  useEffect(() => {
    loadAoePresets().then(setPresets).catch(() => {})
  }, [])

  async function refreshPresets() {
    setPresets(await loadAoePresets())
  }

  function clamp(v: number) { return Math.max(1, Number.isFinite(v) ? v : 1) }
  function handleWidthChange(v: number) { const n = clamp(v); setWidthFt(n); if (rectLocked) setHeightFt(n) }
  function handleHeightChange(v: number) { const n = clamp(v); setHeightFt(n); if (rectLocked) setWidthFt(n) }
  function handleRectLock() { const next = !rectLocked; setRectLocked(next); if (next) setHeightFt(widthFt) }
  function handleLegChange(v: number) { const n = clamp(v); setLegFt(n); if (triLocked) setBaseFt(n) }
  function handleBaseChange(v: number) { const n = clamp(v); setBaseFt(n); if (triLocked) setLegFt(n) }
  function handleTriLock() { const next = !triLocked; setTriLocked(next); if (next) setBaseFt(legFt) }

  function currentConfig(): AoeConfig {
    return { shape, color, blendMode, opacity, rotation: 0, radiusFt, widthFt, heightFt, legFt, baseFt, alignTo }
  }

  function applyPreset(p: AoePreset) {
    setShape(p.shape); setColor(p.color); setBlendMode(p.blendMode); setOpacity(p.opacity)
    setRadiusFt(p.radiusFt); setWidthFt(p.widthFt); setHeightFt(p.heightFt)
    setLegFt(p.legFt); setBaseFt(p.baseFt); setAlignTo(p.alignTo)
    setRectLocked(p.widthFt === p.heightFt); setTriLocked(p.legFt === p.baseFt)
  }

  function handlePresetClick(p: AoePreset) {
    applyPreset(p)
    onPlace({ shape: p.shape, color: p.color, blendMode: p.blendMode, opacity: p.opacity, rotation: 0,
      radiusFt: p.radiusFt, widthFt: p.widthFt, heightFt: p.heightFt, legFt: p.legFt, baseFt: p.baseFt, alignTo: p.alignTo })
  }

  async function handleSavePreset() {
    const name = presetName.trim()
    if (!name) return
    setSavingPreset(true)
    try {
      await saveAoePreset({ id: crypto.randomUUID(), name, shape, color, blendMode, opacity,
        radiusFt, widthFt, heightFt, legFt, baseFt, alignTo, rotation: 0 })
      setPresetName('')
      await refreshPresets()
    } finally {
      setSavingPreset(false)
    }
  }

  async function handleDeletePreset(id: string) {
    await deleteAoePreset(id)
    await refreshPresets()
  }

  function shapeSummary(p: AoePreset) {
    if (p.shape === 'circle') return `${p.radiusFt}ft r`
    if (p.shape === 'rectangle') return `${p.widthFt}×${p.heightFt}ft`
    return `${p.legFt}ft cone`
  }

  return (
    <div className="stage-modal" onClick={onClose}>
      <div className="stage-modal-panel stage-modal-panel--aoe" onClick={(e) => e.stopPropagation()}>
        <div className="stage-modal-header">
          <span className="stage-modal-title">AOE Markers</span>
          <button className="stage-modal-close" onClick={onClose}>✕</button>
        </div>

        <div className="aoe-modal-body">
          {/* Left: preset list */}
          <div className="aoe-modal-presets">
            <div className="aoe-presets-header">Presets</div>
            {presets.length === 0 ? (
              <p className="cal-hint" style={{ margin: 0 }}>No presets saved.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem' }}>
                {presets.map((p) => (
                  <div key={p.id} className="aoe-modal-preset-row">
                    <button className="aoe-modal-preset-btn" onClick={() => handlePresetClick(p)} title="Apply and place">
                      <span className="preset-name">{p.name}</span>
                      <span className="preset-date" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span style={{ width: 8, height: 8, borderRadius: '50%', background: AOE_COLOR_HEX[p.color], display: 'inline-block', flexShrink: 0 }} />
                        {shapeSummary(p)}
                      </span>
                    </button>
                    <button
                      className="btn btn-danger"
                      style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', flexShrink: 0 }}
                      onClick={() => void handleDeletePreset(p.id)}
                      title="Delete preset"
                    >✕</button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: form */}
          <div className="aoe-modal-form">
            <div className="aoe-shape-row" style={{ marginBottom: '0.75rem' }}>
              {(['circle', 'rectangle', 'triangle'] as AoeShape[]).map((s) => (
                <button
                  key={s}
                  className={`aoe-shape-btn${shape === s ? ' aoe-shape-btn--active' : ''}`}
                  onClick={() => setShape(s)}
                  title={SHAPE_LABELS[s]}
                >
                  {SHAPE_ICONS[s]}
                </button>
              ))}
            </div>

            {shape === 'circle' && (
              <div className="aoe-field-row">
                <span className="aoe-field-label">Radius</span>
                <input className="aoe-ft-input" type="number" min={5} step={5} value={radiusFt}
                  onChange={(e) => setRadiusFt(clamp(Number(e.target.value)))} />
                <span className="aoe-ft-unit">ft</span>
              </div>
            )}
            {shape === 'rectangle' && (
              <>
                <div className="aoe-field-row">
                  <span className="aoe-field-label">{rectLocked ? 'Size' : 'Width'}</span>
                  <input className="aoe-ft-input" type="number" min={5} step={5} value={widthFt}
                    onChange={(e) => handleWidthChange(Number(e.target.value))} />
                  <span className="aoe-ft-unit">ft</span>
                  <button className={`aoe-lock-btn${rectLocked ? ' aoe-lock-btn--active' : ''}`}
                    onClick={handleRectLock} title={rectLocked ? 'Unlock' : 'Lock square'}
                  >{rectLocked ? 'Sq' : '↔'}</button>
                </div>
                {!rectLocked && (
                  <div className="aoe-field-row">
                    <span className="aoe-field-label">Height</span>
                    <input className="aoe-ft-input" type="number" min={5} step={5} value={heightFt}
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
                  <input className="aoe-ft-input" type="number" min={5} step={5} value={legFt}
                    onChange={(e) => handleLegChange(Number(e.target.value))} />
                  <span className="aoe-ft-unit">ft</span>
                  <button className={`aoe-lock-btn${triLocked ? ' aoe-lock-btn--active' : ''}`}
                    onClick={handleTriLock} title={triLocked ? 'Unlock' : 'Lock'}
                  >{triLocked ? '=' : '↔'}</button>
                </div>
                {!triLocked && (
                  <div className="aoe-field-row">
                    <span className="aoe-field-label">Base</span>
                    <input className="aoe-ft-input" type="number" min={5} step={5} value={baseFt}
                      onChange={(e) => handleBaseChange(Number(e.target.value))} />
                    <span className="aoe-ft-unit">ft</span>
                  </div>
                )}
                <div className="aoe-field-row" style={{ marginTop: '0.35rem' }}>
                  <span className="aoe-field-label">Align</span>
                  <label className="aoe-radio-label">
                    <input type="radio" name="aoe-align" value="intersection"
                      checked={alignTo === 'intersection'} onChange={() => setAlignTo('intersection')} />
                    Intersect
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

            <div className="aoe-color-row">
              {AOE_COLORS.map((c) => (
                <button
                  key={c}
                  className={`aoe-swatch${color === c ? ' aoe-swatch--active' : ''}`}
                  style={{ background: AOE_COLOR_HEX[c] }}
                  onClick={() => setColor(c)}
                  title={AOE_COLOR_LABELS[c]}
                />
              ))}
            </div>

            <div className="aoe-field-row">
              <span className="aoe-field-label">Blend</span>
              <select className="aoe-blend-select" value={blendMode}
                onChange={(e) => setBlendMode(e.target.value as AoeBlendMode)}>
                <option value="normal">Normal</option>
                <option value="multiply">Multiply</option>
                <option value="add">Add</option>
              </select>
            </div>

            <div className="slider-row">
              <span className="slider-label">Opacity</span>
              <input type="range" min={0.1} max={1} step={0.05} value={opacity}
                onChange={(e) => setOpacity(Number(e.target.value))} />
              <span className="slider-value">{Math.round(opacity * 100)}%</span>
            </div>
          </div>
        </div>

        <div className="stage-modal-footer">
          <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flex: 1 }}>
            <input
              className="cal-input"
              style={{ flex: 1, width: 'auto' }}
              placeholder="Preset name…"
              value={presetName}
              onChange={(e) => setPresetName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void handleSavePreset() }}
            />
            <button
              className="btn btn-secondary"
              style={{ fontSize: '0.8rem', padding: '0.3rem 0.7rem', whiteSpace: 'nowrap' }}
              onClick={() => void handleSavePreset()}
              disabled={!presetName.trim() || savingPreset}
            >
              {savingPreset ? '…' : 'Save'}
            </button>
          </div>
          <button
            className={`btn${isPlacing ? ' btn-primary' : ' btn-secondary'}`}
            onClick={() => onPlace(currentConfig())}
          >
            {isPlacing ? 'Placing…' : 'Place'}
          </button>
        </div>
      </div>
    </div>
  )
}
