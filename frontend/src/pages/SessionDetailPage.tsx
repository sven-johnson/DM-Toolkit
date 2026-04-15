import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  useSession,
  useUpdateSession,
  useAddNextScene,
  useRemoveSceneFromSession,
  useReorderSessionScenes,
} from '../hooks/useSession'
import { useCharacters } from '../hooks/useCharacters'
import { useCreateCheck, useUpdateCheck } from '../hooks/useChecks'
import { useSessionRolls } from '../hooks/useRolls'
import { useCampaignStorylines } from '../hooks/useCampaigns'
import { useUpdateScene } from '../hooks/useStorylines'
import { SceneList } from '../components/SceneList'
import { CharacterCard } from '../components/CharacterCard'
import { WikiArticleModal } from '../components/WikiArticleModal'
import { useWikiArticles } from '../hooks/useWiki'
import { calcSuccessPercent, formatModifier, getCheckModifier, SAVES, SKILLS } from '../constants/dnd'
import type { Check } from '../types'

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
  const { campaignId: campaignIdStr, sessionId: sessionIdStr } = useParams<{
    campaignId: string
    sessionId: string
  }>()
  const campaignId = Number(campaignIdStr)
  const sessionId = Number(sessionIdStr)
  const queryKey = ['session', sessionId]

  const { data: session, isLoading, isError } = useSession(campaignId, sessionId)
  const { data: characters = [] } = useCharacters(campaignId)
  const { data: wikiArticles = [] } = useWikiArticles(campaignId)
  const { data: sessionRolls = [] } = useSessionRolls(campaignId, sessionId)
  const { data: storylines = [] } = useCampaignStorylines(campaignId)

  const updateSession = useUpdateSession(campaignId, sessionId)
  const addNextScene = useAddNextScene(campaignId, sessionId)
  const removeScene = useRemoveSceneFromSession(campaignId, sessionId)
  const reorderScenes = useReorderSessionScenes(campaignId, sessionId)
  const updateScene = useUpdateScene(queryKey)
  const createCheck = useCreateCheck(queryKey)
  const updateCheck = useUpdateCheck(queryKey)

  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const [pendingDc, setPendingDc] = useState(10)
  const [pendingCharIds, setPendingCharIds] = useState<number[]>([])
  const [pendingAllChars, setPendingAllChars] = useState(true)
  const [pendingEditId, setPendingEditId] = useState<number | null>(null)
  const pendingInsertLineRef = useRef<(() => void) | null>(null)

  const [wikiModalId, setWikiModalId] = useState<number | null>(null)
  const [showStorylineSelector, setShowStorylineSelector] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [editingRecap, setEditingRecap] = useState(false)
  const [recapDraft, setRecapDraft] = useState('')

  function handleSelectSlashItem(sceneId: number, item: SlashItem, insertLine: () => void) {
    setPendingCheck({ sceneId, type: item.type, subtype: item.subtype, label: item.label })
    setPendingDc(10)
    setPendingCharIds([])
    setPendingAllChars(true)
    setPendingEditId(null)
    pendingInsertLineRef.current = insertLine
  }

  function handleEditCheck(check: Check) {
    pendingInsertLineRef.current = null
    const isSkill = check.check_type === 'skill'
    const label = isSkill
      ? (SKILLS.find((s) => s.key === check.subtype)?.name ?? check.subtype)
      : (SAVES.find((s) => s.key === check.subtype)?.name ?? check.subtype)
    setPendingCheck({ sceneId: check.scene_id, type: check.check_type, subtype: check.subtype, label })
    setPendingDc(check.dc)
    if (check.character_ids.length === 0) {
      setPendingAllChars(true)
      setPendingCharIds([])
    } else {
      setPendingAllChars(false)
      setPendingCharIds(check.character_ids)
    }
    setPendingEditId(check.id)
  }

  function handleConfirmCheck() {
    if (!pendingCheck) return
    const charIds = pendingAllChars ? [] : pendingCharIds
    if (pendingEditId !== null) {
      updateCheck.mutate(
        { id: pendingEditId, dc: pendingDc, character_ids: charIds },
        {
          onSuccess: () => {
            setPendingCheck(null)
            setPendingEditId(null)
            pendingInsertLineRef.current = null
          },
        },
      )
    } else {
      createCheck.mutate(
        {
          scene_id: pendingCheck.sceneId,
          check_type: pendingCheck.type,
          subtype: pendingCheck.subtype,
          dc: pendingDc,
          character_ids: charIds,
        },
        {
          onSuccess: () => {
            pendingInsertLineRef.current?.()
            pendingInsertLineRef.current = null
            setPendingCheck(null)
          },
        },
      )
    }
  }

  function handleCancelCheck() {
    setPendingCheck(null)
    setPendingEditId(null)
    pendingInsertLineRef.current = null
  }

  function togglePendingChar(charId: number) {
    setPendingCharIds((prev) => {
      const idx = prev.indexOf(charId)
      if (idx >= 0) return prev.filter((id) => id !== charId)
      return [...prev, charId]
    })
  }

  function commitTitle() {
    setEditingTitle(false)
    if (session && titleDraft.trim() && titleDraft.trim() !== session.title) {
      updateSession.mutate({ title: titleDraft.trim() })
    }
  }

  function commitRecap() {
    setEditingRecap(false)
    if (session && recapDraft !== (session.recap_notes ?? '')) {
      updateSession.mutate({ recap_notes: recapDraft })
    }
  }

  const activeStoryline = storylines.find((sl) => sl.id === session?.active_storyline_id)

  if (isLoading) return <div className="status-text">Loading…</div>
  if (isError || !session) return <div className="status-text error">Session not found.</div>

  return (
    <div className="page">
      <div className="page-header">
        <Link to={`/campaigns/${campaignId}/sessions`} className="back-link">
          ← Sessions
        </Link>
        <div className="session-meta">
          {editingTitle ? (
            <input
              className="input"
              value={titleDraft}
              onChange={(e) => setTitleDraft(e.target.value)}
              onBlur={commitTitle}
              onKeyDown={(e) => {
                if (e.key === 'Enter') commitTitle()
                if (e.key === 'Escape') setEditingTitle(false)
              }}
              autoFocus
            />
          ) : (
            <h1
              onClick={() => { setTitleDraft(session.title); setEditingTitle(true) }}
              title="Click to edit title"
              style={{ cursor: 'pointer' }}
            >
              {session.title}
            </h1>
          )}
          {session.date && <span className="session-date">{session.date}</span>}
        </div>
      </div>

      {/* Active storyline bar */}
      <div className="session-storyline-bar">
        <span className="session-storyline-label">
          {activeStoryline ? (
            <>
              <span className="storyline-indicator">📖</span>
              <Link to={`/campaigns/${campaignId}/storylines/${activeStoryline.id}`}>
                {activeStoryline.title}
              </Link>
            </>
          ) : (
            <span className="text-muted">No active storyline</span>
          )}
        </span>
        <button
          className="btn-ghost btn-sm"
          onClick={() => setShowStorylineSelector((s) => !s)}
          type="button"
        >
          Change Storyline
        </button>
      </div>

      {showStorylineSelector && (
        <div className="storyline-selector-row">
          <select
            className="input"
            defaultValue={session.active_storyline_id ?? ''}
            onChange={(e) => {
              const val = e.target.value === '' ? null : Number(e.target.value)
              updateSession.mutate({ active_storyline_id: val })
              setShowStorylineSelector(false)
            }}
          >
            <option value="">No storyline</option>
            {storylines.map((sl) => (
              <option key={sl.id} value={sl.id}>
                {sl.title}
              </option>
            ))}
          </select>
          <button
            className="btn-ghost btn-sm"
            onClick={() => setShowStorylineSelector(false)}
            type="button"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Recap notes */}
      <div className="session-recap">
        <div
          className="session-recap-label"
          onClick={() => {
            setRecapDraft(session.recap_notes ?? '')
            setEditingRecap(true)
          }}
        >
          Recap Notes
        </div>
        {editingRecap ? (
          <textarea
            className="session-recap-input"
            value={recapDraft}
            onChange={(e) => setRecapDraft(e.target.value)}
            onBlur={commitRecap}
            rows={3}
            autoFocus
            placeholder="Session recap…"
          />
        ) : (
          <div
            className="session-recap-text"
            onClick={() => { setRecapDraft(session.recap_notes ?? ''); setEditingRecap(true) }}
          >
            {session.recap_notes || <span className="text-muted">Click to add recap notes…</span>}
          </div>
        )}
      </div>

      <div className="session-layout">
        <div className="session-main">
          {session.scenes.length === 0 && (
            <p className="empty-state">No scenes yet. Add one from the active storyline below.</p>
          )}

          <SceneList
            scenes={session.scenes}
            characters={characters}
            queryKey={queryKey}
            onReorder={(ids) => reorderScenes.mutate(ids)}
            onUpdate={(id, patch) => updateScene.mutate({ id, ...patch })}
            onDelete={(id) => removeScene.mutate(id)}
            onSelectSlashItem={handleSelectSlashItem}
            onEditCheck={handleEditCheck}
            deleteLabel="Remove from session"
            wikiArticles={wikiArticles}
            onWikiLinkClick={(id) => setWikiModalId(id)}
            campaignId={campaignId}
          />

          {/* Add Next Scene button */}
          <div className="add-next-scene-row">
            <button
              className="btn-primary"
              type="button"
              disabled={addNextScene.isPending || !session.active_storyline_id}
              onClick={() => addNextScene.mutate()}
              title={!session.active_storyline_id ? 'Set an active storyline first' : undefined}
            >
              + Add Next Scene
            </button>
            {addNextScene.isError && (
              <span className="status-text error" style={{ marginLeft: '0.5rem' }}>
                No more scenes available in this storyline.
              </span>
            )}
          </div>
        </div>

        <div className="session-sidebar">
          <div className="sidebar-title">Party</div>
          {characters.length === 0 ? (
            <p className="empty-state" style={{ fontSize: '0.85rem' }}>
              No characters —{' '}
              <Link to={`/campaigns/${campaignId}/characters`}>go to Characters page</Link> to add
              your party.
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
            <h3>
              {pendingEditId !== null ? 'Edit' : 'Add'} {pendingCheck.label}{' '}
              {pendingCheck.type === 'skill' ? 'Check' : 'Save'}
            </h3>

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
                {characters.map((c) => {
                  const modifier = getCheckModifier(c, pendingCheck.type, pendingCheck.subtype)
                  const pct = calcSuccessPercent(modifier, pendingDc)
                  return (
                    <label
                      key={c.id}
                      className={`pending-check-char-option${pendingAllChars ? ' pending-check-char-option-readonly' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={pendingAllChars || pendingCharIds.includes(c.id)}
                        onChange={() => { if (!pendingAllChars) togglePendingChar(c.id) }}
                        readOnly={pendingAllChars}
                      />
                      <span className="pending-check-char-name">{c.name || 'Unnamed'}</span>
                      <span className="pending-check-char-stats">
                        {formatModifier(modifier)} · {pct}%
                      </span>
                    </label>
                  )
                })}
              </div>
            </div>

            <div className="pending-check-actions">
              <button
                className="btn-primary"
                onClick={handleConfirmCheck}
                disabled={createCheck.isPending || updateCheck.isPending}
                type="button"
              >
                {pendingEditId !== null ? 'Update Check' : 'Add Check'}
              </button>
              <button className="btn-ghost" onClick={handleCancelCheck} type="button">
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <WikiArticleModal
        articleId={wikiModalId}
        campaignId={campaignId}
        onClose={() => setWikiModalId(null)}
        onNavigate={(id) => setWikiModalId(id)}
      />
    </div>
  )
}
