import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { vi } from 'vitest'
import { EncounterCompositionBuilder } from '../components/MonsterFactory/EncounterCompositionBuilder'
import type { EncounterComposition, PartyProfile } from '../types/monsterFactory'
import { server } from '../test/server'
import { BASE } from '../test/handlers'

// ── Helpers ───────────────────────────────────────────────────────────────────

function makeQC() {
  return new QueryClient({ defaultOptions: { queries: { retry: false } } })
}

const STANDARD_PROFILE: PartyProfile = {
  party_size: 4, avg_level: 5, avg_hp: 34.5, total_hp: 138, lowest_hp: 32,
  avg_ac: 15, party_nova: 106.5, party_sustained: 48,
  proficiency_bonus: 3, estimated_bonus_actions_per_round: 2.0, avg_attack_bonus: 5,
}

function renderBuilder(onChange = vi.fn<(composition: EncounterComposition) => void>()) {
  const qc = makeQC()
  render(
    <QueryClientProvider client={qc}>
      <EncounterCompositionBuilder
        partyProfile={STANDARD_PROFILE}
        onCompositionChange={onChange}
        gmProfileId="profile-1"
      />
    </QueryClientProvider>,
  )
  return { onChange }
}

// ── Fixture data ──────────────────────────────────────────────────────────────

const ROLE_BOSS = {
  id: 'role-boss', name: 'Boss', description: null,
  action_weight: 2.0, hp_share_tier: 'very_high', ac_profile: 'high',
  damage_profile: 'high', is_boss_eligible: true, is_minion: false,
  default_attack_count: 2, preferred_conditions: null,
  created_at: '2024-01-01T00:00:00', updated_at: '2024-01-01T00:00:00',
}

const ROLE_MINION = {
  id: 'role-minion', name: 'Minion', description: null,
  action_weight: 0.5, hp_share_tier: 'very_low', ac_profile: 'low',
  damage_profile: 'very_low', is_boss_eligible: false, is_minion: true,
  default_attack_count: 1, preferred_conditions: null,
  created_at: '2024-01-01T00:00:00', updated_at: '2024-01-01T00:00:00',
}

const ARCHETYPE_DRAGON = {
  id: 'arch-dragon', name: 'Dragon', description: null,
  typical_traits: null, damage_immunities: ['fire'],
  damage_resistances: null, condition_immunities: null,
  created_at: '2024-01-01T00:00:00', updated_at: '2024-01-01T00:00:00',
}

const TEMPLATE_BOSS_FIGHT = {
  id: 'tmpl-1', name: 'Boss Fight', description: 'One boss and minions',
  is_custom: false, slots: null,
  created_at: '2024-01-01T00:00:00', updated_at: '2024-01-01T00:00:00',
}

const TEMPLATE_BOSS_FIGHT_DETAIL = {
  ...TEMPLATE_BOSS_FIGHT,
  slots: [
    {
      id: 'slot-1', encounter_template_id: 'tmpl-1',
      combat_role_archetype_id: 'role-boss',
      combat_role: ROLE_BOSS,
      default_count: 1, is_required: true, sort_order: 0,
    },
    {
      id: 'slot-2', encounter_template_id: 'tmpl-1',
      combat_role_archetype_id: 'role-minion',
      combat_role: ROLE_MINION,
      default_count: 3, is_required: false, sort_order: 1,
    },
  ],
}

const MOCK_ENCOUNTER = {
  encounter_name: 'Test', difficulty: 'hard',
  party_profile: STANDARD_PROFILE,
  difficulty_targets: { difficulty: 'hard', target_rounds: 5, target_rounds_min: 4, target_rounds_max: 6,
    threat_turns: 2.25, action_economy_multiplier: 1.2, monster_hit_rate: 0.65, player_hit_rate: 0.5,
    monster_action_budget: 10, target_damage_per_turn_per_monster: 5, target_total_monster_hp: 200, save_dc: 14 },
  monsters: [],
  total_monster_count: 1, total_monster_hp: 150, total_monster_actions_per_round: 2.0,
  expected_rounds: 5, expected_rounds_min: 4, expected_rounds_max: 6,
  all_warnings: ['Action economy is slightly high'],
  math_detail: {},
}

// ── Base API handlers ─────────────────────────────────────────────────────────

function useBaseHandlers() {
  server.use(
    http.get(`${BASE}/monster-factory/encounter-templates`, () =>
      HttpResponse.json([TEMPLATE_BOSS_FIGHT]),
    ),
    http.get(`${BASE}/monster-factory/creature-archetypes`, () =>
      HttpResponse.json([ARCHETYPE_DRAGON]),
    ),
    http.get(`${BASE}/monster-factory/combat-roles`, () =>
      HttpResponse.json([ROLE_BOSS, ROLE_MINION]),
    ),
  )
}

// ── Test 1: Renders all 5 difficulty buttons with descriptors ─────────────────

test('renders all 5 difficulty buttons with descriptors', async () => {
  useBaseHandlers()
  renderBuilder()

  const expected = [
    { name: 'Trivial', desc: '1–2 rounds, no resources' },
    { name: 'Easy',    desc: '2–3 rounds, minor resources' },
    { name: 'Medium',  desc: '3–4 rounds, moderate resources' },
    { name: 'Hard',    desc: '4–5 rounds, significant resources' },
    { name: 'Deadly',  desc: '5–6 rounds, full nova required' },
  ]

  for (const { name, desc } of expected) {
    expect(await screen.findByRole('button', { name: new RegExp(name, 'i') })).toBeInTheDocument()
    expect(screen.getByText(desc)).toBeInTheDocument()
  }
})

// ── Test 2: Selecting a template loads its slots ──────────────────────────────

test('selecting a template card loads its slots', async () => {
  useBaseHandlers()
  server.use(
    http.get(`${BASE}/monster-factory/encounter-templates/tmpl-1`, () =>
      HttpResponse.json(TEMPLATE_BOSS_FIGHT_DETAIL),
    ),
  )

  const user = userEvent.setup()
  renderBuilder()

  // Wait for template card to appear
  const card = await screen.findByRole('button', { name: /Boss Fight/i })
  await user.click(card)

  // Should now have 2 slot rows (from template)
  await waitFor(() => {
    expect(screen.getAllByTestId('slot-row')).toHaveLength(2)
  })
})

// ── Test 3: Add slot / remove slot, is_required disables remove button ────────

test('Add Slot increases row count; Remove is disabled for required slots', async () => {
  useBaseHandlers()
  server.use(
    http.get(`${BASE}/monster-factory/encounter-templates/tmpl-1`, () =>
      HttpResponse.json(TEMPLATE_BOSS_FIGHT_DETAIL),
    ),
  )

  const user = userEvent.setup()
  renderBuilder()

  // Load template (2 slots: 1 required + 1 optional)
  const card = await screen.findByRole('button', { name: /Boss Fight/i })
  await user.click(card)
  await waitFor(() => expect(screen.getAllByTestId('slot-row')).toHaveLength(2))

  // Add a slot → 3 rows
  await user.click(screen.getByRole('button', { name: /Add Slot/i }))
  expect(screen.getAllByTestId('slot-row')).toHaveLength(3)

  // Remove the 3rd slot → 2 rows
  const removeButtons = screen.getAllByRole('button', { name: /Remove slot/i })
  await user.click(removeButtons[2])
  expect(screen.getAllByTestId('slot-row')).toHaveLength(2)

  // First slot (is_required=true) remove button should be disabled
  const firstRemove = screen.getAllByRole('button', { name: /Remove slot 1/i })[0]
  expect(firstRemove).toBeDisabled()

  // Second slot (is_required=false) remove button should be enabled
  const secondRemove = screen.getAllByRole('button', { name: /Remove slot 2/i })[0]
  expect(secondRemove).not.toBeDisabled()
})

// ── Test 4: onCompositionChange fires on difficulty change ────────────────────

test('onCompositionChange is called when difficulty changes', async () => {
  useBaseHandlers()

  const user = userEvent.setup()
  const { onChange } = renderBuilder()

  const hardBtn = await screen.findByTestId('difficulty-hard')
  await user.click(hardBtn)

  await waitFor(() => {
    const lastCall = onChange.mock.calls.at(-1)?.[0]
    expect(lastCall?.difficulty).toBe('hard')
  })
})

// ── Test 5: Preview panel shows loading then results ─────────────────────────

test('preview panel shows loading state then expected rounds after generate call', async () => {
  useBaseHandlers()
  server.use(
    http.get(`${BASE}/monster-factory/encounter-templates/tmpl-1`, () =>
      HttpResponse.json(TEMPLATE_BOSS_FIGHT_DETAIL),
    ),
    http.post(`${BASE}/monster-factory/generate`, () =>
      HttpResponse.json(MOCK_ENCOUNTER),
    ),
  )

  const user = userEvent.setup()
  renderBuilder()

  // Load template
  const card = await screen.findByRole('button', { name: /Boss Fight/i })
  await user.click(card)
  await waitFor(() => expect(screen.getAllByTestId('slot-row')).toHaveLength(2))

  // Fill in the creature archetype on slot 1
  const archetypeSelects = screen.getAllByRole('combobox', { name: /creature archetype/i })
  await user.selectOptions(archetypeSelects[0], 'arch-dragon')

  // Select difficulty
  await user.click(screen.getByTestId('difficulty-hard'))

  // Preview should eventually show expected rounds
  await waitFor(() => {
    expect(screen.getByTestId('preview-rounds')).toBeInTheDocument()
  }, { timeout: 2000 })

  expect(screen.getByTestId('preview-rounds').textContent).toContain('4.0–6.0')
})

// ── Test 6: Preview NOT called when inputs are incomplete ─────────────────────

test('generate endpoint is not called when no slots are fully specified', async () => {
  useBaseHandlers()

  const generateCalled = vi.fn()
  server.use(
    http.post(`${BASE}/monster-factory/generate`, () => {
      generateCalled()
      return HttpResponse.json(MOCK_ENCOUNTER)
    }),
  )

  const user = userEvent.setup()
  renderBuilder()

  // Select difficulty but don't fill slots
  const hardBtn = await screen.findByTestId('difficulty-hard')
  await user.click(hardBtn)

  // Wait longer than the debounce to confirm no call happened
  await new Promise((r) => setTimeout(r, 600))
  expect(generateCalled).not.toHaveBeenCalled()
})
