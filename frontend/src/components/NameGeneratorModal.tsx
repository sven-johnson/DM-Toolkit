import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import apiClient from '../api/client'

interface ProfileInfo {
  key: string
  display_name: string
}

interface Props {
  campaignId: number
  onClose: () => void
  onInsertText: (text: string) => void
  onInsertWikiLink: (articleId: number, title: string, category: string) => void
}

export function NameGeneratorModal({ campaignId, onClose, onInsertText, onInsertWikiLink }: Props) {
  const [profiles, setProfiles] = useState<ProfileInfo[]>([])
  const [selectedProfile, setSelectedProfile] = useState<string>('')
  const [name, setName] = useState<string>('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isCreatingStub, setIsCreatingStub] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function doGenerate(profile: string) {
    if (!profile) return
    setIsGenerating(true)
    setError(null)
    try {
      const { data } = await apiClient.post<{ profile: string; names: string[] }>('/names/generate', {
        profile,
        count: 1,
      })
      setName(data.names[0] ?? '')
    } catch {
      setError('Failed to generate name')
    } finally {
      setIsGenerating(false)
    }
  }

  useEffect(() => {
    apiClient.get<ProfileInfo[]>('/names/profiles').then(({ data }) => {
      setProfiles(data)
      if (data.length > 0) {
        setSelectedProfile(data[0].key)
        doGenerate(data[0].key)
      }
    }).catch(() => {
      setError('Failed to load profiles')
    })
  }, [])

  function handleProfileChange(profile: string) {
    setSelectedProfile(profile)
    doGenerate(profile)
  }

  async function handleCreateStub() {
    if (!name.trim()) return
    setIsCreatingStub(true)
    setError(null)
    try {
      const { data } = await apiClient.post<{ id: number; title: string; category: string }>('/wiki', {
        campaign_id: campaignId,
        title: name.trim(),
        category: 'npc',
        is_stub: true,
        image_url: null,
        tags: null,
        public_content: '',
        private_content: '',
      })
      onInsertWikiLink(data.id, data.title, data.category)
      onClose()
    } catch {
      setError('Failed to create stub')
    } finally {
      setIsCreatingStub(false)
    }
  }

  function handleEnterPlainText() {
    if (name.trim()) {
      onInsertText(name.trim())
      onClose()
    }
  }

  return createPortal(
    <div className="character-modal-overlay" onClick={onClose}>
      <div
        className="character-modal name-generator-modal"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Name Generator"
      >
        <div className="character-modal-header">
          <h2 style={{ margin: 0 }}>Name Generator</h2>
          <button className="btn-icon" onClick={onClose} type="button" title="Close">✕</button>
        </div>
        <div className="name-generator-body">
          {error && (
            <div style={{ color: 'var(--danger)', marginBottom: '0.5rem', fontSize: '0.875rem' }}>{error}</div>
          )}
          <div className="name-generator-row">
            <select
              value={selectedProfile}
              onChange={(e) => handleProfileChange(e.target.value)}
              className="name-generator-select"
              disabled={profiles.length === 0}
            >
              {profiles.map((p) => (
                <option key={p.key} value={p.key}>{p.display_name}</option>
              ))}
            </select>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="name-generator-input"
              placeholder={isGenerating ? 'Generating…' : 'Generated name…'}
              disabled={isGenerating}
            />
            <button
              type="button"
              className="btn-secondary"
              onClick={() => doGenerate(selectedProfile)}
              disabled={isGenerating || !selectedProfile}
            >
              New Name
            </button>
          </div>
          <div className="name-generator-actions">
            <button
              type="button"
              className="btn-primary"
              onClick={handleCreateStub}
              disabled={isCreatingStub || !name.trim()}
            >
              {isCreatingStub ? 'Creating…' : 'Create Stub'}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={handleEnterPlainText}
              disabled={!name.trim()}
            >
              Enter Plain Text
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
