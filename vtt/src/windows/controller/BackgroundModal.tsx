import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { toAssetUrl } from '../../lib/assetUrl'
import { useVttStore } from '../../store/vttStore'
import type { BackgroundDef } from '../../shared/types/background'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]

function basename(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path
}

interface Props {
  onSelect: (src: string) => void
  onClose: () => void
}

export function BackgroundModal({ onSelect, onClose }: Props) {
  const backgroundDefs = useVttStore((s) => s.backgroundDefs)
  const backgroundSrc = useVttStore((s) => s.backgroundSrc)
  const { addBackgroundDef, removeBackgroundDef } = useVttStore.getState()

  async function handleLoadNew() {
    const path = await openDialog({ multiple: false, filters: IMAGE_FILTERS })
    if (!path || typeof path !== 'string') return
    const src = toAssetUrl(path)
    const def: BackgroundDef = { id: crypto.randomUUID(), name: basename(path), src }
    addBackgroundDef(def)
    onSelect(src)
  }

  return (
    <div className="stage-modal" onClick={onClose}>
      <div className="stage-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stage-modal-header">
          <span className="stage-modal-title">Background</span>
          <button className="stage-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="stage-modal-body">
          {backgroundDefs.length === 0 && <p className="cal-hint">No backgrounds yet. Load one below.</p>}
          <div className="asset-grid">
            {backgroundDefs.map((def) => (
              <div
                key={def.id}
                className={`asset-card${backgroundSrc === def.src ? ' asset-card--active' : ''}`}
                onClick={() => onSelect(def.src)}
                title={`${def.name} — click to set`}
              >
                <img className="asset-thumb" src={def.src} alt={def.name} draggable={false} style={{ objectFit: 'cover' }} />
                <span className="asset-name">{def.name}</span>
                <button
                  className="asset-remove"
                  onClick={(e) => { e.stopPropagation(); removeBackgroundDef(def.id) }}
                  title="Remove from library"
                >×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="stage-modal-footer" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-secondary" onClick={handleLoadNew}>Load Image…</button>
        </div>
      </div>
    </div>
  )
}
