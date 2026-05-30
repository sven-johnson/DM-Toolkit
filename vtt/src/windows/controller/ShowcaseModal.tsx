import { ShowcasePanel } from './ShowcasePanel'

interface Props {
  onSet: (src: string, rotation: number, darkenAmount: number) => void
  onClear: () => void
  onClose: () => void
}

export function ShowcaseModal({ onSet, onClear, onClose }: Props) {
  return (
    <div className="stage-modal" onClick={onClose}>
      <div className="stage-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stage-modal-header">
          <span className="stage-modal-title">Showcase</span>
          <button className="stage-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="stage-modal-body">
          <ShowcasePanel onSet={onSet} onClear={onClear} />
        </div>
      </div>
    </div>
  )
}
