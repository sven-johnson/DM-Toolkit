import { useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  exportStoryline,
  useImportStorylines,
  useStoryline,
  useUpdateStoryline,
  useCreateStorylineScene,
  useReorderStorylineScenes,
  useDeleteScene,
  useUpdateScene,
} from '../hooks/useStorylines'
import { useCharacters } from '../hooks/useCharacters'
import { useCreateCheck } from '../hooks/useChecks'
import { SceneList } from '../components/SceneList'
import { WikiArticleModal } from '../components/WikiArticleModal'
import { useWikiArticles } from '../hooks/useWiki'
import type { Check, StorylineImportRequest } from '../types'
import { useUpdateCheck } from '../hooks/useChecks'
import { calcSuccessPercent, formatModifier, getCheckModifier, SAVES, SKILLS } from '../constants/dnd'

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

export function StorylineDetailPage() {
  const { campaignId: campaignIdStr, storylineId: storylineIdStr } = useParams<{
    campaignId: string
    storylineId: string
  }>()
  const campaignId = Number(campaignIdStr)
  const storylineId = Number(storylineIdStr)
  const queryKey = ['storyline', storylineId]

  const { data: storyline, isLoading, isError } = useStoryline(campaignId, storylineId)
  const { data: characters = [] } = useCharacters(campaignId)
  const { data: wikiArticles = [] } = useWikiArticles(campaignId)

  const updateStoryline = useUpdateStoryline(campaignId, storylineId)
  const createScene = useCreateStorylineScene(campaignId, storylineId)
  const reorderScenes = useReorderStorylineScenes(campaignId, storylineId)
  const deleteScene = useDeleteScene(queryKey)
  const updateScene = useUpdateScene(queryKey)
  const createCheck = useCreateCheck(queryKey)
  const updateCheck = useUpdateCheck(queryKey)
  const importStorylines = useImportStorylines(campaignId)
  const importFileRef = useRef<HTMLInputElement>(null)

  const [importResult, setImportResult] = useState<{ message: string; isError: boolean } | null>(null)
  const [addingScene, setAddingScene] = useState(false)
  const [newSceneTitle, setNewSceneTitle] = useState('')
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleDraft, setTitleDraft] = useState('')
  const [wikiModalId, setWikiModalId] = useState<number | null>(null)
  const [pendingCheck, setPendingCheck] = useState<PendingCheck | null>(null)
  const [pendingDc, setPendingDc] = useState(10)
  const [pendingCharIds, setPendingCharIds] = useState<number[]>([])
  const [pendingAllChars, setPendingAllChars] = useState(true)
  const [pendingEditId, setPendingEditId] = useState<number | null>(null)
  const pendingInsertLineRef = useRef<(() => void) | null>(null)

  function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string) as StorylineImportRequest
        importStorylines.mutate(
          { ...parsed, campaign_id: campaignId },
          {
            onSuccess: (result) => {
              const parts = [
                `${result.storylines_created} storyline(s) created`,
                `${result.storylines_updated} updated`,
                `${result.scenes_created} scene(s) created`,
                `${result.scenes_updated} updated`,
              ]
              const msg = parts.join(', ') + (result.errors.length ? `. Errors: ${result.errors.join('; ')}` : '.')
              setImportResult({ message: msg, isError: result.errors.length > 0 })
            },
            onError: (err) => {
              setImportResult({ message: err.message ?? 'Import failed.', isError: true })
            },
          },
        )
      } catch {
        setImportResult({ message: 'Invalid JSON file.', isError: true })
      }
    }
    reader.readAsText(file)
    // Reset so the same file can be re-imported if needed
    e.target.value = ''
  }

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

  function handleSelectSlashItem(sceneId: number, item: SlashItem, insertLine: () => void) {
    setPendingCheck({ sceneId, type: item.type, subtype: item.subtype, label: item.label })
    setPendingDc(10)
    setPendingCharIds([])
    setPendingAllChars(true)
    setPendingEditId(null)
    pendingInsertLineRef.current = insertLine
  }

  function handleEditCheck(check: Check) {
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
    pendingInsertLineRef.current = null
  }

  function handleConfirmCheck() {
    if (!pendingCheck) return
    const charIds = pendingAllChars ? [] : pendingCharIds
    if (pendingEditId !== null) {
      updateCheck.mutate(
        { id: pendingEditId, dc: pendingDc, character_ids: charIds },
        { onSuccess: () => { setPendingCheck(null); setPendingEditId(null) } },
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
    if (titleDraft.trim() && storyline && titleDraft.trim() !== storyline.title) {
      updateStoryline.mutate({ title: titleDraft.trim() })
    }
  }

  if (isLoading) return <div className="status-text">Loading…</div>
  if (isError || !storyline) return <div className="status-text error">Storyline not found.</div>

  return (
    <div className="page">
      <div className="page-header">
        <Link to={`/campaigns/${campaignId}/storylines`} className="back-link">
          ← Storylines
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
              onClick={() => { setTitleDraft(storyline.title); setEditingTitle(true) }}
              title="Click to edit title"
              style={{ cursor: 'pointer' }}
            >
              {storyline.title}
            </h1>
          )}
          <span className="session-date" style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Storyline · {storyline.scenes.length} scene{storyline.scenes.length !== 1 ? 's' : ''}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => exportStoryline(campaignId, storylineId, storyline?.title ?? 'storyline')}
          >
            Export JSON
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => importFileRef.current?.click()}
            disabled={importStorylines.isPending}
          >
            {importStorylines.isPending ? 'Importing…' : 'Import JSON'}
          </button>
          <input
            ref={importFileRef}
            type="file"
            accept="application/json,.json"
            style={{ display: 'none' }}
            onChange={handleImportFile}
          />
          <button className="btn-primary" onClick={() => setAddingScene((a) => !a)}>
            + Add Scene
          </button>
        </div>
      </div>

      {importResult && (
        <div
          className={importResult.isError ? 'form-error' : 'form-success'}
          style={{ marginBottom: '1rem' }}
        >
          {importResult.message}
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setImportResult(null)}
            style={{ marginLeft: '0.75rem', padding: '0 0.4rem', fontSize: '0.8rem' }}
          >
            ✕
          </button>
        </div>
      )}

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
          {storyline.scenes.length === 0 && !addingScene && (
            <p className="empty-state">No scenes yet. Add one to start building this storyline.</p>
          )}

          <SceneList
            scenes={storyline.scenes}
            characters={characters}
            queryKey={queryKey}
            onReorder={(ids) => reorderScenes.mutate(ids)}
            onUpdate={(id, patch) => updateScene.mutate({ id, ...patch })}
            onDelete={(id) => deleteScene.mutate(id)}
            onSelectSlashItem={handleSelectSlashItem}
            onEditCheck={handleEditCheck}
            deleteLabel="Delete scene"
            wikiArticles={wikiArticles}
            onWikiLinkClick={(id) => setWikiModalId(id)}
            campaignId={campaignId}
          />
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
              <label htmlFor="pending-dc-sl">DC</label>
              <input
                id="pending-dc-sl"
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
