import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { InvitePage } from '../pages/InvitePage'
import { server } from '../test/server'
import { BASE } from '../test/handlers'

const mockNavigate = vi.fn()
vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => mockNavigate }
})

function renderInvitePage(search = '?id=invite-1') {
  return render(
    <MemoryRouter initialEntries={[`/invite${search}`]}>
      <Routes>
        <Route path="/invite" element={<InvitePage />} />
      </Routes>
    </MemoryRouter>,
  )
}

beforeEach(() => {
  mockNavigate.mockClear()
  localStorage.clear()
  sessionStorage.clear()
})

// ---------------------------------------------------------------------------
// Closed-beta message
// ---------------------------------------------------------------------------

test('no id shows beta message without calling the API', async () => {
  const spy = vi.fn()
  server.use(http.get(`${BASE}/api/invites/:id`, () => { spy(); return HttpResponse.json({}) }))
  renderInvitePage('')
  expect(await screen.findByText(/closed beta/i)).toBeInTheDocument()
  expect(spy).not.toHaveBeenCalled()
})

test('404 shows beta message', async () => {
  server.use(http.get(`${BASE}/api/invites/:id`, () => HttpResponse.json({ detail: 'invalid_invite' }, { status: 404 })))
  renderInvitePage()
  expect(await screen.findByText(/closed beta/i)).toBeInTheDocument()
})

test('network error shows beta message', async () => {
  server.use(http.get(`${BASE}/api/invites/:id`, () => HttpResponse.error()))
  renderInvitePage()
  expect(await screen.findByText(/closed beta/i)).toBeInTheDocument()
})

test('shows a loading state while the lookup is pending', async () => {
  server.use(http.get(`${BASE}/api/invites/:id`, () => new Promise(() => {})))
  renderInvitePage()
  expect(screen.getByText(/loading/i)).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Register mode
// ---------------------------------------------------------------------------

test('register mode renders all four fields with email pre-filled and editable', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'invited@example.com', campaign_name: null, campaign_id: null }),
    ),
  )
  renderInvitePage()
  const emailInput = await screen.findByLabelText('Email address')
  expect(emailInput).toHaveValue('invited@example.com')
  expect(screen.getByLabelText('Username')).toBeInTheDocument()
  expect(screen.getByLabelText('Password')).toBeInTheDocument()
  expect(screen.getByLabelText('Confirm password')).toBeInTheDocument()

  const user = userEvent.setup()
  await user.clear(emailInput)
  await user.type(emailInput, 'edited@example.com')
  expect(emailInput).toHaveValue('edited@example.com')
})

test('campaign name line shown only when present', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: 'Dragon Heist', campaign_id: 'camp-1' }),
    ),
  )
  renderInvitePage()
  expect(await screen.findByText(/Dragon Heist/)).toBeInTheDocument()
})

test('campaign name line absent for platform invites', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: null, campaign_id: null }),
    ),
  )
  renderInvitePage()
  await screen.findByLabelText('Username')
  expect(screen.queryByText(/invited to join/i)).not.toBeInTheDocument()
})

async function fillRegisterForm(opts?: { username?: string; password?: string; confirm?: string }) {
  const user = userEvent.setup()
  await user.type(screen.getByLabelText('Username'), opts?.username ?? 'newgm')
  if (opts?.password !== undefined) await user.type(screen.getByLabelText('Password'), opts.password)
  if (opts?.confirm !== undefined) await user.type(screen.getByLabelText('Confirm password'), opts.confirm)
  return user
}

test('submit button disabled with empty fields', async () => {
  renderInvitePage()
  await screen.findByLabelText('Username')
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
})

test('submit button disabled and mismatch text shown when passwords differ', async () => {
  renderInvitePage()
  await screen.findByLabelText('Username')
  await fillRegisterForm({ password: 'password123', confirm: 'different456' })
  expect(screen.getByText('Passwords do not match')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: 'Create account' })).toBeDisabled()
})

test('submit button enabled when all fields valid and matching', async () => {
  renderInvitePage()
  await screen.findByLabelText('Username')
  await fillRegisterForm({ password: 'password123', confirm: 'password123' })
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  expect(screen.queryByText('Passwords do not match')).not.toBeInTheDocument()
})

test('submit calls the API with the correct payload and invite id', async () => {
  let captured: { url: string; body: unknown } | null = null
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'invited@example.com', campaign_name: null, campaign_id: null }),
    ),
    http.post(`${BASE}/api/invites/:id/register`, async ({ request, params }) => {
      captured = { url: `${params.id}`, body: await request.json() }
      return HttpResponse.json({ access_token: 'tok', token_type: 'bearer' }, { status: 201 })
    }),
  )
  renderInvitePage('?id=invite-42')
  await screen.findByLabelText('Username')
  const user = await fillRegisterForm({ password: 'password123', confirm: 'password123' })
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(captured).not.toBeNull())
  expect(captured!.url).toBe('invite-42')
  expect(captured!.body).toEqual({
    email: 'invited@example.com',
    username: 'newgm',
    password: 'password123',
    confirm_password: 'password123',
  })
})

test('success stores the token and navigates home for a platform invite', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: null, campaign_id: null }),
    ),
    http.post(`${BASE}/api/invites/:id/register`, () =>
      HttpResponse.json({ access_token: 'platform-token', token_type: 'bearer' }, { status: 201 }),
    ),
  )
  renderInvitePage()
  await screen.findByLabelText('Username')
  const user = await fillRegisterForm({ password: 'password123', confirm: 'password123' })
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/'))
  expect(localStorage.getItem('auth_token')).toBe('platform-token')
})

test('success stores the token and navigates to sessions for a campaign invite', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: 'Dragon Heist', campaign_id: 'camp-1' }),
    ),
    http.post(`${BASE}/api/invites/:id/register`, () =>
      HttpResponse.json({ access_token: 'campaign-token', token_type: 'bearer' }, { status: 201 }),
    ),
  )
  renderInvitePage()
  await screen.findByLabelText('Username')
  const user = await fillRegisterForm({ password: 'password123', confirm: 'password123' })
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(mockNavigate).toHaveBeenCalledWith('/sessions'))
  expect(localStorage.getItem('auth_token')).toBe('campaign-token')
})

test('409 shows the server error and re-enables the form', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: null, campaign_id: null }),
    ),
    http.post(`${BASE}/api/invites/:id/register`, () =>
      HttpResponse.json({ detail: 'This email is already in use.' }, { status: 409 }),
    ),
  )
  renderInvitePage()
  await screen.findByLabelText('Username')
  const user = await fillRegisterForm({ password: 'password123', confirm: 'password123' })
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  await waitFor(() => expect(screen.getByText('This email is already in use.')).toBeInTheDocument())
  // Password fields are cleared on error (per spec, that's fine), so the form
  // isn't "enabled" until refilled — but it must not be stuck disabled from
  // the in-flight submit itself.
  await user.type(screen.getByLabelText('Password'), 'password123')
  await user.type(screen.getByLabelText('Confirm password'), 'password123')
  expect(screen.getByRole('button', { name: 'Create account' })).toBeEnabled()
  expect(mockNavigate).not.toHaveBeenCalled()
})

test('404 on submit switches to the beta message', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: null, campaign_id: null }),
    ),
    http.post(`${BASE}/api/invites/:id/register`, () =>
      HttpResponse.json({ detail: 'invalid_invite' }, { status: 404 }),
    ),
  )
  renderInvitePage()
  await screen.findByLabelText('Username')
  const user = await fillRegisterForm({ password: 'password123', confirm: 'password123' })
  await user.click(screen.getByRole('button', { name: 'Create account' }))

  expect(await screen.findByText(/closed beta/i)).toBeInTheDocument()
})

test('double-click submits only once', async () => {
  let callCount = 0
  server.use(
    http.get(`${BASE}/api/invites/:id`, () =>
      HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: null, campaign_id: null }),
    ),
    http.post(`${BASE}/api/invites/:id/register`, async () => {
      callCount += 1
      await new Promise((resolve) => setTimeout(resolve, 20))
      return HttpResponse.json({ access_token: 'tok', token_type: 'bearer' }, { status: 201 })
    }),
  )
  renderInvitePage()
  await screen.findByLabelText('Username')
  const user = await fillRegisterForm({ password: 'password123', confirm: 'password123' })

  const button = screen.getByRole('button', { name: 'Create account' })
  await user.dblClick(button)

  await waitFor(() => expect(mockNavigate).toHaveBeenCalled())
  expect(callCount).toBe(1)
})
