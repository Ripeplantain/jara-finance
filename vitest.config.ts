import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Vite only exposes `VITE_`-prefixed variables, but the integration suites need
// the real DATABASE_URL in `process.env`. Absence is not an error: those suites
// skip themselves, so the unit suites still run on a machine with no database.
try {
  process.loadEnvFile('.env')
} catch {
  // No .env — integration tests will skip.
}

// Domain logic under shared/ and server/services/ is deliberately free of Nuxt
// runtime coupling, so it runs in plain Node — fast, and it proves the money and
// period maths don't secretly depend on framework context.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts', 'tests/integration/**/*.test.ts'],
    // Integration suites share one Postgres, so they run sequentially rather
    // than racing each other over the same tables.
    fileParallelism: false
  },
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url))
    }
  }
})
