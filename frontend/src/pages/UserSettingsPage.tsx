import { useEffect, useState } from 'react'
import apiClient from '../api/client'

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
