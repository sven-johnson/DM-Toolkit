import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { useCreateSession, useDeleteSession, useSessions } from '../hooks/useSessions'
import { useCampaignStorylines } from '../hooks/useCampaigns'

export function SessionsPage() {
  const navigate = useNavigate()
  const { campaignId: campaignIdStr } = useParams<{ campaignId: string }>()
  const campaignId = Number(campaignIdStr)

  const { data: sessions, isLoading, isError } = useSessions(campaignId)
  const { data: storylines = [] } = useCampaignStorylines(campaignId)
  const createSession = useCreateSession(campaignId)
  const deleteSession = useDeleteSession(campaignId)

  const [creating, setCreating] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [selectedStorylineId, setSelectedStorylineId] = useState<number | ''>('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newTitle.trim()) return
    createSession.mutate(
      {
        title: newTitle.trim(),
        storyline_id: selectedStorylineId !== '' ? selectedStorylineId : null,
      },
      {
        onSuccess: (session) => {
          setNewTitle('')
          setSelectedStorylineId('')
          setCreating(false)
          navigate(`/campaigns/${campaignId}/sessions/${session.id}`)
        },
      },
    )
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Sessions</h1>
        <button className="btn-primary" onClick={() => setCreating((c) => !c)}>
          + New Session
        </button>
      </div>

      {creating && (
        <form className="create-form" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Session title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            autoFocus
          />
          <select
            className="input"
            value={selectedStorylineId}
            onChange={(e) =>
              setSelectedStorylineId(e.target.value === '' ? '' : Number(e.target.value))
            }
          >
            <option value="">No storyline</option>
            {storylines.map((sl) => (
              <option key={sl.id} value={sl.id}>
                {sl.title}
              </option>
            ))}
          </select>
          <button className="btn-primary" type="submit" disabled={createSession.isPending}>
            Create
          </button>
          <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}

      {isLoading && <p className="status-text">Loading…</p>}
      {isError && <p className="status-text error">Failed to load sessions.</p>}

      <div className="session-list">
        {sessions?.length === 0 && (
          <p className="empty-state">No sessions yet. Create one to get started.</p>
        )}
        {sessions?.map((session) => (
          <div key={session.id} className="session-card">
            <Link
              to={`/campaigns/${campaignId}/sessions/${session.id}`}
              className="session-link"
            >
              <span className="session-title">{session.title}</span>
              {session.date && <span className="session-date">{session.date}</span>}
            </Link>
            <button
              className="btn-icon btn-danger"
              onClick={() => deleteSession.mutate(session.id)}
              title="Delete session"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
