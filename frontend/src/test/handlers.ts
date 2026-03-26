import { http, HttpResponse } from 'msw'

const BASE = 'http://localhost:8000'

// ---------------------------------------------------------------------------
// Shared fixture data
// ---------------------------------------------------------------------------

export const fixtureCharacter = {
  id: 1,
  name: 'Aria',
  char_class: 'Wizard',
  subclass: 'Evocation',
  level: 5,
  str_score: 8,  dex_score: 14, con_score: 12, int_score: 18, wis_score: 10, cha_score: 10,
  str_mod: -1,   dex_mod: 2,   con_mod: 1,   int_mod: 4,   wis_mod: 0,   cha_mod: 0,
  acrobatics: 2, animal_handling: 0, arcana: 7, athletics: -1, deception: 0,
  history: 4, insight: 0, intimidation: 0, investigation: 7, medicine: 0,
  nature: 4, perception: 3, performance: 0, persuasion: 0, religion: 7,
  sleight_of_hand: 2, stealth: 2, survival: 0,
  str_save: -1, dex_save: 2, con_save: 4, int_save: 7, wis_save: 3, cha_save: 0,
  ac: 15, max_hp: 35,
}

export const fixtureCheck = {
  id: 100,
  scene_id: 10,
  check_type: 'skill',
  subtype: 'perception',
  dc: 14,
  character_ids: [],
  order_index: 0,
  rolls: [],
}

export const fixtureScene = {
  id: 10,
  session_id: 1,
  title: 'The Tavern',
  body: '# Opening scene',
  order_index: 0,
  created_at: '2024-01-01T00:00:00',
  updated_at: '2024-01-01T00:00:00',
  checks: [],
}

export const fixtureSession = {
  id: 1,
  title: 'Session One',
  date: '2024-01-15',
  created_at: '2024-01-15T20:00:00',
  scenes: [fixtureScene],
}

// ---------------------------------------------------------------------------
// Handlers
// ---------------------------------------------------------------------------

export const handlers = [
  // Auth
  http.post(`${BASE}/auth/login`, async ({ request }) => {
    const body = (await request.json()) as { username: string; password: string }
    if (body.username === 'admin' && body.password === 'changeme') {
      return HttpResponse.json({ access_token: 'fake-jwt-token', token_type: 'bearer' })
    }
    return HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 })
  }),

  // Sessions list
  http.get(`${BASE}/sessions`, () => {
    return HttpResponse.json([fixtureSession])
  }),

  // Session detail
  http.get(`${BASE}/sessions/:id`, ({ params }) => {
    if (params.id === '1') return HttpResponse.json(fixtureSession)
    return HttpResponse.json({ detail: 'Not found' }, { status: 404 })
  }),

  // Create scene
  http.post(`${BASE}/sessions/:id/scenes`, async ({ request, params }) => {
    const body = (await request.json()) as { title: string; body?: string }
    return HttpResponse.json(
      {
        id: 99,
        session_id: Number(params.id),
        title: body.title,
        body: body.body ?? '',
        order_index: 1,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        checks: [],
      },
      { status: 201 },
    )
  }),

  // Reorder scenes
  http.put(`${BASE}/sessions/:id/scenes/reorder`, () => new HttpResponse(null, { status: 204 })),

  // Session rolls
  http.get(`${BASE}/sessions/:id/rolls`, () => HttpResponse.json([])),

  // Characters
  http.get(`${BASE}/characters`, () => HttpResponse.json([fixtureCharacter])),
  http.post(`${BASE}/characters`, async ({ request }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ id: 2, ...body }, { status: 201 })
  }),
  http.put(`${BASE}/characters/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...fixtureCharacter, id: Number(params.id), ...body })
  }),
  http.delete(`${BASE}/characters/:id`, () => new HttpResponse(null, { status: 204 })),

  // Scenes
  http.put(`${BASE}/scenes/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...fixtureScene, id: Number(params.id), ...body })
  }),
  http.delete(`${BASE}/scenes/:id`, () => new HttpResponse(null, { status: 204 })),

  // Checks
  http.post(`${BASE}/scenes/:id/checks`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json(
      { id: 200, scene_id: Number(params.id), order_index: 0, rolls: [], ...body },
      { status: 201 },
    )
  }),
  http.put(`${BASE}/checks/:id`, async ({ request, params }) => {
    const body = (await request.json()) as Record<string, unknown>
    return HttpResponse.json({ ...fixtureCheck, id: Number(params.id), ...body })
  }),
  http.delete(`${BASE}/checks/:id`, () => new HttpResponse(null, { status: 204 })),

  // Rolls
  http.put(`${BASE}/rolls/:checkId/:charId`, async ({ request, params }) => {
    const body = (await request.json()) as { die_result: number }
    return HttpResponse.json({
      id: 300,
      check_id: Number(params.checkId),
      character_id: Number(params.charId),
      die_result: body.die_result,
    })
  }),
  http.delete(`${BASE}/rolls/:checkId/:charId`, () => new HttpResponse(null, { status: 204 })),

  // Roll history
  http.get(`${BASE}/rolls/history`, () => HttpResponse.json([])),
]
