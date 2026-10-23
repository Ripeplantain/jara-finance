import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// Domain logic under shared/ and server/services/ is deliberately free of Nuxt
// runtime coupling, so it runs in plain Node — fast, and it proves the money and
// period maths don't secretly depend on framework context.
export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/unit/**/*.test.ts']
  },
  resolve: {
    alias: {
      '#shared': fileURLToPath(new URL('./shared', import.meta.url)),
      '~~': fileURLToPath(new URL('.', import.meta.url))
    }
  }
})
