import { randomUUID } from 'node:crypto'
import { and, eq, sql } from 'drizzle-orm'
import { drizzle } from 'drizzle-orm/node-postgres'
import { Pool } from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '~~/server/database/schema'
import { queryAccounts, removeAccount } from '~~/server/services/accounts'
import type { Database } from '~~/server/types/database'

/**
 * Account deletion is a database policy: the decision must stay tenant-scoped
 * and hold a parent-row lock across the dependency check and delete so new
 * history cannot race the check.
 *
 * Needs `pnpm db:up` and `pnpm db:migrate`. Skipped (not failed) without a
 * DATABASE_URL, so `pnpm test` stays green on a machine with no database.
 */
const databaseUrl = process.env.DATABASE_URL
const describeWithDb = databaseUrl ? describe : describe.skip

// The services throw Nitro's `createError`, which does not exist in plain Node.
Object.assign(globalThis, {
  createError: (input: { statusCode: number, statusMessage: string }) =>
    Object.assign(new Error(input.statusMessage), input)
})

describeWithDb('account deletion (real Postgres)', () => {
  let pool: Pool
  let db: Database

  const ama = `test-adel-ama-${randomUUID()}`
  const kofi = `test-adel-kofi-${randomUUID()}`

  const addAccount = async (userId: string, name: string, openingBalancePesewas = 0) => {
    const [account] = await db
      .insert(schema.financialAccounts)
      .values({ userId, name, type: 'mobile_money', openingBalancePesewas })
      .returning({ id: schema.financialAccounts.id })
    return account!.id
  }

  const accountRow = async (id: string) =>
    (await db
      .select({ id: schema.financialAccounts.id })
      .from(schema.financialAccounts)
      .where(eq(schema.financialAccounts.id, id)))[0]

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
    }
  })

  afterAll(async () => {
    await db.delete(schema.user).where(sql`${schema.user.id} in (${ama}, ${kofi})`)
    await pool.end()
  })

  it('marks only accounts without ledger or goal dependencies as deletable', async () => {
    const unusedId = await addAccount(ama, 'Unused with money', 125_050)
    const ledgerId = await addAccount(ama, 'Used by ledger')
    const goalId = await addAccount(ama, 'Used by goal')

    await db.insert(schema.transactions).values({
      userId: ama,
      accountId: ledgerId,
      type: 'income',
      amountPesewas: 10_000,
      occurredOn: '2026-10-01'
    })
    await db.insert(schema.goals).values({
      userId: ama,
      name: 'Emergency fund',
      targetPesewas: 500_000,
      accountId: goalId
    })

    const accounts = await queryAccounts(db, ama)
    const canDelete = (id: string) => accounts.find(account => account.accountId === id)?.canDelete

    expect(canDelete(unusedId)).toBe(true)
    expect(canDelete(ledgerId)).toBe(false)
    expect(canDelete(goalId)).toBe(false)
  })

  it('deletes an unused account even when it has a non-zero opening balance', async () => {
    const id = await addAccount(ama, 'Mistake', 45_000)

    expect(await removeAccount(db, ama, id)).toEqual({ deleted: true })
    expect(await accountRow(id)).toBeUndefined()
  })

  it('refuses an account with transaction history and leaves it intact', async () => {
    const id = await addAccount(ama, 'Income account')
    await db.insert(schema.transactions).values({
      userId: ama,
      accountId: id,
      type: 'income',
      amountPesewas: 25_000,
      occurredOn: '2026-10-02'
    })

    expect(await statusOf(() => removeAccount(db, ama, id))).toBe(409)
    expect(await accountRow(id)).toBeDefined()
  })

  it('refuses an account linked to a savings goal and leaves it intact', async () => {
    const id = await addAccount(ama, 'Goal account')
    await db.insert(schema.goals).values({
      userId: ama,
      name: 'School fees',
      targetPesewas: 800_000,
      accountId: id
    })

    expect(await statusOf(() => removeAccount(db, ama, id))).toBe(409)
    expect(await accountRow(id)).toBeDefined()
  })

  it('keeps a goal link that commits while account deletion waits on its FK lock', async () => {
    const id = await addAccount(ama, 'Concurrent goal account')
    const goalId = randomUUID()
    const deleterApplicationName = `jara-delete-${randomUUID().slice(0, 8)}`
    const inserterPool = new Pool({
      connectionString: databaseUrl,
      application_name: `jara-goal-${randomUUID().slice(0, 8)}`
    })
    const deleterPool = new Pool({
      connectionString: databaseUrl,
      application_name: deleterApplicationName
    })
    const inserter = await inserterPool.connect()
    const deleterDb = drizzle(deleterPool, { schema, casing: 'snake_case' })
    let insertCommitted = false
    let deletion: Promise<number> | undefined

    try {
      await inserter.query('begin')
      await inserter.query(
        `insert into goals (id, user_id, name, target_pesewas, account_id)
         values ($1, $2, $3, $4, $5)`,
        [goalId, ama, 'Concurrent emergency fund', 600_000, id]
      )

      // The uncommitted FK insert holds KEY SHARE on the account. The delete's
      // FOR UPDATE must be observed waiting on that lock before the insert is
      // committed, making the race ordering deterministic rather than timed.
      deletion = statusOf(() => removeAccount(deleterDb, ama, id))
      const deadline = Date.now() + 5_000
      let deleteIsWaiting = false
      while (Date.now() < deadline) {
        const activity = await pool.query(
          `select 1
           from pg_stat_activity
           where application_name = $1
             and state = 'active'
             and wait_event_type = 'Lock'`,
          [deleterApplicationName]
        )
        if (activity.rowCount) {
          deleteIsWaiting = true
          break
        }
        await new Promise<void>(resolve => setImmediate(resolve))
      }
      expect(deleteIsWaiting).toBe(true)

      await inserter.query('commit')
      insertCommitted = true

      expect(await deletion).toBe(409)
      expect(await accountRow(id)).toBeDefined()
      const [goal] = await db
        .select({ accountId: schema.goals.accountId })
        .from(schema.goals)
        .where(and(eq(schema.goals.id, goalId), eq(schema.goals.userId, ama)))
      expect(goal?.accountId).toBe(id)
    } finally {
      if (!insertCommitted) {
        await inserter.query('rollback').catch(() => undefined)
      }
      if (deletion) await deletion.catch(() => undefined)
      inserter.release()
      await Promise.all([inserterPool.end(), deleterPool.end()])
    }
  }, 10_000)

  it("does not reveal or delete another user's unused account", async () => {
    const id = await addAccount(kofi, 'Kofi cash')

    expect(await statusOf(() => removeAccount(db, ama, id))).toBe(404)
    expect(await accountRow(id)).toBeDefined()
  })

  it('reports a missing account as not found', async () => {
    expect(await statusOf(() => removeAccount(db, ama, randomUUID()))).toBe(404)
  })
})
