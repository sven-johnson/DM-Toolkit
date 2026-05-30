import { useEffect, useState } from 'react'
import { invoke } from '@tauri-apps/api/core'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { toAssetUrl } from '../../lib/assetUrl'
import { useVttStore } from '../../store/vttStore'
import type { TokenDef, TokenSize } from '../../shared/types/tokens'

type TokenShape = 'none' | 'circle' | 'rounded'
const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp'] }]

function basename(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path
}

interface Props {
  onSelectToken: (def: TokenDef) => void
  onClose: () => void
}

export function TokenModal({ onSelectToken, onClose }: Props) {
  const tokenDefs = useVttStore((s) => s.tokenDefs)
  const cellPx = useVttStore((s) => s.grid.cellSize)
  const { removeTokenDef, addTokenDef } = useVttStore.getState()

  const [view, setView] = useState<'library' | 'add'>('library')
  const [tokenPath, setTokenPath] = useState<string | null>(null)
  const [tokenShape, setTokenShape] = useState<TokenShape>('circle')
  const [gridSquares, setGridSquares] = useState<TokenSize>(1)
  const [processing, setProcessing] = useState(false)
  const [resultPath, setResultPath] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!tokenPath) return
    let cancelled = false
    setProcessing(true)
    setError(null)
    setResultPath(null)
    invoke<string>('process_token_image', { sourcePath: tokenPath, shape: tokenShape, gridSquares, cellPx })
      .then((out) => { if (!cancelled) { setResultPath(out); setProcessing(false) } })
      .catch((e: unknown) => { if (!cancelled) { setError(String(e)); setProcessing(false) } })
    return () => { cancelled = true }
  }, [tokenPath, tokenShape, gridSquares, cellPx])

  async function handleBrowse() {
    const path = await openDialog({ multiple: false, filters: IMAGE_FILTERS })
    if (!path || typeof path !== 'string') return
    setTokenPath(path)
    setResultPath(null)
    setError(null)
  }

  function handleAddToLibrary() {
    if (!resultPath) return
    addTokenDef({
      id: crypto.randomUUID(),
      name: basename(resultPath),
      src: toAssetUrl(resultPath),
      defaultSize: gridSquares,
      shape: tokenShape === 'none' ? 'square' : tokenShape,
    })
    setView('library')
    setTokenPath(null)
    setResultPath(null)
    setError(null)
  }

  const targetPx = cellPx > 0 ? Math.round(gridSquares * cellPx) : null

  if (view === 'add') {
    return (
      <div className="stage-modal" onClick={onClose}>
        <div className="stage-modal-panel" onClick={(e) => e.stopPropagation()}>
          <div className="stage-modal-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <button className="stage-modal-back" onClick={() => setView('library')} title="Back to library">‹</button>
              <span className="stage-modal-title">Add Token</span>
            </div>
            <button className="stage-modal-close" onClick={onClose}>✕</button>
          </div>
          <div className="stage-modal-body">
            <div className="it-row" style={{ marginBottom: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={handleBrowse}>
                {tokenPath ? 'Change Image…' : 'Load Image…'}
              </button>
              {tokenPath && <span className="it-filename">{basename(tokenPath)}</span>}
            </div>

            {tokenPath && (
              <>
                <div className="subsection" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none' }}>
                  <div className="aoe-presets-header" style={{ marginBottom: '0.4rem' }}>Shape</div>
                  <div className="it-btn-group">
                    {(['none', 'circle', 'rounded'] as TokenShape[]).map((s) => (
                      <button
                        key={s}
                        className={`btn btn-secondary${tokenShape === s ? ' it-active' : ''}`}
                        onClick={() => setTokenShape(s)}
                      >
                        {s === 'none' ? 'Square' : s === 'circle' ? 'Circle' : 'Rounded'}
                      </button>
                    ))}
                  </div>
                </div>
                <div className="subsection">
                  <div className="aoe-presets-header" style={{ marginBottom: '0.4rem' }}>Grid Size</div>
                  <div className="it-row">
                    <div className="it-btn-group">
                      {([1, 2, 3] as TokenSize[]).map((n) => (
                        <button
                          key={n}
                          className={`btn btn-secondary${gridSquares === n ? ' it-active' : ''}`}
                          onClick={() => setGridSquares(n)}
                        >
                          {n}×{n}
                        </button>
                      ))}
                    </div>
                    {targetPx && <span className="it-calc">→ {targetPx}px</span>}
                  </div>
                </div>
                {processing && <p className="cal-hint" style={{ marginTop: '0.75rem' }}>Processing…</p>}
                {error && <p className="it-error" style={{ marginTop: '0.75rem' }}>{error}</p>}
                {resultPath && (
                  <img
                    src={toAssetUrl(resultPath)}
                    className="it-result-preview"
                    alt="Processed token"
                    draggable={false}
                    style={{ marginTop: '0.75rem' }}
                  />
                )}
              </>
            )}
          </div>
          <div className="stage-modal-footer">
            <button
              className="btn btn-primary"
              onClick={handleAddToLibrary}
              disabled={!resultPath || processing}
            >
              Add Token
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="stage-modal" onClick={onClose}>
      <div className="stage-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stage-modal-header">
          <span className="stage-modal-title">Tokens</span>
          <button className="stage-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="stage-modal-body">
          {tokenDefs.length === 0 && <p className="cal-hint">No tokens yet. Add one below.</p>}
          <div className="asset-grid">
            {tokenDefs.map((def) => (
              <div
                key={def.id}
                className="asset-card"
                onClick={() => onSelectToken(def)}
                title={`${def.name} — click to place`}
              >
                <img className="asset-thumb" src={def.src} alt={def.name} draggable={false} />
                <span className="asset-name">{def.name}</span>
                <button
                  className="asset-remove"
                  onClick={(e) => { e.stopPropagation(); removeTokenDef(def.id) }}
                  title="Remove from library"
                >×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="stage-modal-footer" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-secondary" onClick={() => setView('add')}>Add Token…</button>
        </div>
      </div>
    </div>
  )
}
