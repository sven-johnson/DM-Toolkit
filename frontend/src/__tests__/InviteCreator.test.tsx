import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { InviteCreator } from '../components/InviteCreator'
import { server } from '../test/server'
import { BASE } from '../test/handlers'

function setClipboard(impl: { writeText: (text: string) => Promise<void> } | undefined) {
  Object.defineProperty(navigator, 'clipboard', {
    value: impl,
    configurable: true,
  })
}

afterEach(() => {
  setClipboard(undefined)
})

test('invite button disabled with empty email', () => {
  render(<InviteCreator />)
  expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled()
})

test('invite button disabled with an invalid email', async () => {
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'not-an-email')
  expect(screen.getByRole('button', { name: 'Invite' })).toBeDisabled()
})

test('invite button enabled with a valid email', async () => {
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  expect(screen.getByRole('button', { name: 'Invite' })).toBeEnabled()
})

test('submits payload without campaign_id when no campaignId prop given', async () => {
  let captured: unknown = null
  server.use(
    http.post(`${BASE}/api/invites`, async ({ request }) => {
      captured = await request.json()
      return HttpResponse.json(
        { id: 'inv-1', email: 'x@example.com', campaign_id: null, role: null, expires_at: new Date().toISOString() },
        { status: 201 },
      )
    }),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))

  await waitFor(() => expect(captured).toEqual({ email: 'x@example.com', campaign_id: null }))
})

test('submits payload with campaign_id when campaignId prop given', async () => {
  let captured: unknown = null
  server.use(
    http.post(`${BASE}/api/invites`, async ({ request }) => {
      captured = await request.json()
      return HttpResponse.json(
        { id: 'inv-2', email: 'x@example.com', campaign_id: 'camp-1', role: 'player', expires_at: new Date().toISOString() },
        { status: 201 },
      )
    }),
  )
  const user = userEvent.setup()
  render(<InviteCreator campaignId="camp-1" />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))

  await waitFor(() => expect(captured).toEqual({ email: 'x@example.com', campaign_id: 'camp-1' }))
})

test('builds the link from window.location.origin and the returned invite id', async () => {
  server.use(
    http.post(`${BASE}/api/invites`, () =>
      HttpResponse.json(
        { id: 'abc-123', email: 'x@example.com', campaign_id: null, role: null, expires_at: new Date(Date.now() + 14 * 86400000).toISOString() },
        { status: 201 },
      ),
    ),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))

  const linkInput = await screen.findByDisplayValue(`${window.location.origin}/invite?id=abc-123`)
  expect(linkInput).toBeInTheDocument()
  expect(screen.getByText(/expires in 14 days/)).toBeInTheDocument()
})

test('focusing the link input selects its full text', async () => {
  server.use(
    http.post(`${BASE}/api/invites`, () =>
      HttpResponse.json(
        { id: 'abc-123', email: 'x@example.com', campaign_id: null, role: null, expires_at: new Date().toISOString() },
        { status: 201 },
      ),
    ),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  const linkInput = (await screen.findByDisplayValue(
    `${window.location.origin}/invite?id=abc-123`,
  )) as HTMLInputElement

  await user.click(linkInput)
  expect(linkInput.selectionStart).toBe(0)
  expect(linkInput.selectionEnd).toBe(linkInput.value.length)
})

test('copy success shows "Copied!"', async () => {
  server.use(
    http.post(`${BASE}/api/invites`, () =>
      HttpResponse.json(
        { id: 'abc-123', email: 'x@example.com', campaign_id: null, role: null, expires_at: new Date().toISOString() },
        { status: 201 },
      ),
    ),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  await screen.findByDisplayValue(`${window.location.origin}/invite?id=abc-123`)

  // Set up the clipboard mock after userEvent.setup()/render — userEvent
  // installs its own navigator.clipboard stub lazily, which would otherwise
  // overwrite this mock if set beforehand.
  const writeText = vi.fn().mockResolvedValue(undefined)
  setClipboard({ writeText })

  await user.click(screen.getByRole('button', { name: 'Copy' }))
  expect(await screen.findByRole('button', { name: 'Copied!' })).toBeInTheDocument()
  expect(writeText).toHaveBeenCalledWith(`${window.location.origin}/invite?id=abc-123`)
})

test('clipboard rejection falls back to a manual-copy prompt and selects the input', async () => {
  server.use(
    http.post(`${BASE}/api/invites`, () =>
      HttpResponse.json(
        { id: 'abc-123', email: 'x@example.com', campaign_id: null, role: null, expires_at: new Date().toISOString() },
        { status: 201 },
      ),
    ),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  const linkInput = await screen.findByDisplayValue(`${window.location.origin}/invite?id=abc-123`)

  const writeText = vi.fn().mockRejectedValue(new Error('denied'))
  setClipboard({ writeText })

  await user.click(screen.getByRole('button', { name: 'Copy' }))
  expect(await screen.findByText('Press Ctrl/Cmd+C to copy')).toBeInTheDocument()
  expect((linkInput as HTMLInputElement).selectionStart).toBe(0)
  expect((linkInput as HTMLInputElement).selectionEnd).toBe(
    (linkInput as HTMLInputElement).value.length,
  )
})

test('clipboard API unavailable falls back the same way', async () => {
  server.use(
    http.post(`${BASE}/api/invites`, () =>
      HttpResponse.json(
        { id: 'abc-123', email: 'x@example.com', campaign_id: null, role: null, expires_at: new Date().toISOString() },
        { status: 201 },
      ),
    ),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  await screen.findByDisplayValue(`${window.location.origin}/invite?id=abc-123`)

  setClipboard(undefined)

  await user.click(screen.getByRole('button', { name: 'Copy' }))
  expect(await screen.findByText('Press Ctrl/Cmd+C to copy')).toBeInTheDocument()
})

test('submitting the form directly with no email does not call the API', async () => {
  let called = false
  server.use(
    http.post(`${BASE}/api/invites`, () => {
      called = true
      return HttpResponse.json({ id: 'x', email: 'x', campaign_id: null, role: null, expires_at: new Date().toISOString() })
    }),
  )
  render(<InviteCreator />)
  const form = screen.getByPlaceholderText('Email address').closest('form')!
  fireEvent.submit(form)
  expect(called).toBe(false)
})

test('409 with no server detail falls back to a generic conflict message', async () => {
  server.use(http.post(`${BASE}/api/invites`, () => HttpResponse.json(null, { status: 409 })))
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))

  expect(await screen.findByText('This invite could not be created.')).toBeInTheDocument()
})

test('409 shows the server detail inline', async () => {
  server.use(
    http.post(`${BASE}/api/invites`, () =>
      HttpResponse.json({ detail: 'A user with this email already exists.' }, { status: 409 }),
    ),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))

  expect(await screen.findByText('A user with this email already exists.')).toBeInTheDocument()
})

test('403 shows a generic error', async () => {
  server.use(
    http.post(`${BASE}/api/invites`, () => HttpResponse.json({ detail: 'Admin access required' }, { status: 403 })),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)
  await user.type(screen.getByPlaceholderText('Email address'), 'x@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))

  expect(await screen.findByText('Failed to create invite.')).toBeInTheDocument()
})

test('can create a second invite after the first', async () => {
  let n = 0
  server.use(
    http.post(`${BASE}/api/invites`, () => {
      n += 1
      return HttpResponse.json(
        { id: `inv-${n}`, email: 'x@example.com', campaign_id: null, role: null, expires_at: new Date().toISOString() },
        { status: 201 },
      )
    }),
  )
  const user = userEvent.setup()
  render(<InviteCreator />)

  await user.type(screen.getByPlaceholderText('Email address'), 'first@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  await screen.findByDisplayValue(`${window.location.origin}/invite?id=inv-1`)

  await user.type(screen.getByPlaceholderText('Email address'), 'second@example.com')
  await user.click(screen.getByRole('button', { name: 'Invite' }))
  expect(await screen.findByDisplayValue(`${window.location.origin}/invite?id=inv-2`)).toBeInTheDocument()
})
