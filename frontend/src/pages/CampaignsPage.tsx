import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
} from '../hooks/useCampaigns'

export function CampaignsPage() {
  const navigate = useNavigate()
  const { data: campaigns, isLoading, isError } = useCampaigns()
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const deleteCampaign = useDeleteCampaign()

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editName, setEditName] = useState('')

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createCampaign.mutate(
      { name: newName.trim() },
      {
        onSuccess: (campaign) => {
          setNewName('')
          setCreating(false)
          navigate(`/campaigns/${campaign.id}/sessions`)
        },
      },
    )
  }

  function commitEdit(id: number) {
    if (editName.trim() && editName.trim() !== campaigns?.find((c) => c.id === id)?.name) {
      updateCampaign.mutate({ id, name: editName.trim() })
    }
    setEditingId(null)
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Select Campaign</h1>
        <button className="btn-primary" onClick={() => setCreating((c) => !c)}>
          + New Campaign
        </button>
      </div>

      {creating && (
        <form className="create-form" onSubmit={handleCreate}>
          <input
            className="input"
            placeholder="Campaign name"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            autoFocus
          />
          <button className="btn-primary" type="submit" disabled={createCampaign.isPending}>
            Create
          </button>
          <button className="btn-ghost" type="button" onClick={() => setCreating(false)}>
            Cancel
          </button>
        </form>
      )}

      {isLoading && <p className="status-text">Loading…</p>}
      {isError && <p className="status-text error">Failed to load campaigns.</p>}

      <div className="campaign-list">
        {campaigns?.length === 0 && !isLoading && (
          <p className="empty-state">No campaigns yet. Create one to get started.</p>
        )}
        {campaigns?.map((campaign) => (
          <div key={campaign.id} className="campaign-card">
            {editingId === campaign.id ? (
              <input
                className="input campaign-name-input"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                onBlur={() => commitEdit(campaign.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') commitEdit(campaign.id)
                  if (e.key === 'Escape') setEditingId(null)
                }}
                autoFocus
              />
            ) : (
              <button
                className="campaign-select-btn"
                type="button"
                onClick={() => navigate(`/campaigns/${campaign.id}/sessions`)}
              >
                <span className="campaign-name">{campaign.name}</span>
                <span className="campaign-select-hint">Click to enter →</span>
              </button>
            )}
            <div className="campaign-actions">
              <button
                className="btn-icon"
                onClick={() => { setEditingId(campaign.id); setEditName(campaign.name) }}
                title="Rename campaign"
                type="button"
              >
                ✎
              </button>
              <button
                className="btn-icon btn-danger"
                onClick={() => {
                  if (window.confirm(`Delete campaign "${campaign.name}"? This will delete all sessions, storylines, and characters.`)) {
                    deleteCampaign.mutate(campaign.id)
                  }
                }}
                title="Delete campaign"
                type="button"
              >
                ✕
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
