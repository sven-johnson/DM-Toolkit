import { useEffect, useMemo, useState } from 'react'
import { emit } from '@tauri-apps/api/event'
import { VTT_EVENTS } from '../../shared/types/ipc'
import type { GridConfigPayload } from '../../shared/types/ipc'
import {
  DEFAULT_CALIBRATION,
  loadCalibration,
  saveCalibration,
} from '../../hooks/useCalibrationStore'
import { useVttStore } from '../../store/vttStore'
import { CalibrationPreview } from './CalibrationPreview'

interface Props {
  playerReady: boolean
  onLog: (msg: string) => void
}

const hexToNum = (hex: string): number => parseInt(hex.replace('#', ''), 16)

export function CalibrationPanel({ playerReady, onLog }: Props) {
  const [loaded, setLoaded] = useState(false)
  const [saving, setSaving] = useState(false)

  const [tvDiagonal, setTvDiagonal] = useState(DEFAULT_CALIBRATION.tvDiagonal)
  const [tvWidth, setTvWidth]       = useState(DEFAULT_CALIBRATION.tvWidth)
  const [tvHeight, setTvHeight]     = useState(DEFAULT_CALIBRATION.tvHeight)
  const [gridColor, setGridColor]   = useState(DEFAULT_CALIBRATION.gridColor)
  const [lineWidth, setLineWidth]   = useState(DEFAULT_CALIBRATION.lineWidth)
  const [opacity, setOpacity]       = useState(DEFAULT_CALIBRATION.opacity)
  const [originX, setOriginX]       = useState(DEFAULT_CALIBRATION.originX)
  const [originY, setOriginY]       = useState(DEFAULT_CALIBRATION.originY)

  const { ppi, cellPx } = useMemo(() => {
    const d = tvDiagonal > 0 ? tvDiagonal : 1
    const ppi = Math.sqrt(tvWidth ** 2 + tvHeight ** 2) / d
    return { ppi, cellPx: ppi }
  }, [tvDiagonal, tvWidth, tvHeight])

  // Load persisted calibration on mount
  useEffect(() => {
    loadCalibration().then((data) => {
      setTvDiagonal(data.tvDiagonal)
      setTvWidth(data.tvWidth)
      setTvHeight(data.tvHeight)
      setGridColor(data.gridColor)
      setLineWidth(data.lineWidth)
      setOpacity(data.opacity)
      setOriginX(data.originX)
      setOriginY(data.originY)
      setLoaded(true)
    })
  }, [])

  // Keep store tvDimensions in sync so StageMap can compute its scale
  useEffect(() => {
    useVttStore.getState().setTvDimensions(tvWidth, tvHeight)
  }, [tvWidth, tvHeight])

  // Live-push to PlayerView whenever any calibration value changes
  useEffect(() => {
    if (!playerReady || !loaded || cellPx <= 0) return
    const payload: GridConfigPayload = {
      cellSize: cellPx,
      color: hexToNum(gridColor),
      lineWidth,
      opacity,
      originX,
      originY,
    }
    void emit(VTT_EVENTS.GRID_CONFIG, payload)
  }, [playerReady, loaded, cellPx, gridColor, lineWidth, opacity, originX, originY])

  async function handleSave() {
    setSaving(true)
    try {
      await saveCalibration({
        tvDiagonal, tvWidth, tvHeight,
        gridColor, lineWidth, opacity, originX, originY,
      })
      onLog('Calibration saved.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      {/* TV Size */}
      <div className="subsection">
        <h3>TV Size</h3>
        <div className="cal-row">
          <span className="cal-label">Diagonal</span>
          <input
            className="cal-input"
            type="number"
            min={10}
            max={200}
            step={0.5}
            value={tvDiagonal}
            onChange={(e) => setTvDiagonal(Number(e.target.value))}
          />
          <span className="cal-unit">in</span>
        </div>
        <div className="cal-row">
          <span className="cal-label">Resolution</span>
          <input
            className="cal-input"
            type="number"
            min={640}
            max={7680}
            step={1}
            value={tvWidth}
            onChange={(e) => setTvWidth(Number(e.target.value))}
          />
          <span className="cal-sep">×</span>
          <input
            className="cal-input"
            type="number"
            min={360}
            max={4320}
            step={1}
            value={tvHeight}
            onChange={(e) => setTvHeight(Number(e.target.value))}
          />
          <span className="cal-unit">px</span>
        </div>
      </div>

      {/* Calculated */}
      <div className="subsection">
        <h3>Calculated</h3>
        <div className="cal-row">
          <span className="cal-label">PPI</span>
          <span className="cal-result">{ppi.toFixed(2)}</span>
          <span className="cal-unit">px / in</span>
        </div>
        <div className="cal-row">
          <span className="cal-label">Cell size</span>
          <span className="cal-result">{cellPx.toFixed(2)}</span>
          <span className="cal-unit">px &nbsp;·&nbsp; 1 in = 5 ft</span>
        </div>
      </div>

      {/* Preview */}
      <div className="subsection">
        <h3>Preview</h3>
        <p className="cal-hint">Drag to reposition grid origin</p>
        <CalibrationPreview
          cellPx={cellPx}
          tvWidth={tvWidth}
          color={gridColor}
          lineWidth={lineWidth}
          opacity={opacity}
          originX={originX}
          originY={originY}
          onOriginChange={(x, y) => { setOriginX(x); setOriginY(y) }}
        />
      </div>

      {/* Grid Style */}
      <div className="subsection">
        <h3>Grid Style</h3>
        <div className="grid-controls">
          <div className="cal-row">
            <span className="cal-label">Color</span>
            <input
              type="color"
              className="color-input"
              value={gridColor}
              onChange={(e) => setGridColor(e.target.value)}
            />
          </div>
          <div className="slider-row">
            <span className="slider-label">Line width</span>
            <input
              type="range"
              min={0.5}
              max={4}
              step={0.5}
              value={lineWidth}
              onChange={(e) => setLineWidth(Number(e.target.value))}
            />
            <span className="slider-value">{lineWidth} px</span>
          </div>
          <div className="slider-row">
            <span className="slider-label">Opacity</span>
            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={opacity}
              onChange={(e) => setOpacity(Number(e.target.value))}
            />
            <span className="slider-value">{Math.round(opacity * 100)}%</span>
          </div>
        </div>
      </div>

      {/* Grid Origin */}
      <div className="subsection">
        <h3>Grid Origin</h3>
        <div className="grid-controls">
          <div className="cal-row">
            <span className="cal-label">Offset X</span>
            <input
              className="cal-input"
              type="number"
              min={0}
              max={tvWidth}
              step={1}
              value={originX}
              onChange={(e) => setOriginX(Number(e.target.value))}
            />
            <span className="cal-unit">px</span>
          </div>
          <div className="cal-row">
            <span className="cal-label">Offset Y</span>
            <input
              className="cal-input"
              type="number"
              min={0}
              max={tvHeight}
              step={1}
              value={originY}
              onChange={(e) => setOriginY(Number(e.target.value))}
            />
            <span className="cal-unit">px</span>
          </div>
        </div>
      </div>

      {/* Save */}
      <div className="cal-actions">
        <button className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save Calibration'}
        </button>
      </div>
    </>
  )
}
