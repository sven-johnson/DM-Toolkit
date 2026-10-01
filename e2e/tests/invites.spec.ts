import { test, expect, type Page } from '@playwright/test'
import { SEED_CAMPAIGN_NAME, SEED_PASSWORD, SEED_USERS } from '../env'

async function login(page: Page, username: string) {
  await page.goto('/login')
  await page.getByPlaceholder('Username').fill(username)
  await page.getByPlaceholder('Password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Log in' }).click()
  await expect(page).toHaveURL('/')
}

function uniqueEmail(label: string): string {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 10000)}@example.com`
}

// ---------------------------------------------------------------------------
// 1. Admin invites a new GM
// ---------------------------------------------------------------------------

test('admin invites a new GM, who registers and can create a campaign', async ({ browser }) => {
  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, SEED_USERS.admin.username)

  await adminPage.goto('/settings')
  const settingsSection = adminPage.locator('.settings-section', { hasText: 'Invite a Game Master' })
  const newGmEmail = uniqueEmail('new-gm')
  await settingsSection.getByPlaceholder('Email address').fill(newGmEmail)
  await settingsSection.getByRole('button', { name: 'Invite' }).click()
  const link = await settingsSection.getByTestId('invite-link').inputValue()
  await adminContext.close()

  const inviteeContext = await browser.newContext()
  const inviteePage = await inviteeContext.newPage()
  await inviteePage.goto(link)

  await expect(inviteePage.getByLabel('Email address')).toHaveValue(newGmEmail)
  await inviteePage.getByLabel('Username').fill(`newgm${Date.now()}`)
  await inviteePage.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
  await inviteePage.getByLabel('Confirm password').fill(SEED_PASSWORD)
  await inviteePage.getByRole('button', { name: 'Create account' }).click()

  await expect(inviteePage).toHaveURL('/')
  await expect(inviteePage.getByRole('heading', { name: 'Select Campaign' })).toBeVisible()

  await inviteePage.getByRole('button', { name: '+ New Campaign' }).click()
  await inviteePage.getByPlaceholder('Campaign name').fill(`New GM's Campaign ${Date.now()}`)
  await inviteePage.getByRole('button', { name: 'Create' }).click()
  await expect(inviteePage).toHaveURL('/sessions')
  await expect(inviteePage.getByRole('heading', { name: 'Sessions' })).toBeVisible()

  await inviteeContext.close()
})

// ---------------------------------------------------------------------------
// 2. GM invites a brand-new player
// ---------------------------------------------------------------------------

test('GM invites a brand-new player, who edits the pre-filled email and registers into the campaign', async ({ browser }) => {
  const gmContext = await browser.newContext()
  const gmPage = await gmContext.newPage()
  await login(gmPage, SEED_USERS.gm.username)

  const campaignCard = gmPage.locator('.campaign-card', { hasText: SEED_CAMPAIGN_NAME })
  await campaignCard.getByTitle('Manage members').click()
  const modal = gmPage.locator('.modal', { hasText: 'Invite a Player' })
  const prefilledEmail = uniqueEmail('player-prefilled')
  await modal.getByPlaceholder('Email address').fill(prefilledEmail)
  await modal.getByRole('button', { name: 'Invite' }).click()
  const link = await modal.getByTestId('invite-link').inputValue()
  await gmContext.close()

  const playerContext = await browser.newContext()
  const playerPage = await playerContext.newPage()
  await playerPage.goto(link)

  await expect(playerPage.getByText(SEED_CAMPAIGN_NAME)).toBeVisible()
  const emailInput = playerPage.getByLabel('Email address')
  await expect(emailInput).toHaveValue(prefilledEmail)
  const editedEmail = uniqueEmail('player-edited')
  await emailInput.fill('')
  await emailInput.fill(editedEmail)
  await playerPage.getByLabel('Username').fill(`player${Date.now()}`)
  await playerPage.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
  await playerPage.getByLabel('Confirm password').fill(SEED_PASSWORD)
  await playerPage.getByRole('button', { name: 'Create account' }).click()

  // A plain player can't access /sessions (RequireGameMaster) and bounces to /wiki.
  await expect(playerPage).toHaveURL('/wiki')
  await expect(playerPage.getByRole('heading', { name: 'Wiki' })).toBeVisible()

  // The Manage Members invite tool isn't visible to a plain player.
  await playerPage.goto('/')
  const card = playerPage.locator('.campaign-card', { hasText: SEED_CAMPAIGN_NAME })
  await expect(card.getByTitle('Manage members')).toHaveCount(0)

  await playerContext.close()
})

// ---------------------------------------------------------------------------
// 3. GM invites an existing user (join flow, logged out -> login -> accept)
// ---------------------------------------------------------------------------

test('GM invites an existing user, who logs in via the return URL and accepts', async ({ browser }) => {
  const gmContext = await browser.newContext()
  const gmPage = await gmContext.newPage()
  await login(gmPage, SEED_USERS.gm.username)

  const campaignCard = gmPage.locator('.campaign-card', { hasText: SEED_CAMPAIGN_NAME })
  await campaignCard.getByTitle('Manage members').click()
  const modal = gmPage.locator('.modal', { hasText: 'Invite a Player' })
  await modal.getByPlaceholder('Email address').fill(SEED_USERS.nonmember.email)
  await modal.getByRole('button', { name: 'Invite' }).click()
  const link = await modal.getByTestId('invite-link').inputValue()
  await gmContext.close()

  const userContext = await browser.newContext()
  const userPage = await userContext.newPage()
  await userPage.goto(link)

  // Logged out -> redirected to login with a return URL.
  await expect(userPage).toHaveURL(/\/login\?returnTo=/)
  await userPage.getByPlaceholder('Username').fill(SEED_USERS.nonmember.username)
  await userPage.getByPlaceholder('Password').fill(SEED_PASSWORD)
  await userPage.getByRole('button', { name: 'Log in' }).click()

  // Lands back on the invite page.
  await expect(userPage).toHaveURL(/\/invite\?id=/)
  await expect(userPage.getByText(SEED_CAMPAIGN_NAME)).toBeVisible()
  await userPage.getByRole('button', { name: 'Accept' }).click()
  await expect(userPage).toHaveURL('/wiki')

  await userContext.close()
})

// ---------------------------------------------------------------------------
// 4. Ignore
// ---------------------------------------------------------------------------

test('an existing user can ignore a join invite and is not added as a member', async ({ browser }) => {
  const gmContext = await browser.newContext()
  const gmPage = await gmContext.newPage()
  await login(gmPage, SEED_USERS.gm.username)

  const campaignCard = gmPage.locator('.campaign-card', { hasText: SEED_CAMPAIGN_NAME })
  await campaignCard.getByTitle('Manage members').click()
  const modal = gmPage.locator('.modal', { hasText: 'Invite a Player' })
  await modal.getByPlaceholder('Email address').fill(SEED_USERS.nonmember2.email)
  await modal.getByRole('button', { name: 'Invite' }).click()
  const link = await modal.getByTestId('invite-link').inputValue()
  await gmContext.close()

  const userContext = await browser.newContext()
  const userPage = await userContext.newPage()
  await login(userPage, SEED_USERS.nonmember2.username)
  await userPage.goto(link)

  await expect(userPage.getByText(SEED_CAMPAIGN_NAME)).toBeVisible()
  await userPage.getByRole('button', { name: 'Ignore' }).click()
  await expect(userPage).toHaveURL('/')

  // Not a member: the campaign never appears in their list.
  await expect(userPage.getByText(SEED_CAMPAIGN_NAME)).toHaveCount(0)

  await userContext.close()
})

// ---------------------------------------------------------------------------
// 5. Reuse blocked
// ---------------------------------------------------------------------------

test('a used invite link shows the closed-beta message on reuse', async ({ browser }) => {
  const adminContext = await browser.newContext()
  const adminPage = await adminContext.newPage()
  await login(adminPage, SEED_USERS.admin.username)
  await adminPage.goto('/settings')
  const settingsSection = adminPage.locator('.settings-section', { hasText: 'Invite a Game Master' })
  await settingsSection.getByPlaceholder('Email address').fill(uniqueEmail('reuse'))
  await settingsSection.getByRole('button', { name: 'Invite' }).click()
  const link = await settingsSection.getByTestId('invite-link').inputValue()
  await adminContext.close()

  const context = await browser.newContext()
  const page = await context.newPage()
  await page.goto(link)
  await page.getByLabel('Username').fill(`reuseuser${Date.now()}`)
  await page.getByLabel('Password', { exact: true }).fill(SEED_PASSWORD)
  await page.getByLabel('Confirm password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page).toHaveURL('/')
  await context.close()

  const reuseContext = await browser.newContext()
  const reusePage = await reuseContext.newPage()
  await reusePage.goto(link)
  await expect(reusePage.getByText(/closed beta/i)).toBeVisible()
  await reuseContext.close()
})

// ---------------------------------------------------------------------------
// 6. No / garbage id
// ---------------------------------------------------------------------------

test('missing or garbage invite id shows the closed-beta message', async ({ page }) => {
  await page.goto('/invite', { waitUntil: 'commit' })
  await expect(page.getByText(/closed beta/i)).toBeVisible()

  await page.goto('/invite?id=nope', { waitUntil: 'commit' })
  await expect(page.getByText(/closed beta/i)).toBeVisible()
})

// ---------------------------------------------------------------------------
// 7. Open signup gone
// ---------------------------------------------------------------------------

test('no open signup route is reachable', async ({ page }) => {
  await page.goto('/register', { waitUntil: 'commit' })
  await expect(page).toHaveURL('/login')

  await page.goto('/signup', { waitUntil: 'commit' })
  await expect(page).toHaveURL('/login')
})

// ---------------------------------------------------------------------------
// 8. Change email
// ---------------------------------------------------------------------------

test('changing email in Settings persists across a reload', async ({ page }) => {
  await login(page, SEED_USERS.admin.username)
  await page.goto('/settings')

  const emailRow = page.locator('.settings-row', { hasText: 'Email' })
  await emailRow.getByRole('button').click()

  const newEmail = uniqueEmail('changed-admin')
  await page.getByLabel('New email').fill(newEmail)
  await page.getByLabel('Current password').fill(SEED_PASSWORD)
  await page.getByRole('button', { name: 'Save', exact: true }).click()
  await expect(emailRow.getByText(newEmail)).toBeVisible()

  await page.reload()
  await expect(page.locator('.settings-row', { hasText: 'Email' }).getByText(newEmail)).toBeVisible()
})
