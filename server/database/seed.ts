/**
 * Seeds the shared system categories. Idempotent — safe to run on every deploy.
 *
 * This runs standalone under `tsx`, outside the Nuxt runtime, so it reads
 * `process.env` directly. That is the one sanctioned exception to the
 * "`useRuntimeConfig`, never `process.env`" rule: there is no Nuxt context here
 * to read a config from.
 */
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import * as schema from './schema'
import { SYSTEM_CATEGORIES } from './seed-data'

const databaseUrl = process.env.DATABASE_URL
if (!databaseUrl) {
  console.error('DATABASE_URL is not set. Copy .env.example to .env and run `pnpm db:up`.')
  process.exit(1)
}

const pool = new Pool({ connectionString: databaseUrl })
const db = drizzle(pool, { schema, casing: 'snake_case' })

async function seed() {
  const rows = SYSTEM_CATEGORIES.map(category => ({
    userId: null,
    name: category.name,
    kind: category.kind,
    icon: category.icon,
    colorIndex: category.colorIndex,
    sortOrder: category.sortOrder,
    isSystem: true
  }))

  // Upsert on the (userId, name, kind) unique index. Icons, colours and ordering
  // are presentation details that should follow the code, so re-seeding corrects
  // them; the row's id is preserved, which matters because existing
  // transactions and budget allocations point at it.
  await db
    .insert(schema.categories)
    .values(rows)
    .onConflictDoUpdate({
      target: [schema.categories.userId, schema.categories.name, schema.categories.kind],
      set: {
        icon: sql`excluded.icon`,
        colorIndex: sql`excluded.color_index`,
        sortOrder: sql`excluded.sort_order`,
        isSystem: sql`excluded.is_system`,
        updatedAt: sql`now()`
      }
    })

  const totals = await db
    .select({ count: sql<string>`count(*)::text` })
    .from(schema.categories)
    .where(sql`${schema.categories.isSystem} = true`)

  console.log(
    `Seeded ${rows.length} system categories (${totals[0]?.count ?? '?'} system categories in total).`
  )
}

seed()
  .catch((error) => {
    console.error('Seed failed:', error)
    process.exitCode = 1
  })
  .finally(() => pool.end())
