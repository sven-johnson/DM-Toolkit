import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCampaignStorylines } from '../hooks/useCampaigns'
import { useCreateStoryline, useDeleteStoryline } from '../hooks/useStorylines'

export function StorylinesPage() {
  const navigate = useNavigate()
  const { campaignId: campaignIdStr } = useParams<{ campaignId: string }>()
  const campaignId = Number(campaignIdStr)

  const { data: storylines = [], isLoading, isError } = useCampaignStorylines(campaignId)
  const createStoryline = useCreateStoryline(campaignId)
  const deleteStoryline = useDeleteStoryline(campaignId)

  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    createStoryline.mutate(
      { title: newTitle.trim() },
      {
        onSuccess: (storyline) => {
          setNewTitle('')
          setCreating(false)
          navigate(`/campaigns/${campaignId}/storylines/${storyline.id}`)
        },
      },
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Storylines</h1>
        <button className="btn-primary" onClick={() => setCreating((c) => !c)}>
          + New Storyline
        </button>
      </div>

      {creating && (
        <form className="create-form" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Storyline title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={createStoryline.isPending}>
            Create
          </button>
          <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}

      {isLoading && <p className="status-text">Loading…</p>}
      {isError && <p className="status-text error">Failed to load storylines.</p>}

      <div className="session-list">
        {storylines.length === 0 && !isLoading && (
          <p className="empty-state">No storylines yet. Create one to get started.</p>
        )}
        {storylines.map((sl) => (
          <div key={sl.id} className="session-card">
            <Link
              to={`/campaigns/${campaignId}/storylines/${sl.id}`}
              className="session-link"
            >
              <span className="session-title">{sl.title}</span>
            </Link>
            <button
              className="btn-icon btn-danger"
              onClick={() => {
                if (window.confirm(`Delete storyline "${sl.title}"? This will delete all its scenes.`)) {
                  deleteStoryline.mutate(sl.id)
                }
              }}
              title="Delete storyline"
              type="button"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
