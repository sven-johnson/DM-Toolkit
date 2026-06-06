import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { vi } from 'vitest'
import { PartyProfileInput } from '../components/MonsterFactory/PartyProfileInput'
import type { PartyProfile } from '../types/monsterFactory'

// campaignId is not provided in tests so usePartySummary won't fire;
// QueryClientProvider is required because the hook is always called.

function renderComponent(onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        <PartyProfileInput onPartyProfileChange={onChange} />
      </MemoryRouter>
    </QueryClientProvider>,
  )
  return onChange
}

/** Fill all 4 default member rows and the level field with the standard test party. */
async function fillStandardParty(user: ReturnType<typeof userEvent.setup>) {
  // Level
  await user.clear(screen.getByLabelText('Party Level'))
  await user.type(screen.getByLabelText('Party Level'), '5')

  const hps      = [38, 35, 33, 32]
  const acs      = [16, 16, 15, 13]
  const novas    = [33, 28, 25, 20.5]
  const sustains = [14, 12, 11, 11]

  for (let i = 0; i < 4; i++) {
    await user.clear(screen.getByLabelText(`Member ${i + 1} max HP`))
    await user.type(screen.getByLabelText(`Member ${i + 1} max HP`), String(hps[i]))

    await user.clear(screen.getByLabelText(`Member ${i + 1} AC`))
    await user.type(screen.getByLabelText(`Member ${i + 1} AC`), String(acs[i]))

    await user.clear(screen.getByLabelText(`Member ${i + 1} nova damage`))
    await user.type(screen.getByLabelText(`Member ${i + 1} nova damage`), String(novas[i]))

    await user.clear(screen.getByLabelText(`Member ${i + 1} sustained damage per round`))
    await user.type(screen.getByLabelText(`Member ${i + 1} sustained damage per round`), String(sustains[i]))
  }
}

// ── Test 1: Derived stats for 4-player level-5 party ─────────────────────────

test('derived stats calculate correctly for 4-player level-5 party', async () => {
  const onChange = vi.fn()
  const user = userEvent.setup()
  renderComponent(onChange)

  await fillStandardParty(user)

  await waitFor(() => {
    const lastCall = onChange.mock.calls.at(-1)?.[0] as PartyProfile | undefined
    expect(lastCall).toBeDefined()

    // Party size
    expect(lastCall!.party_size).toBe(4)
    // Level
    expect(lastCall!.avg_level).toBe(5)
    // Proficiency bonus: level 5 → +3
    expect(lastCall!.proficiency_bonus).toBe(3)
    // Total HP: 38+35+33+32 = 138
    expect(lastCall!.total_hp).toBe(138)
    // Avg HP: 138/4 = 34.5
    expect(lastCall!.avg_hp).toBeCloseTo(34.5)
    // Lowest HP: 32
    expect(lastCall!.lowest_hp).toBe(32)
    // Avg AC: (16+16+15+13)/4 = 15
    expect(lastCall!.avg_ac).toBeCloseTo(15.0)
    // Avg attack bonus: floor(5/2) + 3 = 2 + 3 = 5
    expect(lastCall!.avg_attack_bonus).toBe(5)
    // Party nova: 33+28+25+20.5 = 106.5
    expect(lastCall!.party_nova).toBeCloseTo(106.5)
    // Party sustained: 14+12+11+11 = 48
    expect(lastCall!.party_sustained).toBeCloseTo(48)
    // Estimated bonus actions: 4 * 0.5 = 2.0
    expect(lastCall!.estimated_bonus_actions_per_round).toBeCloseTo(2.0)
  })
})

// ── Test 2: Add Member increases row count ────────────────────────────────────

test('Add Member button increases member count from 4 to 5', async () => {
  const user = userEvent.setup()
  renderComponent()

  // 4 rows initially
  expect(screen.getAllByRole('button', { name: /remove member/i })).toHaveLength(4)

  await user.click(screen.getByRole('button', { name: /add member/i }))

  expect(screen.getAllByRole('button', { name: /remove member/i })).toHaveLength(5)
})

// ── Test 3: Remove button disabled at 1 member ────────────────────────────────

test('Remove button is disabled when only 1 member remains', async () => {
  const user = userEvent.setup()
  renderComponent()

  const removeBtns = screen.getAllByRole('button', { name: /remove member/i })

  // Remove 3 members to get down to 1
  await user.click(removeBtns[3])
  await user.click(screen.getAllByRole('button', { name: /remove member/i })[2])
  await user.click(screen.getAllByRole('button', { name: /remove member/i })[1])

  const lastRemoveBtn = screen.getByRole('button', { name: /remove member 1/i })
  expect(lastRemoveBtn).toBeDisabled()
})

// ── Test 4: onPartyProfileChange NOT called when fields are empty ─────────────

test('onPartyProfileChange is not called when required fields are empty', async () => {
  const onChange = vi.fn()
  renderComponent(onChange)

  // Default render has empty fields — callback should not have been called
  // (wait a tick for any potential async effects)
  await waitFor(() => {
    expect(onChange).not.toHaveBeenCalled()
  })
})

// ── Test 5: Lowest HP amber highlight ─────────────────────────────────────────

test('lowest HP value gets amber highlight class when more than 20% below average', async () => {
  const user = userEvent.setup()
  renderComponent()

  await user.clear(screen.getByLabelText('Party Level'))
  await user.type(screen.getByLabelText('Party Level'), '5')

  // Members: HP [100, 100, 100, 10] — 10 is well below 80% of avg (77.5)
  const hps      = [100, 100, 100, 10]
  const acs      = [15, 15, 15, 15]
  const novas    = [20, 20, 20, 20]
  const sustains = [10, 10, 10, 10]

  for (let i = 0; i < 4; i++) {
    await user.clear(screen.getByLabelText(`Member ${i + 1} max HP`))
    await user.type(screen.getByLabelText(`Member ${i + 1} max HP`), String(hps[i]))
    await user.clear(screen.getByLabelText(`Member ${i + 1} AC`))
    await user.type(screen.getByLabelText(`Member ${i + 1} AC`), String(acs[i]))
    await user.clear(screen.getByLabelText(`Member ${i + 1} nova damage`))
    await user.type(screen.getByLabelText(`Member ${i + 1} nova damage`), String(novas[i]))
    await user.clear(screen.getByLabelText(`Member ${i + 1} sustained damage per round`))
    await user.type(screen.getByLabelText(`Member ${i + 1} sustained damage per round`), String(sustains[i]))
  }

  await waitFor(() => {
    const lowestHpEl = screen.getByTestId('lowest-hp')
    // avg = (100+100+100+10)/4 = 77.5, threshold = 77.5*0.8 = 62
    // lowest = 10, which is < 62 → should have amber class
    expect(lowestHpEl).toHaveClass('ppi-stat-value--amber')
  })
})
