import { useEffect, useState } from 'react'
import apiClient from '../api/client'

// ---------------------------------------------------------------------------
// JSON schema download helper
// ---------------------------------------------------------------------------

function downloadJsonSchema(schema: unknown, filename: string): void {
  const blob = new Blob([JSON.stringify(schema, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

const wikiImportSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Wiki Import',
  description: 'Schema for bulk-importing wiki articles into the DM Toolkit. Articles are matched by title; existing articles are updated, new titles are created.',
  type: 'object',
  required: ['campaign_id', 'articles'],
  properties: {
    campaign_id: { type: 'integer', description: 'ID of the campaign to import into' },
    articles: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', description: 'Article title (used as unique key within the campaign)' },
          category: { type: 'string', default: 'other', description: 'Article category (e.g. person, place, faction, item, lore, other)' },
          is_stub: { type: 'boolean', default: false, description: 'Mark as a stub/placeholder article' },
          image_url: { type: ['string', 'null'], default: null },
          tags: { type: ['array', 'null'], items: { type: 'string' }, default: null },
          public_content: { type: 'string', default: '', description: 'Player-visible content (Markdown)' },
          private_content: { type: 'string', default: '', description: 'DM-only notes (Markdown)' },
          associations: {
            type: 'array',
            default: [],
            items: {
              type: 'object',
              required: ['target_title', 'association_label'],
              properties: {
                target_title: { type: 'string' },
                target_category: { type: 'string', default: 'other' },
                association_label: { type: 'string', description: 'Relationship label, e.g. "Member of", "Located in"' },
              },
            },
          },
        },
      },
    },
  },
}

const storylineImportSchema = {
  $schema: 'http://json-schema.org/draft-07/schema#',
  title: 'Storyline Import',
  description: 'Schema for bulk-importing storylines and scenes into the DM Toolkit. Storylines are matched by title; existing ones are updated, new titles are created. Scenes within a storyline are matched by title in the same way.',
  type: 'object',
  required: ['campaign_id', 'storylines'],
  properties: {
    campaign_id: { type: 'integer', description: 'ID of the campaign to import into' },
    storylines: {
      type: 'array',
      items: {
        type: 'object',
        required: ['title'],
        properties: {
          title: { type: 'string', description: 'Storyline title (used as unique key within the campaign)' },
          description: { type: ['string', 'null'], default: null },
          scenes: {
            type: 'array',
            default: [],
            items: {
              type: 'object',
              required: ['title'],
              properties: {
                title: { type: 'string', description: 'Scene title (used as unique key within the storyline)' },
                body: { type: 'string', default: '', description: 'Scene content (Markdown)' },
                dm_notes: { type: ['string', 'null'], default: null, description: 'DM-only notes (Markdown)' },
                scene_type: { type: 'string', default: 'story', enum: ['story', 'combat', 'puzzle', 'shop'] },
                puzzle_clues: { type: ['string', 'null'], default: null },
                puzzle_solution: { type: ['string', 'null'], default: null },
                enemies: {
                  type: 'array',
                  default: [],
                  items: {
                    type: 'object',
                    required: ['name', 'quantity'],
                    properties: {
                      name: { type: 'string' },
                      quantity: { type: 'integer', minimum: 1 },
                    },
                  },
                },
                shop_items: {
                  type: 'array',
                  default: [],
                  items: {
                    type: 'object',
                    required: ['name', 'price', 'currency'],
                    properties: {
                      name: { type: 'string' },
                      description: { type: ['string', 'null'], default: null },
                      price: { type: 'integer', minimum: 0 },
                      currency: { type: 'string', default: 'gold', enum: ['copper', 'silver', 'gold'] },
                    },
                  },
                },
              },
            },
          },
        },
      },
    },
  },
}

// ---------------------------------------------------------------------------
// Username edit modal
// ---------------------------------------------------------------------------

interface EditUsernameModalProps {
  currentUsername: string
  onClose: () => void
  onSaved: (newUsername: string) => void
}

function EditUsernameModal({ currentUsername, onClose, onSaved }: EditUsernameModalProps) {
  const [newUsername, setNewUsername] = useState(currentUsername)
  const [currentPassword, setCurrentPassword] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  async function handleSave() {
    setError('')
    if (!newUsername.trim()) { setError('Username cannot be empty.'); return }
    if (!currentPassword) { setError('Please enter your current password.'); return }
    setSaving(true)
    try {
      const { data } = await apiClient.put<{ username: string }>('/auth/username', {
        current_password: currentPassword,
        new_username: newUsername.trim(),
      })
      onSaved(data.username)
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setError(msg ?? 'Failed to update username.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>
        <h2 className="modal-title">Change Username</h2>
        <div className="form-group">
          <label className="form-label">New username</label>
          <input
            className="input"
            value={newUsername}
            onChange={(e) => setNewUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label">Current password</label>
          <input
            className="input"
            type="password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave() }}
          />
        </div>
        {error && <p className="form-error">{error}</p>}
        <div className="modal-actions">
          <button className="btn-ghost" type="button" onClick={onClose}>Cancel</button>
          <button className="btn-primary" type="button" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// UserSettingsPage
// ---------------------------------------------------------------------------

export function UserSettingsPage() {
  const [username, setUsername] = useState('')
  const [loadingUser, setLoadingUser] = useState(true)
  const [showEditModal, setShowEditModal] = useState(false)

  // Password form
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    apiClient.get<{ username: string }>('/auth/me')
      .then(({ data }) => setUsername(data.username))
      .finally(() => setLoadingUser(false))
  }, [])

  async function handlePasswordSave() {
    setPasswordError('')
    setPasswordSuccess(false)
    if (!currentPassword) { setPasswordError('Please enter your current password.'); return }
    if (!newPassword) { setPasswordError('New password cannot be empty.'); return }
    if (newPassword !== confirmPassword) { setPasswordError('New password and confirmation do not match.'); return }
    setSavingPassword(true)
    try {
      await apiClient.put('/auth/password', {
        current_password: currentPassword,
        new_password: newPassword,
        confirm_password: confirmPassword,
      })
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
      setPasswordError(msg ?? 'Failed to update password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <div className="page">
      <div className="page-header">
        <h1>Settings</h1>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Account</h2>

        <div className="settings-row">
          <div className="settings-row-label">Username</div>
          <div className="settings-row-value">
            {loadingUser ? '…' : username}
          </div>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => setShowEditModal(true)}
            disabled={loadingUser}
          >
            Edit
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">Change Password</h2>

        <div className="settings-form">
          <div className="form-group">
            <label className="form-label">Current password</label>
            <input
              className="input"
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">New password</label>
            <input
              className="input"
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="form-group">
            <label className="form-label">Confirm new password</label>
            <input
              className="input"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handlePasswordSave() }}
              autoComplete="new-password"
            />
          </div>
          {passwordError && <p className="form-error">{passwordError}</p>}
          {passwordSuccess && <p className="form-success">Password updated successfully.</p>}
          <button
            className="btn-primary"
            type="button"
            onClick={handlePasswordSave}
            disabled={savingPassword}
          >
            {savingPassword ? 'Saving…' : 'Save Password'}
          </button>
        </div>
      </div>

      <div className="settings-section">
        <h2 className="settings-section-title">JSON Schemas</h2>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
          Download JSON Schema files to use as templates when creating import documents.
        </p>
        <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => downloadJsonSchema(wikiImportSchema, 'wiki-import-schema.json')}
          >
            Wiki Import Schema
          </button>
          <button
            className="btn-ghost"
            type="button"
            onClick={() => downloadJsonSchema(storylineImportSchema, 'storyline-import-schema.json')}
          >
            Storyline Import Schema
          </button>
        </div>
      </div>

      {showEditModal && (
        <EditUsernameModal
          currentUsername={username}
          onClose={() => setShowEditModal(false)}
          onSaved={(name) => {
            setUsername(name)
            setShowEditModal(false)
          }}
        />
      )}
    </div>
  )
}
