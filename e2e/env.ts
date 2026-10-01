// Dedicated ports so the e2e backend/frontend never collide with a dev
// session already running on 8000/3000/5173.
export const BACKEND_PORT = 8001
export const FRONTEND_PORT = 3001
export const FRONTEND_URL = `http://localhost:${FRONTEND_PORT}`
export const BACKEND_URL = `http://localhost:${BACKEND_PORT}`

// Points at docker-compose's `db_test` service (see repo root docker-compose.yml) —
// a separate MySQL instance/port from dev so e2e runs never touch dev data.
// Start it with: docker compose up -d db_test
export const DATABASE_URL =
  'mysql+pymysql://dm_test_user:dm_test_password@localhost:3307/dm_toolkit_test'

export const BACKEND_ENV = {
  DATABASE_URL,
  SECRET_KEY: 'e2e-test-secret-key-minimum-32-characters-long!!',
  ACCESS_TOKEN_EXPIRE_MINUTES: '480',
  INITIAL_USERNAME: 'admin',
  INITIAL_PASSWORD: 'changeme',
  FRONTEND_URL,
}

export const SEED_PASSWORD = 'password123'
export const SEED_USERS = {
  admin: { username: 'e2e_admin', email: 'e2e_admin@example.com' },
  gm: { username: 'e2e_gm', email: 'e2e_gm@example.com' },
  nonmember: { username: 'e2e_nonmember', email: 'e2e_nonmember@example.com' },
  nonmember2: { username: 'e2e_nonmember2', email: 'e2e_nonmember2@example.com' },
}
export const SEED_CAMPAIGN_NAME = 'E2E Campaign'
