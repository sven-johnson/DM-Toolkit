import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { CampaignsPage } from '../pages/CampaignsPage'
import { server } from '../test/server'
import { BASE } from '../test/handlers'

vi.mock('react-router-dom', async (importOriginal) => {
  const actual = await importOriginal<typeof import('react-router-dom')>()
  return { ...actual, useNavigate: () => vi.fn() }
})

function mockCurrentUser(isAdmin: boolean) {
  server.use(
    http.get(`${BASE}/auth/me`, () =>
      HttpResponse.json({ id: 'u1', username: 'testuser', email: 'testuser@example.com', is_admin: isAdmin }),
    ),
  )
}

function mockCampaigns(myRole: 'owner' | 'game_master' | 'player' | null) {
  server.use(
    http.get(`${BASE}/campaigns`, () =>
      HttpResponse.json([
        { id: 'camp-1', name: 'Dragon Heist', created_at: '2024-01-01T00:00:00', my_role: myRole },
      ]),
    ),
    http.get(`${BASE}/campaigns/camp-1/members`, () => HttpResponse.json([])),
    http.get(`${BASE}/admin/users`, () => HttpResponse.json([])),
  )
}

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter>
        <CampaignsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  )
}

test('manage-members icon visible for an owner, opens modal with Invite a Player', async () => {
  mockCurrentUser(false)
  mockCampaigns('owner')
  const user = userEvent.setup()
  renderPage()

  const icon = await screen.findByTitle('Manage members')
  await user.click(icon)
  expect(await screen.findByText('Invite a Player')).toBeInTheDocument()
})

test('manage-members icon visible for a game master', async () => {
  mockCurrentUser(false)
  mockCampaigns('game_master')
  const user = userEvent.setup()
  renderPage()

  const icon = await screen.findByTitle('Manage members')
  await user.click(icon)
  expect(await screen.findByText('Invite a Player')).toBeInTheDocument()
  // Game masters can invite but can't see/edit the existing member list
  // (that stays owner/admin only at the API level).
  expect(screen.queryByText('No members yet.')).not.toBeInTheDocument()
})

test('manage-members icon visible for an admin', async () => {
  mockCurrentUser(true)
  mockCampaigns('player')
  const user = userEvent.setup()
  renderPage()

  const icon = await screen.findByTitle('Manage members')
  await user.click(icon)
  expect(await screen.findByText('Invite a Player')).toBeInTheDocument()
})

test('manage-members icon absent for a plain player', async () => {
  mockCurrentUser(false)
  mockCampaigns('player')
  renderPage()

  await screen.findByText('Dragon Heist')
  expect(screen.queryByTitle('Manage members')).not.toBeInTheDocument()
})

test('owner sees the existing member list section too', async () => {
  mockCurrentUser(false)
  mockCampaigns('owner')
  const user = userEvent.setup()
  renderPage()

  const icon = await screen.findByTitle('Manage members')
  await user.click(icon)
  await waitFor(() => expect(screen.getByText('No members yet.')).toBeInTheDocument())
})
