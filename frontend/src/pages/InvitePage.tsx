import { useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { acceptInvite, getInvite, registerWithInvite } from '../api/invites'
import { useSetCampaignId, useSetCampaignRole } from '../context/CampaignContext'
import type { InviteStatus } from '../types'

function errorDetail(err: unknown): string | undefined {
  return (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
}

function BetaMessage() {
  return (
    <div className="login-page">
      <div className="login-form">
        <h1 className="login-title">DM Toolkit</h1>
        <p className="login-subtitle">
          This app is currently in closed beta and requires an invitation to join.
        </p>
      </div>
    </div>
  )
}

function RegisterForm({ id, invite }: { id: string; invite: InviteStatus }) {
  const navigate = useNavigate()
  const setCampaignId = useSetCampaignId()
  const setCampaignRole = useSetCampaignRole()

  const [email, setEmail] = useState(invite.email)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [beta, setBeta] = useState(false)
  const submittingRef = useRef(false)

  const passwordsMismatch = password !== '' && confirmPassword !== '' && password !== confirmPassword
  const canSubmit =
    email.trim() !== '' &&
    username.trim() !== '' &&
    password !== '' &&
    confirmPassword !== '' &&
    password === confirmPassword

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!canSubmit || submittingRef.current) return
    submittingRef.current = true
    setError('')
    setSubmitting(true)
    try {
      const { access_token } = await registerWithInvite(id, {
        email: email.trim(),
        username: username.trim(),
        password,
        confirm_password: confirmPassword,
      })
      localStorage.setItem('auth_token', access_token)
      if (invite.campaign_id) {
        setCampaignId(invite.campaign_id)
        setCampaignRole('player')
        navigate('/sessions')
      } else {
        navigate('/')
      }
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 404) {
        setBeta(true)
        return
      }
      setError(errorDetail(err) ?? 'Failed to create account.')
      setPassword('')
      setConfirmPassword('')
    } finally {
      submittingRef.current = false
      setSubmitting(false)
    }
  }

  if (beta) return <BetaMessage />

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSubmit}>
        <h1 className="login-title">DM Toolkit</h1>
        {invite.campaign_name && (
          <p className="login-subtitle">
            You've been invited to join <strong>{invite.campaign_name}</strong>.
          </p>
        )}
        <div className="form-group">
          <label className="form-label" htmlFor="invite-email">Email address</label>
          <input
            id="invite-email"
            className="input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="invite-username">Username</label>
          <input
            id="invite-username"
            className="input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            autoFocus
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="invite-password">Password</label>
          <input
            id="invite-password"
            className="input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        <div className="form-group">
          <label className="form-label" htmlFor="invite-confirm-password">Confirm password</label>
          <input
            id="invite-confirm-password"
            className="input"
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            autoComplete="new-password"
          />
        </div>
        {passwordsMismatch && <p className="form-error">Passwords do not match</p>}
        {error && <p className="form-error">{error}</p>}
        <button className="btn-primary" type="submit" disabled={!canSubmit || submitting}>
          {submitting ? 'Creating account…' : 'Create account'}
        </button>
      </form>
    </div>
  )
}

function JoinPrompt({ id, invite }: { id: string; invite: InviteStatus }) {
  const navigate = useNavigate()
  const setCampaignId = useSetCampaignId()
  const setCampaignRole = useSetCampaignRole()

  const [submitting, setSubmitting] = useState(false)
  const [wrongAccount, setWrongAccount] = useState(false)
  const [beta, setBeta] = useState(false)

  async function handleAccept() {
    // No extra re-entry guard needed: this is only ever invoked from the
    // button below, which disables itself via `submitting` — unlike the
    // register form, there's no alternate (e.g. Enter-key/form-submit) path
    // that could bypass that.
    setSubmitting(true)
    try {
      const { campaign_id } = await acceptInvite(id)
      setCampaignId(campaign_id)
      setCampaignRole('player')
      navigate('/sessions')
    } catch (err: unknown) {
      const status = (err as { response?: { status?: number } })?.response?.status
      if (status === 403) {
        setWrongAccount(true)
      } else {
        setBeta(true)
      }
    } finally {
      setSubmitting(false)
    }
  }

  function handleIgnore() {
    navigate('/')
  }

  if (beta) return <BetaMessage />

  if (wrongAccount) {
    return (
      <div className="login-page">
        <div className="login-form">
          <h1 className="login-title">DM Toolkit</h1>
          <p className="login-subtitle">This invitation was sent to a different account.</p>
          <button className="btn-primary" type="button" onClick={() => navigate('/')}>
            Go home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="login-page">
      <div className="login-form">
        <h1 className="login-title">DM Toolkit</h1>
        <p className="login-subtitle">
          You have been invited to join <strong>{invite.campaign_name}</strong>
        </p>
        <div className="modal-actions">
          <button className="btn-ghost" type="button" onClick={handleIgnore}>Ignore</button>
          <button className="btn-primary" type="button" onClick={handleAccept} disabled={submitting}>
            {submitting ? 'Accepting…' : 'Accept'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function InvitePage() {
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const id = params.get('id')

  const [status, setStatus] = useState<'loading' | 'beta' | 'ready'>(id ? 'loading' : 'beta')
  const [invite, setInvite] = useState<InviteStatus | null>(null)

  useEffect(() => {
    if (!id) {
      setStatus('beta')
      return
    }
    setStatus('loading')
    getInvite(id)
      .then((data) => {
        setInvite(data)
        setStatus('ready')
      })
      .catch(() => setStatus('beta'))
  }, [id])

  useEffect(() => {
    if (status === 'ready' && invite?.mode === 'join' && !localStorage.getItem('auth_token')) {
      const returnTo = encodeURIComponent(`/invite?id=${id}`)
      navigate(`/login?returnTo=${returnTo}`, { replace: true })
    }
  }, [status, invite, id, navigate])

  if (status === 'loading') {
    return (
      <div className="login-page">
        <div className="login-form">
          <h1 className="login-title">DM Toolkit</h1>
          <p className="login-subtitle">Loading…</p>
        </div>
      </div>
    )
  }

  if (status === 'beta' || !invite || !id) {
    return <BetaMessage />
  }

  if (invite.mode === 'register') {
    return <RegisterForm id={id} invite={invite} />
  }

  if (!localStorage.getItem('auth_token')) {
    // Redirecting via the effect above — render nothing in the meantime.
    return null
  }

  return <JoinPrompt id={id} invite={invite} />
}
