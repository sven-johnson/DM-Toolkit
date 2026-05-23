import { open as openDialog } from '@tauri-apps/plugin-dialog'
import { toAssetUrl } from '../../lib/assetUrl'
import { useVttStore } from '../../store/vttStore'
import type { ShowcaseDef } from '../../shared/types/showcase'

const IMAGE_FILTERS = [{ name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'webp', 'gif'] }]

function basename(path: string): string {
  return path.split(/[\\/]/).pop()?.replace(/\.[^.]+$/, '') ?? path
}

interface Props {
  onSet: (src: string, rotation: number, darkenAmount: number) => void
  onClear: () => void
}

export function ShowcasePanel({ onSet, onClear }: Props) {
  const showcaseDefs   = useVttStore((s) => s.showcaseDefs)
  const activeShowcase = useVttStore((s) => s.activeShowcase)
  const { addShowcaseDef, removeShowcaseDef, setActiveShowcase } = useVttStore.getState()

  const activeDef: ShowcaseDef | undefined = activeShowcase
    ? showcaseDefs.find((d) => d.id === activeShowcase.defId)
    : undefined

  async function handleAdd() {
    const path = await openDialog({ multiple: false, filters: IMAGE_FILTERS })
    if (!path || typeof path !== 'string') return
    const def: ShowcaseDef = {
      id: crypto.randomUUID(),
      name: basename(path),
      src: toAssetUrl(path),
    }
    addShowcaseDef(def)
  }

  function handleSelect(def: ShowcaseDef) {
    if (activeShowcase?.defId === def.id) {
      // Toggle off
      setActiveShowcase(null)
      onClear()
    } else {
      const darken = activeShowcase?.darkenAmount ?? 20
      const rotation = 0
      setActiveShowcase({ defId: def.id, rotation, darkenAmount: darken })
      onSet(def.src, rotation, darken)
    }
  }

  function handleRemove(id: string) {
    if (activeShowcase?.defId === id) {
      setActiveShowcase(null)
      onClear()
    }
    removeShowcaseDef(id)
  }

  function handleRotate(dir: -1 | 1) {
    if (!activeShowcase || !activeDef) return
    const next = ((activeShowcase.rotation + dir * 90) + 360) % 360
    const updated = { ...activeShowcase, rotation: next }
    setActiveShowcase(updated)
    onSet(activeDef.src, next, updated.darkenAmount)
  }

  function handleDarken(val: number) {
    if (!activeShowcase || !activeDef) return
    const updated = { ...activeShowcase, darkenAmount: val }
    setActiveShowcase(updated)
    onSet(activeDef.src, updated.rotation, val)
  }

  return (
    <div>
      <div className="asset-grid">
        {showcaseDefs.map((def) => (
          <div
            key={def.id}
            className={`asset-card ${activeShowcase?.defId === def.id ? 'asset-card--active' : ''}`}
            onClick={() => handleSelect(def)}
            title={`${def.name} — click to display`}
          >
            <img className="asset-thumb" src={def.src} alt={def.name} draggable={false} />
            <span className="asset-name">{def.name}</span>
            <button
              className="asset-remove"
              onClick={(e) => { e.stopPropagation(); handleRemove(def.id) }}
              title="Remove from library"
            >
              ×
            </button>
          </div>
        ))}
      </div>

      <button className="btn btn-secondary" style={{ marginTop: '0.5rem' }} onClick={handleAdd}>
        Add Art…
      </button>

      {activeShowcase && activeDef && (
        <div className="showcase-controls">
          <div className="showcase-active-name">{activeDef.name}</div>

          <div className="showcase-rotate-row">
            <span className="aoe-field-label">Rotate</span>
            <button className="btn btn-secondary showcase-rot-btn" onClick={() => handleRotate(-1)} title="Rotate 90° counter-clockwise">
              ↺ 90°
            </button>
            <button className="btn btn-secondary showcase-rot-btn" onClick={() => handleRotate(1)} title="Rotate 90° clockwise">
              ↻ 90°
            </button>
          </div>

          <div className="slider-row">
            <span className="slider-label">Darken</span>
            <input
              type="range"
              min={0} max={100} step={5}
              value={activeShowcase.darkenAmount}
              onChange={(e) => handleDarken(Number(e.target.value))}
            />
            <span className="slider-value">{activeShowcase.darkenAmount}%</span>
          </div>

          <button
            className="btn btn-danger"
            style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}
            onClick={() => { setActiveShowcase(null); onClear() }}
          >
            Clear Display
          </button>
        </div>
      )}
    </div>
  )
}
