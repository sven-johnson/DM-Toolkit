import { useRef, useState } from 'react'
import { createInvite } from '../api/invites'

interface InviteCreatorProps {
  campaignId?: string
}

function errorDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

function daysUntil(isoDate: string): number {
  const diffMs = new Date(isoDate).getTime() - Date.now()
  return Math.max(1, Math.round(diffMs / (1000 * 60 * 60 * 24)))
}

export function InviteCreator({ campaignId }: InviteCreatorProps) {
  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [link, setLink] = useState('')
  const [expiresInDays, setExpiresInDays] = useState<number | null>(null)
  const [copied, setCopied] = useState(false)
  const [copyFallback, setCopyFallback] = useState(false)
  const linkInputRef = useRef<HTMLInputElement>(null)

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
  const canSubmit = emailValid && !submitting

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit) return
    setError('')
    setSubmitting(true)
    try {
      const invite = await createInvite(email.trim(), campaignId)
      setLink(`${window.location.origin}/invite?id=${invite.id}`)
      setExpiresInDays(daysUntil(invite.expires_at))
      setEmail('')
      setCopied(false)
      setCopyFallback(false)
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 409) {
        setError(errorDetail(err) ?? 'This invite could not be created.')
      } else {
        setError('Failed to create invite.')
      }
    } finally {
      setSubmitting(false)
    }
  }

  async function handleCopy() {
    try {
      if (!navigator.clipboard) throw new Error('Clipboard API unavailable')
      await navigator.clipboard.writeText(link)
      setCopied(true)
      setCopyFallback(false)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      setCopyFallback(true)
      setCopied(false)
      linkInputRef.current?.select()
    }
  }

  return (
    <div>
      <form onSubmit={handleSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
        <input
          className="input"
          style={{ flex: 1, minWidth: 200 }}
          type="email"
          required
          placeholder="Email address"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button className="btn-primary" type="submit" disabled={!canSubmit}>
          {submitting ? 'Inviting…' : 'Invite'}
        </button>
      </form>
      {error && <p className="form-error">{error}</p>}
      {link && (
        <div className="form-group" style={{ marginTop: '0.75rem' }}>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <input
              ref={linkInputRef}
              className="input"
              style={{ flex: 1 }}
              readOnly
              data-testid="invite-link"
              value={link}
              onFocus={(e) => e.target.select()}
            />
            <button className="btn-ghost" type="button" onClick={handleCopy}>
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          {copyFallback && <p className="form-error">Press Ctrl/Cmd+C to copy</p>}
          <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
            Send this link to the person you're inviting. It expires in {expiresInDays}{' '}
            {expiresInDays === 1 ? 'day' : 'days'} and can be used once.
          </p>
        </div>
      )}
    </div>
  )
}
