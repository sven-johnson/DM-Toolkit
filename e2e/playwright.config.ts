import { defineConfig, devices } from '@playwright/test'
import path from 'path'
import { BACKEND_ENV, BACKEND_PORT, BACKEND_URL, FRONTEND_PORT, FRONTEND_URL } from './env'

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: FRONTEND_URL,
  },
  webServer: [
    {
      // Seeding is chained here (not via globalSetup) so it's strictly
      // sequenced before the server starts accepting requests — /health
      // doesn't touch the DB, so a globalSetup running concurrently with
      // server startup could let a test slip in against a half-seeded DB.
      command: `python -m alembic upgrade head && python scripts/seed_e2e.py && python -m uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: path.resolve(__dirname, '../backend'),
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: false,
      env: BACKEND_ENV,
      timeout: 60_000,
    },
    {
      command: `npm run dev -- --port ${FRONTEND_PORT}`,
      cwd: path.resolve(__dirname, '../frontend'),
      url: FRONTEND_URL,
      reuseExistingServer: !process.env.CI,
      env: { VITE_API_URL: BACKEND_URL },
      timeout: 60_000,
    },
  ],
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
})
