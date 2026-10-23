import { Pool } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import * as schema from '../database/schema'

let pool: Pool | undefined
let database: NodePgDatabase<typeof schema> | undefined

/**
 * Single shared pool for the Nitro process. Created lazily so importing this
 * module never opens a connection at build time.
 */
export function useDb(): NodePgDatabase<typeof schema> {
  if (!database) {
    const { databaseUrl } = useRuntimeConfig()

    if (!databaseUrl) {
      throw new Error('DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.')
    }

    pool = new Pool({ connectionString: databaseUrl, max: 10 })
    database = drizzle(pool, { schema, casing: 'snake_case' })
  }

  return database
}
