import { toAssetUrl } from '../../lib/assetUrl'
import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { useVttStore } from '../../store/vttStore'
import type { EffectDef, TokenDef, TokenSize } from '../../shared/types/tokens'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
const DEFAULT_SIZE: TokenSize = 1

function basename(path: string): string {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path
}

interface Props {
  activeDef: TokenDef | EffectDef | null
  activeType: 'token' | 'effect' | null
  onDefSelect: (def: TokenDef | EffectDef, type: 'token' | 'effect') => void
}

export function TokenPanel({ activeDef, activeType, onDefSelect }: Props) {
  const tokenDefs = useVttStore((s) => s.tokenDefs)
  const effectDefs = useVttStore((s) => s.effectDefs)
  const { addTokenDef, removeTokenDef, addEffectDef, removeEffectDef } = useVttStore.getState()

  async function handleAddToken() {
    const path = await openDialog({ multiple: false, filters: IMAGE_FILTERS })
    if (!path || typeof path !== 'string') return
    const def: TokenDef = {
      id: crypto.randomUUID(),
      name: basename(path),
      src: toAssetUrl(path),
      defaultSize: DEFAULT_SIZE,
    }
    addTokenDef(def)
  }

  async function handleAddEffect() {
    const path = await openDialog({ multiple: false, filters: IMAGE_FILTERS })
    if (!path || typeof path !== 'string') return
    const def: EffectDef = {
      id: crypto.randomUUID(),
      name: basename(path),
      src: toAssetUrl(path),
      shape: 'square',
      defaultSize: DEFAULT_SIZE,
      defaultOpacity: 0.7,
    }
    addEffectDef(def)
  }

  function startTokenDrag(e: React.DragEvent, def: TokenDef) {
    e.dataTransfer.setData('application/vtt', JSON.stringify({ defId: def.id, type: 'token' }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  function startEffectDrag(e: React.DragEvent, def: EffectDef) {
    e.dataTransfer.setData('application/vtt', JSON.stringify({ defId: def.id, type: 'effect' }))
    e.dataTransfer.effectAllowed = 'copy'
  }

  return (
    <>
      {/* Tokens */}
      <div className="subsection">
        <h3>Tokens</h3>
        {(activeDef && activeType === 'token') && (
          <p className="cal-hint">Click the map to place · Esc to cancel</p>
        )}
        <div className="asset-grid">
          {tokenDefs.map((def) => (
            <div
              key={def.id}
              className={`asset-card ${activeDef?.id === def.id && activeType === 'token' ? 'asset-card--active' : ''}`}
              draggable
              onDragStart={(e) => startTokenDrag(e, def)}
              onClick={() => onDefSelect(def, 'token')}
              title={`${def.name} — click to place on map`}
            >
              <img className="asset-thumb" src={def.src} alt={def.name} draggable={false} />
              <span className="asset-name">{def.name}</span>
              <button
                className="asset-remove"
                onClick={(e) => { e.stopPropagation(); removeTokenDef(def.id) }}
                title="Remove from library"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleAddToken}>
          Add Token…
        </button>
      </div>

      {/* Effects */}
      <div className="subsection">
        <h3>Effects</h3>
        {(activeDef && activeType === 'effect') && (
          <p className="cal-hint">Click the map to place · Esc to cancel</p>
        )}
        <div className="asset-grid">
          {effectDefs.map((def) => (
            <div
              key={def.id}
              className={`asset-card ${activeDef?.id === def.id && activeType === 'effect' ? 'asset-card--active' : ''}`}
              draggable
              onDragStart={(e) => startEffectDrag(e, def)}
              onClick={() => onDefSelect(def, 'effect')}
              title={`${def.name} (${def.shape}) — click to place on map`}
            >
              <img
                className="asset-thumb"
                src={def.src}
                alt={def.name}
                draggable={false}
                style={{ opacity: def.defaultOpacity }}
              />
              <span className="asset-name">{def.name}</span>
              <button
                className="asset-remove"
                onClick={(e) => { e.stopPropagation(); removeEffectDef(def.id) }}
                title="Remove from library"
              >
                ×
              </button>
            </div>
          ))}
        </div>
        <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleAddEffect}>
          Add Effect…
        </button>
      </div>
    </>
  )
}
