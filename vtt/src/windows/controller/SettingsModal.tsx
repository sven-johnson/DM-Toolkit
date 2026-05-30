import { CalibrationPanel } from './CalibrationPanel'
import { useVttStore } from '../../store/vttStore'

const OUTLINE_MAX_DIVISOR = 4  // max outline = cellSize / 4

interface Props {
  playerReady: boolean
  onLog: (msg: string) => void
  onClose: () => void
}

export function SettingsModal({ playerReady, onLog, onClose }: Props) {
  const rotationCooldownMs = useVttStore((s) => s.rotationCooldownMs)
  const setRotationCooldownMs = useVttStore((s) => s.setRotationCooldownMs)
  const tokenOutlineThicknessPx = useVttStore((s) => s.tokenOutlineThicknessPx)
  const setTokenOutlineThicknessPx = useVttStore((s) => s.setTokenOutlineThicknessPx)
  const cellSize = useVttStore((s) => s.grid.cellSize)
  const maxOutline = Math.max(1, Math.round(cellSize / OUTLINE_MAX_DIVISOR))

  return (
    <div className="stage-modal" onClick={onClose}>
      <div className="stage-modal-panel" onClick={(e) => e.stopPropagation()}>
        <div className="stage-modal-header">
          <span className="stage-modal-title">Settings</span>
          <button className="stage-modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="stage-modal-body">
          <CalibrationPanel playerReady={playerReady} onLog={onLog} />

          <div className="subsection">
            <h3>Interaction</h3>
            <div className="slider-row">
              <span className="slider-label">Rotation cooldown time</span>
              <input
                type="range" min={0} max={1000} step={50}
                value={rotationCooldownMs}
                onChange={(e) => setRotationCooldownMs(Number(e.target.value))}
              />
              <span className="slider-value">{rotationCooldownMs} ms</span>
            </div>
          </div>

          <div className="subsection">
            <h3>Tokens</h3>
            <div className="slider-row">
              <span className="slider-label">Token outline thickness</span>
              <input
                type="range" min={0} max={maxOutline} step={0.5}
                value={tokenOutlineThicknessPx}
                onChange={(e) => setTokenOutlineThicknessPx(Number(e.target.value))}
              />
              <span className="slider-value">{tokenOutlineThicknessPx} px</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
