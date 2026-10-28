import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '~~/server/database/schema'
import { insertGoal, removeGoal } from '~~/server/services/goals'
import type { Database } from '~~/server/types/database'

/**
 * Deleting a goal, against a real Postgres.
 *
 * The rule is that only an empty goal can go. The check lives in the delete
 * statement, so these assert both outcomes on the rows: an empty goal is gone,
 * and a goal with money, tracked or backed, is left exactly as it was.
 *
 * Needs `pnpm db:up`, `pnpm db:migrate` and `pnpm db:seed`. Skipped (not
 * failed) without a DATABASE_URL.
 */
const databaseUrl = process.env.DATABASE_URL
const describeWithDb = databaseUrl ? describe : describe.skip

// The services throw Nitro's `createError`, which does not exist in plain Node.
Object.assign(globalThis, {
  createError: (input: { statusCode: number, statusMessage: string }) =>
    Object.assign(new Error(input.statusMessage), input)
})

describeWithDb('deleting a goal (real Postgres)', () => {
  let pool: Pool
  let db: Database

  const ama = `test-gdel-ama-${randomUUID()}`
  const kofi = `test-gdel-kofi-${randomUUID()}`
  const timezone = 'Africa/Accra'

  const newGoal = (userId: string, alreadySaved: number | null) =>
    insertGoal(db, userId, timezone, {
      name: 'Goal',
      target: 500_000,
      targetDate: null,
      accountId: null,
      alreadySaved
    })

  const goalRow = async (id: string) =>
    (await db.select().from(schema.goals).where(eq(schema.goals.id, id)))[0]

  const statusOf = async (run: () => Promise<unknown>) => {
    try {
      await run()
      return 200
    } catch (error) {
      return (error as { statusCode: number }).statusCode
    }
  }

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema, casing: 'snake_case' })

    for (const id of [ama, kofi]) {
      await db.insert(schema.user).values({
        id,
        name: `Test ${id}`,
        email: `${id}@example.test`,
        emailVerified: true
      })
      await db.insert(schema.profiles).values({ userId: id, displayName: 'Test', timezone })
    }
  })

  afterAll(async () => {
    for (const id of [ama, kofi]) {
      await db.delete(schema.user).where(eq(schema.user.id, id))
    }
    await pool.end()
  })

  it('deletes a goal with no contributions', async () => {
    const goal = await newGoal(ama, null)

    expect(await removeGoal(db, ama, goal.id)).toEqual({ deleted: true })
    expect(await goalRow(goal.id)).toBeUndefined()
  })

  it('refuses a goal with money in it and leaves the goal and its entries alone', async () => {
    const goal = await newGoal(ama, 120_000)

    expect(await statusOf(() => removeGoal(db, ama, goal.id))).toBe(409)

    expect(await goalRow(goal.id)).toBeDefined()
    const entries = await db
      .select()
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.goalId, goal.id))
    expect(entries).toHaveLength(1)
    expect(entries[0]!.amountPesewas).toBe(120_000)
  })

  it('can delete the goal once its contributions are removed', async () => {
    const goal = await newGoal(ama, 50_000)
    await db.delete(schema.goalEntries).where(eq(schema.goalEntries.goalId, goal.id))

    expect(await removeGoal(db, ama, goal.id)).toEqual({ deleted: true })
    expect(await goalRow(goal.id)).toBeUndefined()
  })

  it("will not delete another user's goal, and says it does not exist", async () => {
    const goal = await newGoal(kofi, null)

    expect(await statusOf(() => removeGoal(db, ama, goal.id))).toBe(404)
    expect(await goalRow(goal.id)).toBeDefined()
  })

  it('reports a goal that does not exist as 404', async () => {
    expect(await statusOf(() => removeGoal(db, ama, randomUUID()))).toBe(404)
  })
})
