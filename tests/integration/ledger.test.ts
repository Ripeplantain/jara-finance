import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '~~/server/database/schema'
import { queryBudgetStatus } from '~~/server/services/budgets'
import { queryGoals, getCommittedSavings } from '~~/server/services/goals'
import { queryPeriodTotals, querySpendingByCategory } from '~~/server/services/summary'
import { queryCategories } from '~~/server/services/categories'
import { resolvePeriod } from '#shared/period/month'
import type { Database } from '~~/server/types/database'

/**
 * The reporting SQL, against a real Postgres.
 *
 * These cover the class of bug a unit test structurally cannot reach: a
 * filtered aggregate that counts a transfer as income, a budget that consumes
 * its cap with money that only moved between the user's own accounts, a goal
 * that conflates intent with a real transfer, or a join that leaks another
 * user's rows.
 *
 * Needs `pnpm db:up`, `pnpm db:migrate` and `pnpm db:seed`. Skipped (not
 * failed) without a DATABASE_URL.
 */
const databaseUrl = process.env.DATABASE_URL
const describeWithDb = databaseUrl ? describe : describe.skip

describeWithDb('reporting aggregates (real Postgres)', () => {
  let pool: Pool
  let db: Database

  const ama = `test-ama-${randomUUID()}`
  const kofi = `test-kofi-${randomUUID()}`
  const timezone = 'Africa/Accra'

  let momoId: string
  let savingsId: string
  let kofiCashId: string
  let foodId: string
  let transportId: string
  let salaryId: string
  let goalId: string

  // A fixed month, so the assertions don't drift with the calendar.
  const period = { kind: 'custom' as const, start: '2026-10-01', end: '2026-10-31' }

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

    const categories = await queryCategories(db, ama)
    const findCategory = (name: string) => {
      const found = categories.find(category => category.name === name)
      if (!found) throw new Error(`Seed category "${name}" missing — run \`pnpm db:seed\`.`)
      return found.id
    }
    foodId = findCategory('Food & Groceries')
    transportId = findCategory('Transport')
    salaryId = findCategory('Salary')

    const accounts = await db
      .insert(schema.financialAccounts)
      .values([
        { userId: ama, name: 'MoMo', type: 'mobile_money', openingBalancePesewas: 120_050 },
        { userId: ama, name: 'Savings', type: 'savings', openingBalancePesewas: 0 },
        { userId: kofi, name: 'Kofi Cash', type: 'cash', openingBalancePesewas: 999_999 }
      ])
      .returning({ id: schema.financialAccounts.id, name: schema.financialAccounts.name })

    const accountId = (name: string) => accounts.find(a => a.name === name)!.id
    momoId = accountId('MoMo')
    savingsId = accountId('Savings')
    kofiCashId = accountId('Kofi Cash')

    const transferGroupId = randomUUID()
    const rows = await db
      .insert(schema.transactions)
      .values([
        // GH₵3,500 salary
        {
          userId: ama,
          accountId: momoId,
          categoryId: salaryId,
          type: 'income',
          amountPesewas: 350_000,
          occurredOn: '2026-10-01'
        },
        // GH₵87.40 food
        {
          userId: ama,
          accountId: momoId,
          categoryId: foodId,
          type: 'expense',
          amountPesewas: 8_740,
          occurredOn: '2026-10-05'
        },
        // GH₵400 transport — over its GH₵300 cap below
        {
          userId: ama,
          accountId: momoId,
          categoryId: transportId,
          type: 'expense',
          amountPesewas: 40_000,
          occurredOn: '2026-10-10'
        },
        // GH₵25 with no category, to prove uncategorised spend is not dropped
        {
          userId: ama,
          accountId: momoId,
          type: 'expense',
          amountPesewas: 2_500,
          occurredOn: '2026-10-11'
        },
        // GH₵600 moved to savings: neither income nor expense
        {
          userId: ama,
          accountId: momoId,
          type: 'transfer',
          transferDirection: 'out',
          transferGroupId,
          amountPesewas: 60_000,
          occurredOn: '2026-10-06'
        },
        {
          userId: ama,
          accountId: savingsId,
          type: 'transfer',
          transferDirection: 'in',
          transferGroupId,
          amountPesewas: 60_000,
          occurredOn: '2026-10-06'
        },
        // Kofi's, which must never appear in Ama's figures
        {
          userId: kofi,
          accountId: kofiCashId,
          categoryId: foodId,
          type: 'expense',
          amountPesewas: 777_777,
          occurredOn: '2026-10-07'
        }
      ])
      .returning({ id: schema.transactions.id, direction: schema.transactions.transferDirection })

    // A budget: GH₵600 food, GH₵300 transport
    const [budget] = await db
      .insert(schema.budgets)
      .values({
        userId: ama,
        periodStart: '2026-10-01',
        periodEnd: '2026-10-31',
        note: 'October plan'
      })
      .returning({ id: schema.budgets.id })

    await db.insert(schema.budgetAllocations).values([
      { budgetId: budget!.id, categoryId: foodId, limitPesewas: 60_000 },
      { budgetId: budget!.id, categoryId: transportId, limitPesewas: 30_000 }
    ])

    // A goal with one real (backed) and one intent-only (tracked) contribution
    const [goal] = await db
      .insert(schema.goals)
      .values({
        userId: ama,
        name: 'Laptop',
        targetPesewas: 500_000,
        targetDate: '2027-04-01',
        accountId: savingsId
      })
      .returning({ id: schema.goals.id })
    goalId = goal!.id

    const inLeg = rows.find(row => row.direction === 'in')!
    await db.insert(schema.goalEntries).values([
      {
        userId: ama,
        goalId,
        amountPesewas: 60_000,
        occurredOn: '2026-10-06',
        linkedTransactionId: inLeg.id
      },
      { userId: ama, goalId, amountPesewas: 20_000, occurredOn: '2026-10-12' }
    ])
  })

  afterAll(async () => {
    for (const id of [ama, kofi]) {
      await db.delete(schema.user).where(eq(schema.user.id, id))
    }
    await pool.end()
  })

  describe('period totals', () => {
    it('excludes transfers from income and expenses', async () => {
      // The whole point: GH₵600 moved to savings must not read as GH₵600
      // earned, nor GH₵600 spent.
      const totals = await queryPeriodTotals(db, ama, resolvePeriod(period, timezone))
      expect(totals.incomePesewas).toBe(350_000)
      expect(totals.expensePesewas).toBe(51_240)
      expect(totals.netPesewas).toBe(298_760)
    })

    it('excludes transfers from the transaction count too', async () => {
      const totals = await queryPeriodTotals(db, ama, resolvePeriod(period, timezone))
      expect(totals.transactionCount).toBe(4)
    })

    it('computes a savings rate without dividing by zero income', async () => {
      const totals = await queryPeriodTotals(db, ama, resolvePeriod(period, timezone))
      expect(totals.savingsRatePercent).toBeCloseTo(85.36, 1)

      const empty = await queryPeriodTotals(
        db,
        kofi,
        resolvePeriod({ kind: 'custom', start: '2026-10-01', end: '2026-10-31' }, timezone)
      )
      expect(empty.incomePesewas).toBe(0)
      expect(empty.savingsRatePercent).toBe(0)
    })

    it('never counts another user\'s transactions', async () => {
      const totals = await queryPeriodTotals(db, ama, resolvePeriod(period, timezone))
      // Kofi spent GH₵7,777.77 in the same month.
      expect(totals.expensePesewas).toBe(51_240)

      const kofiTotals = await queryPeriodTotals(db, kofi, resolvePeriod(period, timezone))
      expect(kofiTotals.expensePesewas).toBe(777_777)
      expect(kofiTotals.incomePesewas).toBe(0)
    })
  })

  describe('spending by category', () => {
    it('breaks spending down largest first and sums to the expense total', async () => {
      const result = await querySpendingByCategory(db, ama, resolvePeriod(period, timezone))
      expect(result.totalPesewas).toBe(51_240)
      expect(result.categories[0]!.name).toBe('Transport')
      expect(result.categories[0]!.amountPesewas).toBe(40_000)

      const summed = result.categories.reduce((total, row) => total + row.amountPesewas, 0)
      expect(summed).toBe(result.totalPesewas)
    })

    it('keeps uncategorised spending as a real slice rather than dropping it', async () => {
      // Dropping it would make the chart disagree with the headline figure.
      const result = await querySpendingByCategory(db, ama, resolvePeriod(period, timezone))
      const uncategorised = result.categories.find(row => row.categoryId === null)
      expect(uncategorised).toBeDefined()
      expect(uncategorised!.name).toBe('Uncategorised')
      expect(uncategorised!.amountPesewas).toBe(2_500)
    })

    it('reports percentages that add up to 100', async () => {
      const result = await querySpendingByCategory(db, ama, resolvePeriod(period, timezone))
      const total = result.categories.reduce((sum, row) => sum + row.percentOfTotal, 0)
      expect(total).toBeCloseTo(100, 6)
    })
  })

  describe('budget status', () => {
    it('measures each cap against real spending', async () => {
      const status = await queryBudgetStatus(db, ama, timezone, '2026-10-01')
      expect(status.exists).toBe(true)
      expect(status.totalLimitPesewas).toBe(90_000)

      const transport = status.lines.find(line => line.name === 'Transport')!
      expect(transport.actualPesewas).toBe(40_000)
      expect(transport.isOver).toBe(true)
      expect(transport.remainingPesewas).toBe(-10_000)
    })

    it('names each line and the month by pace status', async () => {
      const status = await queryBudgetStatus(db, ama, timezone, '2026-10-01')
      expect(status.lines.find(line => line.name === 'Transport')!.status).toBe('over')
      // 51,240 of 90,000 is well under the watch threshold.
      expect(status.overallStatus).toBe('on-track')
      const empty = await queryBudgetStatus(db, ama, timezone, '2026-09-01')
      expect(empty.overallStatus).toBe('unbudgeted')
    })

    it('puts the worst overspend first', async () => {
      const status = await queryBudgetStatus(db, ama, timezone, '2026-10-01')
      expect(status.lines[0]!.name).toBe('Transport')
    })

    it('does not let a transfer consume a budget', async () => {
      // GH₵600 into savings is not spending. If it were counted, the totals
      // below would be 60,000 higher.
      const status = await queryBudgetStatus(db, ama, timezone, '2026-10-01')
      expect(status.totalSpentPesewas).toBe(51_240)
    })

    it('includes unbudgeted spending in the total but not in a line', async () => {
      const status = await queryBudgetStatus(db, ama, timezone, '2026-10-01')
      expect(status.lines).toHaveLength(2)
      expect(status.unbudgetedSpend).toHaveLength(1)
      expect(status.unbudgetedSpend[0]!.amountPesewas).toBe(2_500)
      // The headline figure must match the dashboard's, or two screens disagree.
      expect(status.totalSpentPesewas).toBe(8_740 + 40_000 + 2_500)
    })

    it('returns a usable empty status for a month with no budget', async () => {
      // "No budget" is a normal state for a new user, not a 404.
      const status = await queryBudgetStatus(db, ama, timezone, '2026-09-01')
      expect(status.exists).toBe(false)
      expect(status.lines).toEqual([])
      expect(status.totalLimitPesewas).toBe(0)
      expect(status.monthLabel).toBe('September 2026')
    })

    it('reports a past month as fully elapsed and a future one as not started', async () => {
      const past = await queryBudgetStatus(db, ama, timezone, '2020-01-01')
      expect(past.periodElapsedPercent).toBe(100)

      const future = await queryBudgetStatus(db, ama, timezone, '2099-01-01')
      expect(future.periodElapsedPercent).toBe(0)
    })

    it('never shows another user a budget', async () => {
      const status = await queryBudgetStatus(db, kofi, timezone, '2026-10-01')
      expect(status.exists).toBe(false)
      expect(status.totalSpentPesewas).toBe(777_777)
    })
  })

  describe('goals', () => {
    it('keeps real transfers and intent-only entries separate', async () => {
      // Collapsing these would overstate what the user has actually put aside.
      const [goal] = await queryGoals(db, ama, timezone)
      expect(goal!.backedPesewas).toBe(60_000)
      expect(goal!.trackedPesewas).toBe(20_000)
      expect(goal!.actualPesewas).toBe(80_000)
      expect(goal!.entryCount).toBe(2)
    })

    it('suggests a monthly contribution that sums back to what is left', async () => {
      const [goal] = await queryGoals(db, ama, timezone)
      expect(goal!.remainingPesewas).toBe(420_000)
      expect(goal!.monthsRemaining).toBeGreaterThan(0)
      // No pesewa is lost to rounding: the suggestion covers the remainder.
      const covered = goal!.suggestedMonthlyPesewas! * goal!.monthsRemaining!
      expect(covered).toBeGreaterThanOrEqual(goal!.remainingPesewas)
    })

    it('reports what was moved into each goal this month, in the user’s month', async () => {
      // Both entries are dated October; in November they belong to last month.
      const [october] = await queryGoals(db, ama, timezone, new Date('2026-10-20T12:00:00Z'))
      expect(october!.thisMonthPesewas).toBe(80_000)
      const [november] = await queryGoals(db, ama, timezone, new Date('2026-11-03T12:00:00Z'))
      expect(november!.thisMonthPesewas).toBe(0)
    })

    it('counts only real money as committed savings', async () => {
      // The tracked GH₵200 has not moved, so it must not be subtracted from
      // what the user can spend.
      expect(await getCommittedSavings(db, ama)).toBe(60_000)
    })

    it('never shows another user a goal', async () => {
      expect(await queryGoals(db, kofi, timezone)).toEqual([])
      expect(await getCommittedSavings(db, kofi)).toBe(0)
    })

    it('removes a backed entry when its transfer is deleted', async () => {
      // If the money movement is gone, the allocation it represented is gone
      // too — degrading it to a tracked entry would overstate savings.
      const [entry] = await db
        .select({ id: schema.goalEntries.id, txn: schema.goalEntries.linkedTransactionId })
        .from(schema.goalEntries)
        .where(
          and(eq(schema.goalEntries.goalId, goalId), eq(schema.goalEntries.userId, ama))
        )
        .limit(1)

      const linked = entry!.txn ? entry! : null
      if (!linked) return

      await db.delete(schema.transactions).where(eq(schema.transactions.id, linked.txn!))

      const remaining = await db
        .select({ id: schema.goalEntries.id })
        .from(schema.goalEntries)
        .where(eq(schema.goalEntries.id, linked.id))
      expect(remaining).toHaveLength(0)
    })
  })
})
