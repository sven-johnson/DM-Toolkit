import { defineConfig, devices } from '@playwright/test'
import path from 'path'

// Dedicated ports so the e2e backend/frontend never collide with a dev
// session already running on 8000/3000/5173.
const BACKEND_PORT = 8001
const FRONTEND_PORT = 3001
const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`
const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

// Points at docker-compose's `db_test` service (see repo root docker-compose.yml) —
// a separate MySQL instance/port from dev so e2e runs never touch dev data.
// Start it with: docker compose up -d db_test
const BACKEND_ENV = {
  DATABASE_URL: 'mysql+pymysql://dm_test_user:dm_test_password@localhost:3307/dm_toolkit_test',
  SECRET_KEY: 'e2e-test-secret-key-minimum-32-characters-long!!',
  ACCESS_TOKEN_EXPIRE_MINUTES: '480',
  INITIAL_USERNAME: 'admin',
  INITIAL_PASSWORD: 'changeme',
  FRONTEND_URL,
}

export default defineConfig({
  testDir: './tests',
  fullyParallel: false,
  retries: 0,
  use: {
    baseURL: FRONTEND_URL,
  },
  webServer: [
    {
      command: `python -m alembic upgrade head && python -m uvicorn app.main:app --host 127.0.0.1 --port ${BACKEND_PORT}`,
      cwd: path.resolve(__dirname, '../backend'),
      url: `${BACKEND_URL}/health`,
      reuseExistingServer: !process.env.CI,
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
