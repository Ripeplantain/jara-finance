import type { NodePgDatabase } from 'drizzle-orm/node-postgres'
import type * as schema from '../database/schema'

/**
 * The Drizzle instance type, including the full schema so the relational query
 * builder is typed.
 *
 * Lives here rather than in `server/utils/db.ts` so that service modules can
 * accept a database as a parameter — and therefore be tested against a real
 * Postgres — without importing the module that reads the Nuxt runtime config.
 */
export type Database = NodePgDatabase<typeof schema>

/**
 * A transaction handle. Structurally compatible with `Database`, so a service
 * can take either and work inside or outside an enclosing transaction.
 */
export type DatabaseTransaction = Parameters<Parameters<Database['transaction']>[0]>[0]
