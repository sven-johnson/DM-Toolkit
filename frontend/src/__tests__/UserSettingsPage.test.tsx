import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { UserSettingsPage } from '../pages/UserSettingsPage'
import { ThemeProvider } from '../context/ThemeContext'
import { server } from '../test/server'
import { BASE } from '../test/handlers'

function renderPage() {
  return render(
    <ThemeProvider>
      <UserSettingsPage />
    </ThemeProvider>,
  )
}

beforeEach(() => {
  localStorage.clear()
})

// ---------------------------------------------------------------------------
// Account section display
// ---------------------------------------------------------------------------

test('shows current username and email once loaded', async () => {
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument())
  expect(screen.getByText('testuser@example.com')).toBeInTheDocument()
})

test('shows placeholder email as "Not set" with an "Add email" prompt', async () => {
  server.use(
    http.get(`${BASE}/auth/me`, () =>
      HttpResponse.json({ id: 'u1', username: 'testuser', email: 'testuser@placeholder.invalid', is_admin: true }),
    ),
  )
  renderPage()
  await waitFor(() => expect(screen.getByText('Not set')).toBeInTheDocument())
  expect(screen.getByRole('button', { name: 'Add email' })).toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Invite a Game Master section (admin only)
// ---------------------------------------------------------------------------

test('shows "Invite a Game Master" section for an admin', async () => {
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument())
  expect(screen.getByText('Invite a Game Master')).toBeInTheDocument()
})

test('hides "Invite a Game Master" section for a non-admin', async () => {
  server.use(
    http.get(`${BASE}/auth/me`, () =>
      HttpResponse.json({ id: 'u1', username: 'testuser', email: 'testuser@example.com', is_admin: false }),
    ),
  )
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument())
  expect(screen.queryByText('Invite a Game Master')).not.toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Username change (mirrors the email flow below)
// ---------------------------------------------------------------------------

test('username: edit button opens modal, successful save updates displayed value', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[0])
  expect(screen.getByText('Change Username')).toBeInTheDocument()

  const usernameInput = screen.getByLabelText('New username')
  await user.clear(usernameInput)
  await user.type(usernameInput, 'renamed')
  await user.type(screen.getByLabelText('Current password'), 'testpass')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(screen.queryByText('Change Username')).not.toBeInTheDocument())
  expect(screen.getByText('renamed')).toBeInTheDocument()
})

test('username: wrong password shows server error and keeps modal open', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[0])
  await user.type(screen.getByLabelText('New username'), 'x')
  await user.type(screen.getByLabelText('Current password'), 'wrong')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(screen.getByText('Current password is incorrect')).toBeInTheDocument())
  expect(screen.getByText('Change Username')).toBeInTheDocument()
})

test('username: cancel closes the modal without saving', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[0])
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText('Change Username')).not.toBeInTheDocument()
})

// ---------------------------------------------------------------------------
// Email change
// ---------------------------------------------------------------------------

test('email: edit button opens modal, successful save updates displayed value', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  expect(screen.getByText('Change Email')).toBeInTheDocument()

  const emailInput = screen.getByLabelText('New email')
  await user.clear(emailInput)
  await user.type(emailInput, 'new@example.com')
  await user.type(screen.getByLabelText('Current password'), 'testpass')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(screen.queryByText('Change Email')).not.toBeInTheDocument())
  expect(screen.getByText('new@example.com')).toBeInTheDocument()
})

test('email: "Add email" starts from an empty field when current email is a placeholder', async () => {
  server.use(
    http.get(`${BASE}/auth/me`, () =>
      HttpResponse.json({ id: 'u1', username: 'testuser', email: 'testuser@placeholder.invalid', is_admin: true }),
    ),
  )
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('Not set')).toBeInTheDocument())

  await user.click(screen.getByRole('button', { name: 'Add email' }))
  expect(screen.getByLabelText('New email')).toHaveValue('')
})

test('email: invalid format is blocked client-side', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  const emailInput = screen.getByLabelText('New email')
  await user.clear(emailInput)
  await user.type(emailInput, 'not-an-email')
  await user.type(screen.getByLabelText('Current password'), 'testpass')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Please enter a valid email address.')).toBeInTheDocument()
  // The modal never submitted — still open.
  expect(screen.getByText('Change Email')).toBeInTheDocument()
})

test('email: empty value is blocked client-side', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  await user.clear(screen.getByLabelText('New email'))
  await user.type(screen.getByLabelText('Current password'), 'testpass')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Email cannot be empty.')).toBeInTheDocument()
})

test('email: missing current password is blocked client-side', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  const emailInput = screen.getByLabelText('New email')
  await user.clear(emailInput)
  await user.type(emailInput, 'new@example.com')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  expect(await screen.findByText('Please enter your current password.')).toBeInTheDocument()
})

test('email: 409 conflict from the server is shown inline and modal stays open', async () => {
  server.use(
    http.put(`${BASE}/auth/email`, () =>
      HttpResponse.json({ detail: 'This email is already in use.' }, { status: 409 }),
    ),
  )
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  const emailInput = screen.getByLabelText('New email')
  await user.clear(emailInput)
  await user.type(emailInput, 'taken@example.com')
  await user.type(screen.getByLabelText('Current password'), 'testpass')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(screen.getByText('This email is already in use.')).toBeInTheDocument())
  expect(screen.getByText('Change Email')).toBeInTheDocument()
})

test('email: wrong current password shows server error', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  const emailInput = screen.getByLabelText('New email')
  await user.clear(emailInput)
  await user.type(emailInput, 'new@example.com')
  await user.type(screen.getByLabelText('Current password'), 'wrong')
  await user.click(screen.getByRole('button', { name: 'Save' }))

  await waitFor(() => expect(screen.getByText('Current password is incorrect')).toBeInTheDocument())
})

test('email: pressing Escape closes the modal', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  expect(screen.getByText('Change Email')).toBeInTheDocument()
  await user.keyboard('{Escape}')
  expect(screen.queryByText('Change Email')).not.toBeInTheDocument()
})

test('email: cancel closes the modal without saving', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  await user.click(screen.getByRole('button', { name: 'Cancel' }))
  expect(screen.queryByText('Change Email')).not.toBeInTheDocument()
  expect(screen.getByText('testuser@example.com')).toBeInTheDocument()
})

test('email: submitting Enter in the password field saves', async () => {
  const user = userEvent.setup()
  renderPage()
  await waitFor(() => expect(screen.getByText('testuser@example.com')).toBeInTheDocument())

  await user.click(screen.getAllByRole('button', { name: 'Edit' })[1])
  const emailInput = screen.getByLabelText('New email')
  await user.clear(emailInput)
  await user.type(emailInput, 'new@example.com')
  await user.type(screen.getByLabelText('Current password'), 'testpass{Enter}')

  await waitFor(() => expect(screen.queryByText('Change Email')).not.toBeInTheDocument())
  expect(screen.getByText('new@example.com')).toBeInTheDocument()
})
