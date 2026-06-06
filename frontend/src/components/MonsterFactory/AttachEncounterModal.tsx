/**
 * Modal for attaching a saved encounter to a scene.
 * Lets the DM pick a saved encounter, then auto-populates scene enemies
 * with the correct saved_encounter_monster_id links.
 */
import { useState } from 'react'
import { useSavedEncounters, useSavedEncounter } from '../../hooks/useMonsterFactory'
import { useAddEnemy } from '../../hooks/useStorylines'
import './SceneMonsterFactoryModal.css'

interface Props {
  sceneId: string
  queryKey: unknown[]
  onClose: () => void
}

export function AttachEncounterModal({ sceneId, queryKey, onClose }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [adding, setAdding]         = useState(false)

  const { data: pagedData, isLoading } = useSavedEncounters(1, 50)
  const { data: selectedEncounter }   = useSavedEncounter(selectedId)
  const addEnemy = useAddEnemy(queryKey)

  async function handleConfirm() {
    if (!selectedEncounter) return
    setAdding(true)
    try {
      for (const sem of selectedEncounter.encounter_monsters) {
        await addEnemy.mutateAsync({
          sceneId,
          name: sem.monster_stat_block.name,
          quantity: sem.count,
          saved_encounter_monster_id: sem.id,
        })
      }
      onClose()
    } finally {
      setAdding(false)
    }
  }

  return (
    <div className="aem-overlay" onClick={onClose}>
      <div className="aem-modal" onClick={(e) => e.stopPropagation()}>
        <div className="aem-header">
          <h2 className="aem-title">Attach Saved Encounter</h2>
          <button type="button" className="aem-close" onClick={onClose} aria-label="Close">✕</button>
        </div>

        {isLoading && <p className="aem-empty">Loading…</p>}
        {!isLoading && (!pagedData || pagedData.items.length === 0) && (
          <p className="aem-empty">No saved encounters yet.</p>
        )}

        {!isLoading && pagedData && pagedData.items.length > 0 && !selectedId && (
          <div className="aem-list">
            {pagedData.items.map((enc) => (
              <div
                key={enc.id}
                className="aem-row"
                onClick={() => setSelectedId(enc.id)}
              >
                <span className="aem-enc-name">{enc.name}</span>
                <span className="aem-enc-meta">
                  {enc.difficulty} · {enc.total_monster_count} monsters
                </span>
              </div>
            ))}
          </div>
        )}

        {selectedId && (
          <div className="aem-confirm">
            {!selectedEncounter ? (
              <p className="aem-confirm-text">Loading encounter…</p>
            ) : (
              <>
                <p className="aem-confirm-text">
                  Add <strong>{selectedEncounter.encounter_monsters.length}</strong> enemy
                  {selectedEncounter.encounter_monsters.length !== 1 ? ' rows' : ' row'} from{' '}
                  <strong>{selectedEncounter.name}</strong> to this scene?
                </p>
                <div className="aem-confirm-btns">
                  <button
                    type="button"
                    className="btn-ghost"
                    onClick={() => setSelectedId(null)}
                    disabled={adding}
                  >
                    ← Back
                  </button>
                  <button
                    type="button"
                    className="btn-primary"
                    onClick={() => void handleConfirm()}
                    disabled={adding}
                  >
                    {adding ? 'Adding…' : 'Add Enemies'}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
