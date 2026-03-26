import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useCreateScene,
  useDeleteScene,
  useReorderScenes,
  useSession,
  useUpdateScene,
} from '../hooks/useSession'
import { useCharacters } from '../hooks/useCharacters'
import { useCreateCheck } from '../hooks/useChecks'
import { useSessionRolls } from '../hooks/useRolls'
import { SceneList } from '../components/SceneList'
import { CharacterCard } from '../components/CharacterCard'

interface SlashItem {
  type: 'skill' | 'save'
  subtype: string
  label: string
}

interface PendingCheck {
  sceneId: number
  type: 'skill' | 'save'
  subtype: string
  label: string
}

export function SessionDetailPage() {
  const { id } = useParams<{ id: string }>()
  const sessionId = Number(id)

  const { data: session, isLoading, isError } = useSession(sessionId)
  const { data: characters = [] } = useCharacters()
  const { data: sessionRolls = [] } = useSessionRolls(sessionId)

  const createScene = useCreateScene(sessionId)
  const updateScene = useUpdateScene(sessionId)
  const deleteScene = useDeleteScene(sessionId)
  const reorderScenes = useReorderScenes(sessionId)
  const createCheck = useCreateCheck(sessionId)

  const [addingScene, setAddingScene] = useState(false)
  const [newSceneTitle, setNewSceneTitle] = useState('')
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const [pendingDc, setPendingDc] = useState(10)
  const [pendingCharIds, setPendingCharIds] = useState<number[]>([])
  const [pendingAllChars, setPendingAllChars] = useState(true)

  function handleAddScene(e: React.FormEvent) {
    e.preventDefault()
    if (!newSceneTitle.trim()) return
    createScene.mutate(
      { title: newSceneTitle.trim() },
      {
        onSuccess: () => {
          setNewSceneTitle('')
          setAddingScene(false)
        },
      },
    )
  }

  function handleSelectSlashItem(sceneId: number, item: SlashItem) {
    setPendingCheck({ sceneId, type: item.type, subtype: item.subtype, label: item.label })
    setPendingDc(10)
    setPendingCharIds([])
    setPendingAllChars(true)
  }

  function handleConfirmCheck() {
    if (!pendingCheck) return
    createCheck.mutate(
      {
        scene_id: pendingCheck.sceneId,
        check_type: pendingCheck.type,
        subtype: pendingCheck.subtype,
        dc: pendingDc,
        character_ids: pendingAllChars ? [] : pendingCharIds,
      },
      {
        onSuccess: () => {
          setPendingCheck(null)
        },
      },
    )
  }

  function handleCancelCheck() {
    setPendingCheck(null)
  }

  function togglePendingChar(charId: number) {
    setPendingCharIds((prev) => {
      const idx = prev.indexOf(charId)
      if (idx >= 0) return prev.filter((id) => id !== charId)
      return [...prev, charId]
    })
  }

  if (isLoading) return <div className="status-text">Loading…</div>
  if (isError || !session) return <div className="status-text error">Session not found.</div>

  return (
    <div className="page">
      <div className="page-header">
        <Link to="/" className="back-link">
          ← Sessions
        </Link>
        <div className="session-meta">
          <h1>{session.title}</h1>
          {session.date && <span className="session-date">{session.date}</span>}
        </div>
        <button className="btn-primary" onClick={() => setAddingScene((a) => !a)}>
          + Add Scene
        </button>
      </div>

      {addingScene && (
        <form className="create-form" onSubmit={handleAddScene}>
          <input
            className="input"
            placeholder="Scene title"
            value={newSceneTitle}
            onChange={(e) => setNewSceneTitle(e.target.value)}
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={createScene.isPending}>
            Add
          </button>
          <button className="btn-ghost" type="button" onClick={() => setAddingScene(false)}>
            Cancel
          </button>
        </form>
      )}

      <div className="session-layout">
        <div className="session-main">
          {session.scenes.length === 0 && !addingScene && (
            <p className="empty-state">No scenes yet. Add one to start building this session.</p>
          )}

          <SceneList
            scenes={session.scenes}
            characters={characters}
            sessionId={sessionId}
            onReorder={(ids) => reorderScenes.mutate(ids)}
            onUpdate={(id, patch) => updateScene.mutate({ id, ...patch })}
            onDelete={(id) => deleteScene.mutate(id)}
            onSelectSlashItem={handleSelectSlashItem}
          />
        </div>

        <div className="session-sidebar">
          <div className="sidebar-title">Party</div>
          {characters.length === 0 ? (
            <p className="empty-state" style={{ fontSize: '0.85rem' }}>
              No characters —{' '}
              <Link to="/characters">go to Characters page</Link> to add your party.
            </p>
          ) : (
            <div className="sidebar-character-list">
              {characters.map((character) => (
                <CharacterCard
                  key={character.id}
                  character={character}
                  rolls={sessionRolls}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {pendingCheck && (
        <div className="pending-check-modal-overlay" onClick={handleCancelCheck}>
          <div
            className="pending-check-modal"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
          >
            <h3>Add {pendingCheck.label} {pendingCheck.type === 'skill' ? 'Check' : 'Save'}</h3>

            <div className="pending-check-field">
              <label htmlFor="pending-dc">DC</label>
              <input
                id="pending-dc"
                className="input"
                type="number"
                value={pendingDc}
                onChange={(e) => setPendingDc(parseInt(e.target.value, 10) || 10)}
                style={{ width: 80 }}
                autoFocus
              />
            </div>

            <div className="pending-check-chars">
              <label>Characters</label>
              <div className="pending-check-char-options">
                <label className="pending-check-char-option">
                  <input
                    type="checkbox"
                    checked={pendingAllChars}
                    onChange={(e) => setPendingAllChars(e.target.checked)}
                  />
                  All characters
                </label>
                {!pendingAllChars &&
                  characters.map((c) => (
                    <label key={c.id} className="pending-check-char-option">
                      <input
                        type="checkbox"
                        checked={pendingCharIds.includes(c.id)}
                        onChange={() => togglePendingChar(c.id)}
                      />
                      {c.name || 'Unnamed'}
                    </label>
                  ))}
              </div>
            </div>

            <div className="pending-check-actions">
              <button
                className="btn-primary"
                onClick={handleConfirmCheck}
                disabled={createCheck.isPending}
                type="button"
              >
                Add Check
              </button>
              <button className="btn-ghost" onClick={handleCancelCheck} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
