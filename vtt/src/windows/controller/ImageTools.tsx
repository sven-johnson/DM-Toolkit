import { useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { toAssetUrl } from '../../lib/assetUrl'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { emit } from '@tauri-apps/api/event'
import { VTT_EVENTS } from '../../shared/types/ipc'
import { useVttStore } from '../../store/vttStore'
import type { TokenSize } from '../../shared/types/tokens'
import { CropSelector } from './CropSelector'
import type { CropRect } from './CropSelector'

type TokenShape = 'none' | 'circle' | 'rounded'
type MapOp = 'resize1080' | 'crop'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]

function fileStem(path: string): string {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? 'processed'
}

interface Props {
  playerReady: boolean
  onError: (context: string, message: string) => void
}

export function ImageTools({ playerReady, onError }: Props) {
  const cellPx = useVttStore((s) => s.grid.cellSize)
  const { addTokenDef } = useVttStore.getState()

  // ── Token processor state ─────────────────────────────────────────────────
  const [tokenPath, setTokenPath] = useState<string | null>(null)
  const [tokenShape, setTokenShape] = useState<TokenShape>('circle')
  const [gridSquares, setGridSquares] = useState<TokenSize>(1)

  // ── Map processor state ───────────────────────────────────────────────────
  const [mapPath, setMapPath] = useState<string | null>(null)
  const [mapOrigSize, setMapOrigSize] = useState<{ w: number; h: number } | null>(null)
  const [mapOp, setMapOp] = useState<MapOp>('resize1080')
  const [cropRect, setCropRect] = useState<CropRect | null>(null)

  // ── Shared result state ───────────────────────────────────────────────────
  const [processing, setProcessing] = useState(false)
  const [resultPath, setResultPath] = useState<string | null>(null)
  const [resultKind, setResultKind] = useState<'token' | 'map' | null>(null)
  const [error, setError] = useState<string | null>(null)

  // ── Helpers ───────────────────────────────────────────────────────────────

  function clearResult() {
    setResultPath(null)
    setResultKind(null)
    setError(null)
  }

  async function pickImage(setter: (p: string) => void) {
    const path = await openDialog({ multiple: false, filters: IMAGE_FILTERS })
    if (!path || typeof path !== 'string') return
    setter(path)
    clearResult()
  }

  function handleImageLoad(e: React.SyntheticEvent<HTMLImageElement>, setter: (s: { w: number; h: number }) => void) {
    const img = e.currentTarget
    setter({ w: img.naturalWidth, h: img.naturalHeight })
  }

  // ── Token processing ──────────────────────────────────────────────────────

  async function handleProcessToken() {
    if (!tokenPath) return
    setProcessing(true)
    setError(null)
    try {
      const out = await invoke<string>('process_token_image', {
        sourcePath: tokenPath,
        shape: tokenShape,
        gridSquares,
        cellPx,
      })
      setResultPath(out)
      setResultKind('token')
    } catch (e) {
      const msg = String(e)
      setError(msg)
      onError('ImageTools.processToken', msg)
    } finally {
      setProcessing(false)
    }
  }

  // ── Map processing ────────────────────────────────────────────────────────

  async function handleProcessMap() {
    if (!mapPath) return
    setProcessing(true)
    setError(null)
    try {
      const operation =
        mapOp === 'resize1080'
          ? { type: 'resize1080' }
          : cropRect
          ? { type: 'crop', x: cropRect.x, y: cropRect.y, width: cropRect.width, height: cropRect.height }
          : null

      if (!operation) {
        setError('Draw a crop region first.')
        return
      }

      const out = await invoke<string>('process_map_image', {
        sourcePath: mapPath,
        operation,
      })
      setResultPath(out)
      setResultKind('map')
    } catch (e) {
      const msg = String(e)
      setError(msg)
      onError('ImageTools.processMap', msg)
    } finally {
      setProcessing(false)
    }
  }

  // ── Result actions ────────────────────────────────────────────────────────

  function handleAddToLibrary() {
    if (!resultPath) return
    addTokenDef({
      id: crypto.randomUUID(),
      name: fileStem(resultPath),
      src: toAssetUrl(resultPath),
      defaultSize: gridSquares,
    })
  }

  function handleSetAsBackground() {
    if (!resultPath || !playerReady) return
    void emit(VTT_EVENTS.BACKGROUND_LOADED, { src: toAssetUrl(resultPath) })
  }

  // ── Render ────────────────────────────────────────────────────────────────

  const targetPx = Math.round(gridSquares * cellPx)

  return (
    <div className="image-tools">

      {/* ── Token Processor ──────────────────────────────────────────────── */}
      <section className="control-section">
        <h2>Token Processor</h2>

        <div className="subsection">
          <h3>Source Image</h3>
          <div className="it-row">
            <button className="btn btn-secondary" onClick={() => pickImage(setTokenPath)}>
              {tokenPath ? 'Change…' : 'Load Image…'}
            </button>
            {tokenPath && <span className="it-filename">{fileStem(tokenPath)}</span>}
          </div>
          {tokenPath && (
            <img
              src={toAssetUrl(tokenPath)}
              className="it-preview"
              alt="Token source"
              draggable={false}
            />
          )}
        </div>

        <div className="subsection">
          <h3>Shape</h3>
          <div className="it-btn-group">
            {(['none', 'circle', 'rounded'] as TokenShape[]).map((s) => (
              <button
                key={s}
                className={`btn btn-secondary ${tokenShape === s ? 'it-active' : ''}`}
                onClick={() => setTokenShape(s)}
              >
                {s === 'none' ? 'Square' : s === 'circle' ? 'Circle' : 'Rounded'}
              </button>
            ))}
          </div>
        </div>

        <div className="subsection">
          <h3>Grid Size</h3>
          <div className="it-row">
            <div className="it-btn-group">
              {([1, 2, 3] as TokenSize[]).map((n) => (
                <button
                  key={n}
                  className={`btn btn-secondary ${gridSquares === n ? 'it-active' : ''}`}
                  onClick={() => setGridSquares(n)}
                >
                  {n}×{n}
                </button>
              ))}
            </div>
            {cellPx > 0 && (
              <span className="it-calc">
                → {targetPx} × {targetPx} px
              </span>
            )}
          </div>
        </div>

        <div className="subsection">
          <button
            className="btn btn-primary"
            onClick={handleProcessToken}
            disabled={!tokenPath || processing}
          >
            {processing ? 'Processing…' : 'Process Token'}
          </button>
        </div>
      </section>

      {/* ── Map Processor ────────────────────────────────────────────────── */}
      <section className="control-section">
        <h2>Map Processor</h2>

        <div className="subsection">
          <h3>Source Image</h3>
          <div className="it-row">
            <button className="btn btn-secondary" onClick={() => { pickImage(setMapPath); setMapOrigSize(null); setCropRect(null) }}>
              {mapPath ? 'Change…' : 'Load Image…'}
            </button>
            {mapPath && <span className="it-filename">{fileStem(mapPath)}</span>}
          </div>
          {mapPath && mapOrigSize && (
            <span className="it-muted">{mapOrigSize.w} × {mapOrigSize.h} px</span>
          )}
        </div>

        <div className="subsection">
          <h3>Operation</h3>
          <div className="it-btn-group">
            <button
              className={`btn btn-secondary ${mapOp === 'resize1080' ? 'it-active' : ''}`}
              onClick={() => setMapOp('resize1080')}
            >
              Resize to 1920×1080
            </button>
            <button
              className={`btn btn-secondary ${mapOp === 'crop' ? 'it-active' : ''}`}
              onClick={() => setMapOp('crop')}
            >
              Crop Region
            </button>
          </div>
        </div>

        {mapOp === 'crop' && mapPath && (
          <div className="subsection">
            <h3>Draw Crop Region</h3>
            <p className="cal-hint">Drag to select the area to keep.</p>
            {cropRect && (
              <p className="it-calc" style={{ marginBottom: '0.4rem' }}>
                Selection: {cropRect.width} × {cropRect.height} px at ({cropRect.x}, {cropRect.y})
              </p>
            )}
            <CropSelector
              imageSrc={toAssetUrl(mapPath)}
              originalWidth={mapOrigSize?.w ?? 1920}
              originalHeight={mapOrigSize?.h ?? 1080}
              onCropChange={setCropRect}
            />
            {/* Hidden img to read natural dimensions */}
            <img
              src={toAssetUrl(mapPath)}
              style={{ display: 'none' }}
              onLoad={(e) => handleImageLoad(e, setMapOrigSize)}
              alt=""
            />
          </div>
        )}

        <div className="subsection">
          <button
            className="btn btn-primary"
            onClick={handleProcessMap}
            disabled={!mapPath || processing || (mapOp === 'crop' && !cropRect)}
          >
            {processing ? 'Processing…' : 'Process Map'}
          </button>
        </div>
      </section>

      {/* ── Result ───────────────────────────────────────────────────────── */}
      {(resultPath || error) && (
        <section className="control-section">
          <h2>Result</h2>

          {error && <p className="it-error">{error}</p>}

          {resultPath && (
            <>
              <img
                src={toAssetUrl(resultPath)}
                className="it-result-preview"
                alt="Processed result"
                draggable={false}
              />
              <div className="it-actions">
                {resultKind === 'token' && (
                  <button className="btn btn-secondary" onClick={handleAddToLibrary}>
                    Add to Token Library
                  </button>
                )}
                <button
                  className="btn btn-secondary"
                  onClick={handleSetAsBackground}
                  disabled={!playerReady}
                  title={!playerReady ? 'Open Player View first' : undefined}
                >
                  Set as Background
                </button>
              </div>
              <p className="it-path" title={resultPath}>
                Saved: {resultPath.split(/[\\/]/).slice(-2).join('/')}
              </p>
            </>
          )}
        </section>
      )}
    </div>
  )
}
