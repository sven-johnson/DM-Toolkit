import { http, HttpResponse } from 'msw'
import { getInvite, registerWithInvite } from '../api/invites'
import { server } from '../test/server'
import { BASE } from '../test/handlers'

test('getInvite calls GET /api/invites/:id and returns the body', async () => {
  let seenMethod = ''
  server.use(
    http.get(`${BASE}/api/invites/:id`, ({ request, params }) => {
      seenMethod = request.method
      expect(params.id).toBe('abc-123')
      return HttpResponse.json({ mode: 'register', email: 'x@example.com', campaign_name: null, campaign_id: null })
    }),
  )
  const result = await getInvite('abc-123')
  expect(seenMethod).toBe('GET')
  expect(result).toEqual({ mode: 'register', email: 'x@example.com', campaign_name: null, campaign_id: null })
})

test('getInvite propagates a 404 error for the caller to map', async () => {
  server.use(
    http.get(`${BASE}/api/invites/:id`, () => HttpResponse.json({ detail: 'invalid_invite' }, { status: 404 })),
  )
  await expect(getInvite('missing')).rejects.toMatchObject({ response: { status: 404 } })
})

test('registerWithInvite calls POST /api/invites/:id/register with the correct body', async () => {
  let seenMethod = ''
  let seenBody: unknown = null
  server.use(
    http.post(`${BASE}/api/invites/:id/register`, async ({ request, params }) => {
      seenMethod = request.method
      expect(params.id).toBe('abc-123')
      seenBody = await request.json()
      return HttpResponse.json({ access_token: 'tok', token_type: 'bearer' }, { status: 201 })
    }),
  )
  const result = await registerWithInvite('abc-123', {
    email: 'x@example.com',
    username: 'xuser',
    password: 'password123',
    confirm_password: 'password123',
  })
  expect(seenMethod).toBe('POST')
  expect(seenBody).toEqual({
    email: 'x@example.com',
    username: 'xuser',
    password: 'password123',
    confirm_password: 'password123',
  })
  expect(result).toEqual({ access_token: 'tok', token_type: 'bearer' })
})

test('registerWithInvite propagates a 409 error with the server detail for the caller to map', async () => {
  server.use(
    http.post(`${BASE}/api/invites/:id/register`, () =>
      HttpResponse.json({ detail: 'This email is already in use.' }, { status: 409 }),
    ),
  )
  await expect(
    registerWithInvite('abc-123', {
      email: 'x@example.com',
      username: 'xuser',
      password: 'password123',
      confirm_password: 'password123',
    }),
  ).rejects.toMatchObject({
    response: { status: 409, data: { detail: 'This email is already in use.' } },
  })
})
