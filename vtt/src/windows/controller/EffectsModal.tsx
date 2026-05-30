import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { toAssetUrl } from '../../lib/assetUrl'
import { useVttStore } from '../../store/vttStore'
import type { EffectDef, TokenSize } from '../../shared/types/tokens'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]
const DEFAULT_SIZE: TokenSize = 1

function basename(path: string) {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path
}

interface Props {
  onSelectEffect: (def: EffectDef) => void
  onClose: () => void
}

export function EffectsModal({ onSelectEffect, onClose }: Props) {
  const effectDefs = useVttStore((s) => s.effectDefs)
  const { removeEffectDef, addEffectDef } = useVttStore.getState()

  async function handleAddEffect() {
    const path = await openDialog({ multiple: false, filters: IMAGE_FILTERS })
    if (!path || typeof path !== 'string') return
    addEffectDef({
      id: crypto.randomUUID(),
      name: basename(path),
      src: toAssetUrl(path),
      shape: 'square',
      defaultSize: DEFAULT_SIZE,
      defaultOpacity: 0.7,
    })
  }

  return (
    <div className="stage-modal" onClick={onClose}>
      <div className="stage-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stage-modal-header">
          <span className="stage-modal-title">Effects</span>
          <button className="stage-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="stage-modal-body">
          {effectDefs.length === 0 && <p className="cal-hint">No effects yet. Add one below.</p>}
          <div className="asset-grid">
            {effectDefs.map((def) => (
              <div
                key={def.id}
                className="asset-card"
                onClick={() => onSelectEffect(def)}
                title={`${def.name} — click to place`}
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
                >×</button>
              </div>
            ))}
          </div>
        </div>
        <div className="stage-modal-footer" style={{ justifyContent: 'flex-start' }}>
          <button className="btn btn-secondary" onClick={handleAddEffect}>Add Effect…</button>
        </div>
      </div>
    </div>
  )
}
