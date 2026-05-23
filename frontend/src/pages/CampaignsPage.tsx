import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useCampaignRole, useSetCampaignId, useSetCampaignRole } from '../context/CampaignContext'
import { useCurrentUser } from '../hooks/useCurrentUser'
import {
  useCampaigns,
  useCreateCampaign,
  useDeleteCampaign,
  useUpdateCampaign,
} from '../hooks/useCampaigns'
import apiClient from '../api/client'
import type { Campaign } from '../types'

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  game_master: 'Game Master',
  player: 'Player',
}

export function CampaignsPage() {
  const navigate = useNavigate()
  const setCampaignId = useSetCampaignId()
  const setCampaignRole = useSetCampaignRole()
  const currentRole = useCampaignRole()
  const { data: currentUser } = useCurrentUser()
  const { data: campaigns, isLoading, isError } = useCampaigns()
  const createCampaign = useCreateCampaign()
  const updateCampaign = useUpdateCampaign()
  const deleteCampaign = useDeleteCampaign()

  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editName, setEditName] = useState('')

  // Member management state
  const [managingCampaign, setManagingCampaign] = useState<Campaign | null>(null)
  const [members, setMembers] = useState<{ user_id: string; username: string; role: string }[]>([])
  const [allUsers, setAllUsers] = useState<{ id: string; username: string }[]>([])
  const [addUserId, setAddUserId] = useState('')
  const [addRole, setAddRole] = useState('player')
  const [memberSaving, setMemberSaving] = useState(false)

  const isAdmin = currentUser?.is_admin ?? false

  function canEdit(campaign: Campaign): boolean {
    return isAdmin || campaign.my_role === 'owner' || campaign.my_role === 'game_master'
  }

  function canDelete(campaign: Campaign): boolean {
    return isAdmin || campaign.my_role === 'owner'
  }

  function canManageMembers(campaign: Campaign): boolean {
    return isAdmin || campaign.my_role === 'owner'
  }

  function handleSelect(campaign: Campaign) {
    setCampaignId(campaign.id)
    setCampaignRole(campaign.my_role)
    navigate('/sessions')
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault()
    if (!newName.trim()) return
    createCampaign.mutate(
      { name: newName.trim() },
      {
        onSuccess: (campaign) => {
          setNewName('')
          setCreating(false)
          setCampaignId(campaign.id)
          setCampaignRole(campaign.my_role)
          navigate('/sessions')
        },
      },
    )
  }

  function commitEdit(id: string) {
    if (editName.trim() && editName.trim() !== campaigns?.find((c) => c.id === id)?.name) {
      updateCampaign.mutate({ id, name: editName.trim() })
    }
    setEditingId(null)
  }

  async function openMemberManager(campaign: Campaign) {
    setManagingCampaign(campaign)
    const [membersRes] = await Promise.all([
      apiClient.get<{ user_id: string; username: string; role: string }[]>(
        `/campaigns/${campaign.id}/members`,
      ),
    ])
    setMembers(membersRes.data)
    if (isAdmin) {
      const usersRes = await apiClient.get<{ id: string; username: string }[]>('/admin/users')
      setAllUsers(usersRes.data)
    }
  }

  async function handleAddMember(e: React.FormEvent) {
    e.preventDefault()
    if (!managingCampaign || !addUserId) return
    setMemberSaving(true)
    try {
      await apiClient.put(`/campaigns/${managingCampaign.id}/members`, {
        user_id: addUserId,
        role: addRole,
      })
      const res = await apiClient.get<{ user_id: string; username: string; role: string }[]>(
        `/campaigns/${managingCampaign.id}/members`,
      )
      setMembers(res.data)
      setAddUserId('')
      setAddRole('player')
    } finally {
      setMemberSaving(false)
    }
  }

  async function handleChangeMemberRole(userId: string, newRole: string) {
    if (!managingCampaign) return
    await apiClient.put(`/campaigns/${managingCampaign.id}/members`, {
      user_id: userId,
      role: newRole,
    })
    setMembers((prev) => prev.map((m) => (m.user_id === userId ? { ...m, role: newRole } : m)))
  }

  async function handleRemoveMember(userId: string) {
    if (!managingCampaign) return
    await apiClient.delete(`/campaigns/${managingCampaign.id}/members/${userId}`)
    setMembers((prev) => prev.filter((m) => m.user_id !== userId))
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
                onClick={() => handleSelect(campaign)}
              >
                <span className="campaign-name">{campaign.name}</span>
                {campaign.my_role && (
                  <span className="campaign-role-badge">{ROLE_LABELS[campaign.my_role] ?? campaign.my_role}</span>
                )}
                <span className="campaign-select-hint">Click to enter →</span>
              </button>
            )}
            <div className="campaign-actions">
              {canEdit(campaign) && (
                <button
                  className="btn-icon"
                  onClick={() => { setEditingId(campaign.id); setEditName(campaign.name) }}
                  title="Rename campaign"
                  type="button"
                >
                  ✎
                </button>
              )}
              {canManageMembers(campaign) && (
                <button
                  className="btn-icon"
                  onClick={() => openMemberManager(campaign)}
                  title="Manage members"
                  type="button"
                >
                  👥
                </button>
              )}
              {canDelete(campaign) && (
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
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Member management modal */}
      {managingCampaign && (
        <div className="modal-overlay" onClick={() => setManagingCampaign(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2 style={{ margin: 0, fontSize: '1rem' }}>Members — {managingCampaign.name}</h2>
              <button className="btn-icon" onClick={() => setManagingCampaign(null)}>✕</button>
            </div>

            <div style={{ marginBottom: '1rem' }}>
              {members.length === 0 ? (
                <p className="empty-state" style={{ margin: '0.5rem 0' }}>No members yet.</p>
              ) : (
                members.map((m) => (
                  <div key={m.user_id} className="member-row">
                    <span className="member-username">{m.username}</span>
                    <select
                      className="input"
                      style={{ width: 130, fontSize: '0.8rem', padding: '0.15rem 0.3rem' }}
                      value={m.role}
                      onChange={(e) => handleChangeMemberRole(m.user_id, e.target.value)}
                    >
                      <option value="player">Player</option>
                      <option value="game_master">Game Master</option>
                      <option value="owner">Owner</option>
                    </select>
                    <button
                      className="btn-icon btn-danger"
                      style={{ fontSize: '0.75rem' }}
                      onClick={() => handleRemoveMember(m.user_id)}
                      title="Remove member"
                    >
                      ✕
                    </button>
                  </div>
                ))
              )}
            </div>

            <form onSubmit={handleAddMember} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
              {isAdmin && allUsers.length > 0 ? (
                <select
                  className="input"
                  style={{ flex: 1 }}
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                >
                  <option value="">Select user…</option>
                  {allUsers
                    .filter((u) => !members.some((m) => m.user_id === u.id))
                    .map((u) => (
                      <option key={u.id} value={u.id}>{u.username}</option>
                    ))}
                </select>
              ) : (
                <input
                  className="input"
                  style={{ flex: 1 }}
                  placeholder="User ID"
                  value={addUserId}
                  onChange={(e) => setAddUserId(e.target.value)}
                />
              )}
              <select
                className="input"
                style={{ width: 130 }}
                value={addRole}
                onChange={(e) => setAddRole(e.target.value)}
              >
                <option value="player">Player</option>
                <option value="game_master">Game Master</option>
                <option value="owner">Owner</option>
              </select>
              <button
                className="btn-primary"
                type="submit"
                disabled={!addUserId || memberSaving}
                style={{ fontSize: '0.85rem' }}
              >
                {memberSaving ? 'Adding…' : 'Add'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
