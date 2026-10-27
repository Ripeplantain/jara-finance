import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '~~/server/database/schema'
import { queryAccountBalances } from '~~/server/services/balances'
import { applyGoalEntryUpdate, insertGoal, queryGoals } from '~~/server/services/goals'
import { moveEntryIntoTransfer } from '~~/server/services/transactions'
import type { Database } from '~~/server/types/database'

/**
 * Editing goals and their contributions, against a real Postgres.
 *
 * The risky part is a *backed* contribution, which is a real transfer: editing
 * it must rewrite both legs and the goal entry together, and turning a tracked
 * entry into a transfer must never count the money twice. These assert that on
 * the balances and the goal totals, not just on the rows.
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

describeWithDb('goal contributions: edit and move (real Postgres)', () => {
  let pool: Pool
  let db: Database

  const ama = `test-goal-ama-${randomUUID()}`
  const kofi = `test-goal-kofi-${randomUUID()}`
  const timezone = 'Africa/Accra'

  let momoId: string
  let savingsId: string
  let goalId: string

  const balanceOf = async (userId: string, accountId: string) =>
    (await queryAccountBalances(db, userId)).find(a => a.accountId === accountId)!.balancePesewas

  const goalFor = async (userId: string, id: string) =>
    (await queryGoals(db, userId, timezone)).find(g => g.id === id)!

  const entryRow = async (id: string) =>
    (await db.select().from(schema.goalEntries).where(eq(schema.goalEntries.id, id)))[0]!

  const legsOf = async (inLegId: string) => {
    const [leg] = await db
      .select({ group: schema.transactions.transferGroupId })
      .from(schema.transactions)
      .where(eq(schema.transactions.id, inLegId))
    return db
      .select()
      .from(schema.transactions)
      .where(eq(schema.transactions.transferGroupId, leg!.group!))
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

    const accounts = await db
      .insert(schema.financialAccounts)
      .values([
        { userId: ama, name: 'MoMo', type: 'mobile_money', openingBalancePesewas: 100_000 },
        { userId: ama, name: 'Savings', type: 'savings', openingBalancePesewas: 0 }
      ])
      .returning({ id: schema.financialAccounts.id, name: schema.financialAccounts.name })
    momoId = accounts.find(a => a.name === 'MoMo')!.id
    savingsId = accounts.find(a => a.name === 'Savings')!.id
  })

  afterAll(async () => {
    for (const id of [ama, kofi]) {
      await db.delete(schema.user).where(eq(schema.user.id, id))
    }
    await pool.end()
  })

  it('creates a goal with an already-saved amount as a tracked entry that moves no money', async () => {
    const goal = await insertGoal(db, ama, timezone, {
      name: 'Laptop',
      target: 500_000,
      targetDate: null,
      accountId: savingsId,
      alreadySaved: 120_000
    })
    goalId = goal.id

    const progress = await goalFor(ama, goalId)
    expect(progress.trackedPesewas).toBe(120_000)
    expect(progress.backedPesewas).toBe(0)
    expect(progress.actualPesewas).toBe(120_000)
    // Nothing moved: no transfer rows and untouched balances.
    expect(await balanceOf(ama, momoId)).toBe(100_000)
    expect(await balanceOf(ama, savingsId)).toBe(0)
  })

  it('creates a goal without an already-saved amount with no entries', async () => {
    const goal = await insertGoal(db, ama, timezone, {
      name: 'Rent',
      target: 300_000,
      targetDate: null,
      accountId: null,
      alreadySaved: null
    })
    expect((await goalFor(ama, goal.id)).entryCount).toBe(0)
  })

  it('edits a tracked entry without touching the ledger', async () => {
    const [tracked] = await db
      .select()
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.goalId, goalId))

    await applyGoalEntryUpdate(db, ama, tracked!.id, { amount: 150_000, occurredOn: '2026-09-15' })

    const row = await entryRow(tracked!.id)
    expect(row.amountPesewas).toBe(150_000)
    expect(row.occurredOn).toBe('2026-09-15')
    // A note that was not sent is left as it was, not cleared.
    expect(row.note).toBe('Already saved')
    expect((await goalFor(ama, goalId)).trackedPesewas).toBe(150_000)
    expect(await balanceOf(ama, momoId)).toBe(100_000)
  })

  it('moves a tracked entry into a real transfer without counting it twice', async () => {
    const [tracked] = await db
      .select()
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.goalId, goalId))

    const { legs } = await moveEntryIntoTransfer(db, ama, tracked!.id, momoId)

    // Two legs, one group: out of MoMo, into Savings, same amount.
    expect(legs).toHaveLength(2)
    expect(new Set(legs.map(leg => leg.transferGroupId)).size).toBe(1)
    expect(legs.every(leg => leg.amountPesewas === 150_000 && leg.type === 'transfer')).toBe(true)

    // The same entry is now backed; the goal total is unchanged, only reclassified.
    const progress = await goalFor(ama, goalId)
    expect(progress.backedPesewas).toBe(150_000)
    expect(progress.trackedPesewas).toBe(0)
    expect(progress.actualPesewas).toBe(150_000)
    expect(progress.entryCount).toBe(1)

    expect(await balanceOf(ama, momoId)).toBe(100_000 - 150_000)
    expect(await balanceOf(ama, savingsId)).toBe(150_000)
  })

  it('refuses to move the same entry twice', async () => {
    const [entry] = await db
      .select()
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.goalId, goalId))

    await expect(moveEntryIntoTransfer(db, ama, entry!.id, momoId)).rejects.toMatchObject({
      statusCode: 409
    })
    // And nothing was written by the failed attempt.
    expect(await balanceOf(ama, savingsId)).toBe(150_000)
  })

  it('edits a backed entry by rewriting both legs of the transfer together', async () => {
    const [entry] = await db
      .select()
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.goalId, goalId))

    await applyGoalEntryUpdate(db, ama, entry!.id, {
      amount: 40_000,
      occurredOn: '2026-10-20',
      note: 'Smaller than planned'
    })

    const legs = await legsOf(entry!.linkedTransactionId!)
    expect(legs).toHaveLength(2)
    for (const leg of legs) {
      expect(leg.amountPesewas).toBe(40_000)
      expect(leg.occurredOn).toBe('2026-10-20')
      expect(leg.note).toBe('Smaller than planned')
    }

    const row = await entryRow(entry!.id)
    expect(row.amountPesewas).toBe(40_000)
    expect(row.linkedTransactionId).toBe(entry!.linkedTransactionId)

    // Balances follow from the ledger; nothing was stored.
    expect(await balanceOf(ama, momoId)).toBe(100_000 - 40_000)
    expect(await balanceOf(ama, savingsId)).toBe(40_000)
    expect((await goalFor(ama, goalId)).backedPesewas).toBe(40_000)
  })

  it('will not let another user edit or move the entry', async () => {
    const [entry] = await db
      .select()
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.goalId, goalId))

    await expect(applyGoalEntryUpdate(db, kofi, entry!.id, { amount: 1 })).rejects.toMatchObject({
      statusCode: 404
    })
    await expect(moveEntryIntoTransfer(db, kofi, entry!.id, momoId)).rejects.toMatchObject({
      statusCode: 404
    })
    expect((await entryRow(entry!.id)).amountPesewas).toBe(40_000)
  })

  it('will not move a tracked entry from the goal\'s own account, or into a goal with no account', async () => {
    const [tracked] = await db
      .insert(schema.goalEntries)
      .values({ userId: ama, goalId, amountPesewas: 5_000, occurredOn: '2026-10-21' })
      .returning()
    await expect(moveEntryIntoTransfer(db, ama, tracked!.id, savingsId)).rejects.toMatchObject({
      statusCode: 409
    })

    const noAccount = await insertGoal(db, ama, timezone, {
      name: 'No account',
      target: 10_000,
      targetDate: null,
      accountId: null,
      alreadySaved: 2_000
    })
    const [orphan] = await db
      .select()
      .from(schema.goalEntries)
      .where(and(eq(schema.goalEntries.goalId, noAccount.id), eq(schema.goalEntries.userId, ama)))
    await expect(moveEntryIntoTransfer(db, ama, orphan!.id, momoId)).rejects.toMatchObject({
      statusCode: 409
    })
  })
})
