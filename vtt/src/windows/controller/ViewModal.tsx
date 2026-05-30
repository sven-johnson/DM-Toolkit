import type { LayerName } from '../../shared/types/ipc'

const LAYER_LABELS: Record<LayerName, string> = {
  background: 'Background',
  effects: 'Effects',
  tokens: 'Tokens',
  grid: 'Grid',
}
const LAYER_NAMES: LayerName[] = ['background', 'effects', 'tokens', 'grid']

interface Props {
  layers: Record<LayerName, boolean>
  showAffectedArea: boolean
  onLayerToggle: (layer: LayerName, visible: boolean) => void
  onAffectedAreaToggle: (enabled: boolean) => void
  onClose: () => void
}

export function ViewModal({ layers, showAffectedArea, onLayerToggle, onAffectedAreaToggle, onClose }: Props) {
  return (
    <div className="stage-modal" onClick={onClose}>
      <div className="stage-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stage-modal-header">
          <span className="stage-modal-title">View</span>
          <button className="stage-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="stage-modal-body">
          <div className="aoe-presets-header" style={{ marginBottom: '0.6rem' }}>Layers</div>
          {LAYER_NAMES.map((layer) => (
            <div key={layer} className="layer-row">
              <span className="layer-label">{LAYER_LABELS[layer]}</span>
              <label className="toggle">
                <input
                  type="checkbox"
                  checked={layers[layer]}
                  onChange={(e) => onLayerToggle(layer, e.target.checked)}
                />
                <span className="toggle-track" />
              </label>
            </div>
          ))}
          <div className="layer-row" style={{ marginTop: '0.5rem', paddingTop: '0.5rem', borderTop: '1px solid var(--border)' }}>
            <span className="layer-label">Show Affected Area</span>
            <label className="toggle">
              <input
                type="checkbox"
                checked={showAffectedArea}
                onChange={(e) => onAffectedAreaToggle(e.target.checked)}
              />
              <span className="toggle-track" />
            </label>
          </div>
        </div>
      </div>
    </div>
  )
}
