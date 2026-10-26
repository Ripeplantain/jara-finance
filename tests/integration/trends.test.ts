import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '~~/server/database/schema'
import { querySavedInPeriod } from '~~/server/services/summary'
import {
  queryCategoryComparison,
  queryDailySpend,
  queryMonthlySeries,
  queryTransactionMonthTotals
} from '~~/server/services/trends'
import type { Database } from '~~/server/types/database'

/**
 * The series behind the dashboard chart, Insights and the ledger's month
 * headings, against a real Postgres. Needs `pnpm db:up`; skipped without a
 * DATABASE_URL like the other integration suites.
 *
 * "Now" is pinned so the months are stable: 26 October 2026, midday in Accra.
 */
const databaseUrl = process.env.DATABASE_URL
const describeWithDb = databaseUrl ? describe : describe.skip

const NOW = new Date('2026-10-26T12:00:00Z')
const ACCRA = 'Africa/Accra'

describeWithDb('trends (real Postgres)', () => {
  let pool: Pool
  let db: Database

  const alice = `test-trend-alice-${randomUUID()}`
  const bob = `test-trend-bob-${randomUUID()}`
  let aliceAccount: string
  let aliceSavings: string
  let bobAccount: string
  let food: string
  let transport: string
  let salary: string
  let goalId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema, casing: 'snake_case' })

    for (const id of [alice, bob]) {
      await db.insert(schema.user).values({
        id,
        name: `Test ${id}`,
        email: `${id}@example.test`,
        emailVerified: true
      })
    }

    const categories = await db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.isSystem, true))
    const find = (name: string) => {
      const found = categories.find(category => category.name === name)
      if (!found) throw new Error(`Seed category "${name}" missing — run \`pnpm db:seed\`.`)
      return found.id
    }
    food = find('Food & Groceries')
    transport = find('Transport')
    salary = find('Salary')

    const accounts = await db
      .insert(schema.financialAccounts)
      .values([
        { userId: alice, name: 'Main', type: 'bank', openingBalancePesewas: 0 },
        { userId: alice, name: 'Savings', type: 'savings', openingBalancePesewas: 0 },
        { userId: bob, name: 'Bob Main', type: 'bank', openingBalancePesewas: 0 }
      ])
      .returning({ id: schema.financialAccounts.id, name: schema.financialAccounts.name })
    aliceAccount = accounts.find(account => account.name === 'Main')!.id
    aliceSavings = accounts.find(account => account.name === 'Savings')!.id
    bobAccount = accounts.find(account => account.name === 'Bob Main')!.id

    const group = randomUUID()
    const tx = (userId: string, accountId: string, rest: Record<string, unknown>) =>
      ({ userId, accountId, ...rest }) as typeof schema.transactions.$inferInsert

    await db.insert(schema.transactions).values([
      // October (current): income 1,000; spend 100 + 50 + 30 = 180
      tx(alice, aliceAccount, { categoryId: salary, type: 'income', amountPesewas: 100_000, occurredOn: '2026-10-01' }),
      tx(alice, aliceAccount, { categoryId: food, type: 'expense', amountPesewas: 10_000, occurredOn: '2026-10-03' }),
      tx(alice, aliceAccount, { categoryId: food, type: 'expense', amountPesewas: 5_000, occurredOn: '2026-10-03' }),
      tx(alice, aliceAccount, { categoryId: transport, type: 'expense', amountPesewas: 3_000, occurredOn: '2026-10-20' }),
      // After "today": must not appear in the daily series.
      tx(alice, aliceAccount, { categoryId: food, type: 'expense', amountPesewas: 99_900, occurredOn: '2026-10-30' }),
      // A transfer into savings: neither income nor spending, anywhere.
      tx(alice, aliceAccount, { type: 'transfer', transferDirection: 'out', transferGroupId: group, amountPesewas: 70_000, occurredOn: '2026-10-02' }),
      tx(alice, aliceSavings, { type: 'transfer', transferDirection: 'in', transferGroupId: group, amountPesewas: 70_000, occurredOn: '2026-10-02' }),
      // September: income 900; spend 20 + 40 = 60
      tx(alice, aliceAccount, { categoryId: salary, type: 'income', amountPesewas: 90_000, occurredOn: '2026-09-28' }),
      tx(alice, aliceAccount, { categoryId: food, type: 'expense', amountPesewas: 2_000, occurredOn: '2026-09-05' }),
      tx(alice, aliceAccount, { categoryId: transport, type: 'expense', amountPesewas: 4_000, occurredOn: '2026-09-06' }),
      // Six months back is outside a six-month window ending October (May is the first).
      tx(alice, aliceAccount, { categoryId: food, type: 'expense', amountPesewas: 777_700, occurredOn: '2026-04-30' }),
      // Bob: big numbers that must never reach Alice.
      tx(bob, bobAccount, { categoryId: salary, type: 'income', amountPesewas: 5_000_000, occurredOn: '2026-10-01' }),
      tx(bob, bobAccount, { categoryId: food, type: 'expense', amountPesewas: 400_000, occurredOn: '2026-10-03' }),
      tx(bob, bobAccount, { categoryId: food, type: 'expense', amountPesewas: 300_000, occurredOn: '2026-09-03' })
    ])

    const [goal] = await db
      .insert(schema.goals)
      .values({ userId: alice, name: 'Laptop', targetPesewas: 500_000 })
      .returning({ id: schema.goals.id })
    goalId = goal!.id
    const [bobGoal] = await db
      .insert(schema.goals)
      .values({ userId: bob, name: 'Bob goal', targetPesewas: 500_000 })
      .returning({ id: schema.goals.id })
    await db.insert(schema.goalEntries).values([
      { userId: alice, goalId, amountPesewas: 70_000, occurredOn: '2026-10-02' },
      { userId: alice, goalId, amountPesewas: 20_000, occurredOn: '2026-08-10' },
      { userId: bob, goalId: bobGoal!.id, amountPesewas: 123_400, occurredOn: '2026-10-02' }
    ])
  })

  afterAll(async () => {
    await db.delete(schema.user).where(sql`${schema.user.id} in (${alice}, ${bob})`)
    await pool.end()
  })

  it('builds six months oldest first, with empty months as zeros', async () => {
    const { months } = await queryMonthlySeries(db, alice, ACCRA, 6, NOW)
    expect(months.map(month => month.month)).toEqual([
      '2026-05', '2026-06', '2026-07', '2026-08', '2026-09', '2026-10'
    ])
    expect(months.map(month => month.label)).toEqual(['May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'])
    expect(months[0]).toMatchObject({ incomePesewas: 0, expensePesewas: 0, savedPesewas: 0 })
  })

  it('counts income and spending but never the transfer', async () => {
    const { months } = await queryMonthlySeries(db, alice, ACCRA, 6, NOW)
    const october = months.at(-1)!
    // 100 + 50 + 30 + 999 (dated the 30th, still October) of spending; the GH₵700 transfer is neither.
    expect(october.incomePesewas).toBe(100_000)
    expect(october.expensePesewas).toBe(10_000 + 5_000 + 3_000 + 99_900)
    const september = months.at(-2)!
    expect(september.incomePesewas).toBe(90_000)
    expect(september.expensePesewas).toBe(6_000)
  })

  it('reports money moved into goals per month, separately from spending', async () => {
    const { months } = await queryMonthlySeries(db, alice, ACCRA, 6, NOW)
    expect(months.find(month => month.month === '2026-10')!.savedPesewas).toBe(70_000)
    expect(months.find(month => month.month === '2026-08')!.savedPesewas).toBe(20_000)
  })

  it('excludes rows older than the window', async () => {
    const { months } = await queryMonthlySeries(db, alice, ACCRA, 6, NOW)
    expect(months.some(month => month.expensePesewas === 777_700)).toBe(false)
  })

  it('follows the user’s timezone across a month boundary', async () => {
    // 31 Oct 23:00 UTC is already 1 Nov in Auckland, so November is "this month" there.
    const lateOctober = new Date('2026-10-31T23:00:00Z')
    const accra = await queryMonthlySeries(db, alice, ACCRA, 2, lateOctober)
    const auckland = await queryMonthlySeries(db, alice, 'Pacific/Auckland', 2, lateOctober)
    expect(accra.months.map(month => month.month)).toEqual(['2026-09', '2026-10'])
    expect(auckland.months.map(month => month.month)).toEqual(['2026-10', '2026-11'])
  })

  it('returns daily spend through today with a running total', async () => {
    const daily = await queryDailySpend(db, alice, ACCRA, NOW)
    expect(daily.days).toHaveLength(26)
    expect(daily.days[2]).toEqual({ day: 3, spendPesewas: 15_000, cumulativePesewas: 15_000 })
    expect(daily.days[3]!.spendPesewas).toBe(0)
    expect(daily.days[3]!.cumulativePesewas).toBe(15_000)
    // The 20th adds GH₵30; the expense dated the 30th is in the future and absent.
    expect(daily.days.at(-1)!.cumulativePesewas).toBe(18_000)
  })

  it('compares this month with last, naming the direction', async () => {
    const { rows } = await queryCategoryComparison(db, alice, ACCRA, NOW)
    const foodRow = rows.find(row => row.categoryId === food)!
    expect(foodRow).toMatchObject({ currentPesewas: 114_900, previousPesewas: 2_000, direction: 'more' })
    const transportRow = rows.find(row => row.categoryId === transport)!
    expect(transportRow).toMatchObject({ currentPesewas: 3_000, previousPesewas: 4_000, direction: 'less' })
    expect(rows[0]!.categoryId).toBe(food)
  })

  it('totals In and Out per month for the ledger, transfers excluded', async () => {
    const { months } = await queryTransactionMonthTotals(
      db, alice, ACCRA, { period: 'last_30_days' }, NOW
    )
    // 27 Sep – 26 Oct: September holds only the 28th's GH₵900 salary.
    expect(months.map(month => month.month)).toEqual(['2026-10', '2026-09'])
    expect(months[0]).toMatchObject({ incomePesewas: 100_000, expensePesewas: 18_000 })
    expect(months[1]).toMatchObject({ incomePesewas: 90_000, expensePesewas: 0 })
  })

  it('narrows month totals to one account when asked', async () => {
    const { months } = await queryTransactionMonthTotals(
      db, alice, ACCRA, { period: 'this_month', accountId: aliceSavings }, NOW
    )
    // The savings account only ever received a transfer.
    expect(months).toEqual([])
  })

  it('sums goal contributions inside a window', async () => {
    const saved = await querySavedInPeriod(db, alice, { start: '2026-10-01', end: '2026-10-31' })
    expect(saved).toBe(70_000)
  })

  it('never lets another user’s rows into any series', async () => {
    const monthly = await queryMonthlySeries(db, alice, ACCRA, 6, NOW)
    expect(JSON.stringify(monthly)).not.toContain('5000000')
    expect(monthly.months.at(-1)!.incomePesewas).toBe(100_000)
    expect(monthly.months.at(-1)!.savedPesewas).toBe(70_000)

    const daily = await queryDailySpend(db, alice, ACCRA, NOW)
    expect(daily.days.at(-1)!.cumulativePesewas).toBe(18_000)

    const comparison = await queryCategoryComparison(db, alice, ACCRA, NOW)
    expect(comparison.rows.find(row => row.categoryId === food)!.currentPesewas).toBe(114_900)

    const ledger = await queryTransactionMonthTotals(db, alice, ACCRA, { period: 'all_time' }, NOW)
    expect(ledger.months.reduce((total, month) => total + month.incomePesewas, 0)).toBe(190_000)

    // And Bob sees his own, not Alice's.
    const bobMonthly = await queryMonthlySeries(db, bob, ACCRA, 6, NOW)
    expect(bobMonthly.months.at(-1)!.incomePesewas).toBe(5_000_000)
    expect(bobMonthly.months.at(-1)!.expensePesewas).toBe(400_000)
    expect(bobMonthly.months.at(-1)!.savedPesewas).toBe(123_400)
    expect(await querySavedInPeriod(db, bob, { start: '2026-10-01', end: '2026-10-31' })).toBe(123_400)
  })
})
