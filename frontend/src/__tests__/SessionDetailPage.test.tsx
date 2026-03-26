import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { SessionDetailPage } from '../pages/SessionDetailPage'
import { server } from '../test/server'
import { fixtureSession, fixtureCharacter, fixtureCheck, fixtureScene } from '../test/handlers'

// ---------------------------------------------------------------------------
// Mock SceneEditor — Tiptap / ProseMirror cannot run in jsdom
// ---------------------------------------------------------------------------

vi.mock('../components/SceneEditor', () => ({
  SceneEditor: ({
    onSelectSlashItem,
  }: {
    content: string
    onSave: (md: string) => void
    onSelectSlashItem: (item: { type: 'skill' | 'save'; subtype: string; label: string }) => void
  }) => (
    <div data-testid="scene-editor">
      <button
        type="button"
        onClick={() =>
          onSelectSlashItem({ type: 'skill', subtype: 'perception', label: 'Perception' })
        }
      >
        Trigger Slash
      </button>
    </div>
  ),
}))

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeClient() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

function renderPage(sessionId = '1') {
  localStorage.setItem('auth_token', 'test-token')
  return render(
    <QueryClientProvider client={makeClient()}>
      <MemoryRouter initialEntries={[`/sessions/${sessionId}`]}>
        <Routes>
          <Route path="/sessions/:id" element={<SessionDetailPage />} />
          <Route path="/characters" element={<div>Characters Page</div>} />
          <Route path="/" element={<div>Sessions Page</div>} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// Loading & error states
// ---------------------------------------------------------------------------

test('shows loading state while fetching session', () => {
  server.use(
    http.get('http://localhost:8000/sessions/:id', () => new Promise(() => {})),
  )
  renderPage()
  expect(screen.getByText('Loading…')).toBeInTheDocument()
})

test('shows error state when session is not found', async () => {
  server.use(
    http.get('http://localhost:8000/sessions/:id', () =>
      HttpResponse.json({ detail: 'Not found' }, { status: 404 }),
    ),
  )
  renderPage('999')
  await waitFor(() => {
    expect(screen.getByText('Session not found.')).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Session data
// ---------------------------------------------------------------------------

test('renders session title and date after load', async () => {
  renderPage()
  await waitFor(() => {
    expect(screen.getByRole('heading', { name: 'Session One' })).toBeInTheDocument()
  })
  expect(screen.getByText('2024-01-15')).toBeInTheDocument()
})

test('shows back link to sessions list', async () => {
  renderPage()
  await waitFor(() => screen.getByRole('heading', { name: 'Session One' }))
  expect(screen.getByRole('link', { name: /← Sessions/i })).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Scenes
// ---------------------------------------------------------------------------

test('shows empty state when session has no scenes', async () => {
  server.use(
    http.get('http://localhost:8000/sessions/:id', () =>
      HttpResponse.json({ ...fixtureSession, scenes: [] }),
    ),
  )
  renderPage()
  await waitFor(() => {
    expect(screen.getByText(/No scenes yet/i)).toBeInTheDocument()
  })
})

test('renders existing scenes', async () => {
  renderPage()
  await waitFor(() => {
    expect(screen.getByText('The Tavern')).toBeInTheDocument()
  })
})

test('renders check widgets when scene has checks', async () => {
  const sceneWithCheck = { ...fixtureScene, checks: [fixtureCheck] }
  server.use(
    http.get('http://localhost:8000/sessions/:id', () =>
      HttpResponse.json({ ...fixtureSession, scenes: [sceneWithCheck] }),
    ),
  )
  renderPage()
  await waitFor(() => {
    expect(screen.getByText(/Perception Check/i)).toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Add scene
// ---------------------------------------------------------------------------

test('shows add scene form when button is clicked', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByRole('heading', { name: 'Session One' }))

  await user.click(screen.getByRole('button', { name: /\+ Add Scene/i }))

  expect(screen.getByPlaceholderText('Scene title')).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /^Add$/i })).toBeInTheDocument()
  expect(screen.getByRole('button', { name: /Cancel/i })).toBeInTheDocument()
})

test('hides add scene form when Cancel is clicked', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByRole('heading', { name: 'Session One' }))

  await user.click(screen.getByRole('button', { name: /\+ Add Scene/i }))
  expect(screen.getByPlaceholderText('Scene title')).toBeInTheDocument()

  await user.click(screen.getByRole('button', { name: /Cancel/i }))
  expect(screen.queryByPlaceholderText('Scene title')).not.toBeInTheDocument()
})

test('submitting add scene form creates a new scene', async () => {
  const user = userEvent.setup()
  let posted = false
  server.use(
    http.post('http://localhost:8000/sessions/:id/scenes', async ({ request }) => {
      const body = (await request.json()) as { title: string }
      posted = true
      return HttpResponse.json(
        {
          id: 99,
          session_id: 1,
          title: body.title,
          body: '',
          order_index: 1,
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
          checks: [],
        },
        { status: 201 },
      )
    }),
  )

  renderPage()
  await waitFor(() => screen.getByRole('heading', { name: 'Session One' }))

  await user.click(screen.getByRole('button', { name: /\+ Add Scene/i }))
  await user.type(screen.getByPlaceholderText('Scene title'), 'New Scene')
  await user.click(screen.getByRole('button', { name: /^Add$/i }))

  await waitFor(() => expect(posted).toBe(true))
  // Form should close after success
  await waitFor(() => {
    expect(screen.queryByPlaceholderText('Scene title')).not.toBeInTheDocument()
  })
})

test('does not submit add scene form with empty title', async () => {
  const user = userEvent.setup()
  let posted = false
  server.use(
    http.post('http://localhost:8000/sessions/:id/scenes', async () => {
      posted = true
      return HttpResponse.json({}, { status: 201 })
    }),
  )

  renderPage()
  await waitFor(() => screen.getByRole('heading', { name: 'Session One' }))

  await user.click(screen.getByRole('button', { name: /\+ Add Scene/i }))
  await user.click(screen.getByRole('button', { name: /^Add$/i }))

  expect(posted).toBe(false)
})

// ---------------------------------------------------------------------------
// Character sidebar
// ---------------------------------------------------------------------------

test('shows empty sidebar with link to characters page when no characters', async () => {
  server.use(
    http.get('http://localhost:8000/characters', () => HttpResponse.json([])),
  )
  renderPage()
  await waitFor(() => screen.getByRole('heading', { name: 'Session One' }))

  expect(screen.getByText(/No characters/i)).toBeInTheDocument()
  expect(screen.getByRole('link', { name: /go to Characters page/i })).toBeInTheDocument()
})

test('shows party label in sidebar', async () => {
  renderPage()
  await waitFor(() => screen.getByText('Aria'))
  expect(screen.getByText('Party')).toBeInTheDocument()
})

test('shows character name and level in sidebar', async () => {
  renderPage()
  await waitFor(() => {
    expect(screen.getByText('Aria')).toBeInTheDocument()
  })
  expect(screen.getByText('Lv 5')).toBeInTheDocument()
})

test('shows character class in sidebar', async () => {
  renderPage()
  await waitFor(() => screen.getByText('Aria'))
  expect(screen.getByText(/Wizard/)).toBeInTheDocument()
})

test('opens character modal when character card is clicked', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('Aria'))

  const card = screen.getByRole('button', { name: /Aria/i })
  await user.click(card)

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  expect(screen.getByText('Abilities')).toBeInTheDocument()
  expect(screen.getByText('Skills')).toBeInTheDocument()
  expect(screen.getByText('Saving Throws')).toBeInTheDocument()
})

test('closes character modal when close button is clicked', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('Aria'))

  await user.click(screen.getByRole('button', { name: /Aria/i }))
  await waitFor(() => screen.getByRole('dialog'))

  const dialog = screen.getByRole('dialog')
  await user.click(within(dialog).getByRole('button', { name: '✕' }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

// ---------------------------------------------------------------------------
// Pending check modal (slash command flow)
// ---------------------------------------------------------------------------

test('shows pending check modal after slash command is triggered', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('The Tavern'))

  await user.click(screen.getByRole('button', { name: 'Trigger Slash' }))

  await waitFor(() => {
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })
  expect(screen.getByText(/Perception Check/i)).toBeInTheDocument()
  expect(screen.getByLabelText('DC')).toBeInTheDocument()
})

test('pending check modal defaults DC to 10', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('The Tavern'))

  await user.click(screen.getByRole('button', { name: 'Trigger Slash' }))

  await waitFor(() => screen.getByRole('dialog'))
  expect(screen.getByLabelText('DC')).toHaveValue(10)
})

test('pending check modal can be cancelled', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('The Tavern'))

  await user.click(screen.getByRole('button', { name: 'Trigger Slash' }))
  await waitFor(() => screen.getByRole('dialog'))

  await user.click(screen.getByRole('button', { name: /Cancel/i }))
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

test('pending check modal closes on overlay click', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('The Tavern'))

  await user.click(screen.getByRole('button', { name: 'Trigger Slash' }))
  await waitFor(() => screen.getByRole('dialog'))

  // Click the overlay (outside the modal card)
  await user.click(document.querySelector('.pending-check-modal-overlay')!)
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

test('confirming pending check calls the create check API', async () => {
  const user = userEvent.setup()
  let capturedBody: Record<string, unknown> | null = null
  server.use(
    http.post('http://localhost:8000/scenes/:id/checks', async ({ request, params }) => {
      capturedBody = (await request.json()) as Record<string, unknown>
      return HttpResponse.json(
        {
          id: 200,
          scene_id: Number(params.id),
          order_index: 0,
          rolls: [],
          ...capturedBody,
        },
        { status: 201 },
      )
    }),
  )

  renderPage()
  await waitFor(() => screen.getByText('The Tavern'))

  await user.click(screen.getByRole('button', { name: 'Trigger Slash' }))
  await waitFor(() => screen.getByRole('dialog'))

  await user.click(screen.getByRole('button', { name: /Add Check/i }))

  await waitFor(() => expect(capturedBody).not.toBeNull())
  expect(capturedBody).toMatchObject({
    check_type: 'skill',
    subtype: 'perception',
    dc: 10,
  })
  // Modal should close after success
  await waitFor(() => {
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })
})

test('pending check modal shows character filter options', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('The Tavern'))

  await user.click(screen.getByRole('button', { name: 'Trigger Slash' }))
  await waitFor(() => screen.getByRole('dialog'))

  const modal = screen.getByRole('dialog')
  expect(within(modal).getByText('All characters')).toBeInTheDocument()
})

test('unchecking All characters shows individual character checkboxes', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => screen.getByText('The Tavern'))

  await user.click(screen.getByRole('button', { name: 'Trigger Slash' }))
  await waitFor(() => screen.getByRole('dialog'))

  const modal = screen.getByRole('dialog')
  const allCharsCheckbox = within(modal).getByRole('checkbox', { name: /All characters/i })
  await user.click(allCharsCheckbox)

  // Now individual characters should appear
  await waitFor(() => {
    expect(within(modal).getByRole('checkbox', { name: /Aria/i })).toBeInTheDocument()
  })
})
