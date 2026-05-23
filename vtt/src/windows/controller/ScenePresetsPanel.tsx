import { useEffect, useRef, useState } from 'react'
import {
  type ScenePreset,
  type ScenePresetData,
  deleteScenePreset,
  loadScenePresets,
  saveScenePreset,
} from '../../lib/vttDatabase'
import { useVttStore } from '../../store/vttStore'

interface Props {
  onLoad: (data: ScenePresetData) => void
}

function formatDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

export function ScenePresetsPanel({ onLoad }: Props) {
  const [presets, setPresets] = useState<ScenePreset[]>([])
  const [newName, setNewName] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadScenePresets().then(setPresets).catch(() => {/* best-effort */})
  }, [])

  async function refresh() {
    setPresets(await loadScenePresets())
  }

  async function handleSave() {
    const name = newName.trim()
    if (!name) return
    setSaving(true)
    setError(null)
    try {
      const s = useVttStore.getState()
      await saveScenePreset(crypto.randomUUID(), name, {
        backgroundSrc: s.backgroundSrc,
        tokenDefs: s.tokenDefs,
        tokens: s.tokens,
        effectDefs: s.effectDefs,
        effects: s.effects,
        aoeMarkers: s.aoeMarkers,
        grid: s.grid,
        layers: s.layers,
        showAffectedArea: s.showAffectedArea,
      })
      setNewName('')
      await refresh()
    } catch {
      setError('Failed to save preset.')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    try {
      await deleteScenePreset(id)
      await refresh()
    } catch {
      setError('Failed to delete preset.')
    }
  }

  return (
    <div>
      <div style={{ display: 'flex', gap: '0.4rem', marginBottom: '0.5rem' }}>
        <input
          ref={inputRef}
          className="cal-input"
          style={{ flex: 1, width: 'auto' }}
          placeholder="Scene name…"
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void handleSave() }}
        />
        <button
          className="btn btn-primary"
          style={{ fontSize: '0.8rem', padding: '0.3rem 0.8rem', whiteSpace: 'nowrap' }}
          onClick={() => void handleSave()}
          disabled={!newName.trim() || saving}
        >
          {saving ? 'Saving…' : 'Save Scene'}
        </button>
      </div>

      {error && (
        <p style={{ fontSize: '0.78rem', color: 'var(--danger)', margin: '0 0 0.4rem' }}>{error}</p>
      )}

      {presets.length === 0 ? (
        <p className="cal-hint" style={{ margin: 0 }}>No saved scenes yet.</p>
      ) : (
        <div className="preset-list">
          {presets.map((p) => (
            <div key={p.id} className="preset-row">
              <div className="preset-info">
                <span className="preset-name">{p.name}</span>
                <span className="preset-date">{formatDate(p.updatedAt)}</span>
              </div>
              <div className="preset-actions">
                <button
                  className="btn btn-secondary"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.55rem' }}
                  onClick={() => onLoad(p.data)}
                >
                  Load
                </button>
                <button
                  className="btn btn-danger"
                  style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem' }}
                  onClick={() => void handleDelete(p.id)}
                  title="Delete preset"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
