import { defineConfig } from 'drizzle-kit'

export default defineConfig({
  schema: './server/database/schema/index.ts',
  out: './server/database/migrations',
  dialect: 'postgresql',
  dbCredentials: {
    url: process.env.DATABASE_URL!
  },
  // Write camelCase TypeScript, get snake_case columns. Keeps the schema files
  // free of per-column name strings.
  casing: 'snake_case',
  strict: true,
  verbose: true
})
