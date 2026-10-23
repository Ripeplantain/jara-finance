import { defineConfig, devices } from '@playwright/test'

/**
 * End-to-end tests.
 *
 * Deliberately narrow in scope: the domain logic is covered by Vitest against
 * real SQL, so these exist to prove the parts only a browser can exercise —
 * that the auth gate actually redirects, that a transaction recorded through
 * the form appears in the list, and that the pages render without a client-side
 * error.
 *
 * `webServer` reuses an already-running dev server locally and starts one in
 * CI, so `pnpm test:e2e` works either way.
 */
const PORT = 3100
const baseURL = `http://localhost:${PORT}`

export default defineConfig({
  testDir: './tests/e2e',
  // Each spec signs up its own user, so they are independent — but they share
  // one Postgres, so a single worker keeps the output readable on failure.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  timeout: 30_000,
  expect: { timeout: 10_000 },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure'
  },

  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],

  webServer: {
    command: 'pnpm dev',
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    // A cold Nuxt dev start plus the first SSR compile is not fast.
    timeout: 180_000
  }
})
