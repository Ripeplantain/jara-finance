import { and, desc, eq, gte, isNull, lte, sql } from 'drizzle-orm'
import { deriveInsights, type Insight } from '#shared/money/insights'
import { addMonths, resolvePeriod } from '#shared/period/month'
import { assertSafePesewas } from '#shared/money/pesewas'
import { categories, insights, transactions } from '../database/schema'
import { queryBudgetStatus } from './budgets'
import { queryPeriodTotals, querySpendingByCategory } from './summary'
import { queryGoals } from './goals'

/**
 * Computes the deterministic insights for a period and persists them.
 *
 * Persisted rather than computed on every read for one reason: dismissals have
 * to stick. The unique index on `(userId, periodStart, dedupeKey)` makes a
 * recompute an upsert, so re-running this does not resurrect something the user
 * dismissed, and does not pile up duplicates.
 */
export async function refreshInsights(userId: string, timezone: string) {
  const db = useDb()
  const period = resolvePeriod({ kind: 'this_month' }, timezone)
  const previousPeriod = resolvePeriod({ kind: 'last_month' }, timezone)

  const [totals, previousTotals, spending, budget, goals] = await Promise.all([
    queryPeriodTotals(db, userId, period),
    queryPeriodTotals(db, userId, previousPeriod),
    querySpendingByCategory(db, userId, period),
    queryBudgetStatus(db, userId, timezone),
    queryGoals(db, userId, timezone)
  ])

  const unusualExpenses = await findUnusualExpenses(userId, period.start, period.end)

  const derived = deriveInsights({
    currency: 'GHS',
    periodLabel: period.label,
    previousPeriodLabel: previousPeriod.label,
    totalExpensePesewas: totals.expensePesewas,
    totalIncomePesewas: totals.incomePesewas,
    previousExpensePesewas: previousTotals.expensePesewas,
    topCategory: spending.categories[0]?.categoryId
      ? {
          categoryId: spending.categories[0].categoryId,
          name: spending.categories[0].name,
          amountPesewas: spending.categories[0].amountPesewas
        }
      : undefined,
    budgetOverruns: budget.lines.map(line => ({
      categoryId: line.categoryId,
      name: line.name,
      limitPesewas: line.targetPesewas,
      spentPesewas: line.actualPesewas,
      percentUsed: line.percentUsed,
      periodElapsedPercent: budget.periodElapsedPercent
    })),
    unusualExpenses,
    goalsOffTrack: goals
      .filter(goal => goal.status === 'active' && goal.isBehind)
      .map(goal => ({
        goalId: goal.id,
        name: goal.name,
        remainingPesewas: goal.remainingPesewas,
        monthsRemaining: goal.monthsRemaining
      }))
  })

  if (derived.length > 0) {
    await persistInsights(userId, period.start, derived)
  }

  return listInsights(userId, timezone)
}

async function persistInsights(userId: string, periodStart: string, derived: Insight[]) {
  await useDb()
    .insert(insights)
    .values(
      derived.map(insight => ({
        userId,
        kind: insight.kind,
        severity: insight.severity,
        periodStart,
        dedupeKey: insight.dedupeKey,
        title: insight.title,
        body: insight.body,
        payload: insight.payload
      }))
    )
    .onConflictDoUpdate({
      target: [insights.userId, insights.periodStart, insights.dedupeKey],
      set: {
        // The text and figures follow the current ledger, but `dismissedAt` is
        // deliberately absent from this SET: recomputing must not un-dismiss
        // something the user has already waved away.
        severity: sql`excluded.severity`,
        title: sql`excluded.title`,
        body: sql`excluded.body`,
        payload: sql`excluded.payload`
      }
    })
}

/** Undismissed insights for the current month, most severe first. */
export async function listInsights(userId: string, timezone: string) {
  const period = resolvePeriod({ kind: 'this_month' }, timezone)

  return useDb()
    .select({
      id: insights.id,
      kind: insights.kind,
      severity: insights.severity,
      title: insights.title,
      body: insights.body,
      payload: insights.payload,
      createdAt: insights.createdAt
    })
    .from(insights)
    .where(
      and(
        eq(insights.userId, userId),
        eq(insights.periodStart, period.start),
        isNull(insights.dismissedAt)
      )
    )
    .orderBy(
      // critical → warning → info, then newest.
      sql`case ${insights.severity} when 'critical' then 0 when 'warning' then 1 else 2 end`,
      desc(insights.createdAt)
    )
}

export async function dismissInsight(userId: string, insightId: string) {
  const [row] = await useDb()
    .update(insights)
    .set({ dismissedAt: new Date() })
    .where(and(eq(insights.id, insightId), eq(insights.userId, userId)))
    .returning({ id: insights.id })

  if (!row) {
    throw createError({ statusCode: 404, statusMessage: 'Insight not found' })
  }

  return { dismissed: true }
}

/**
 * Expenses far above their own category's running average.
 *
 * The average is taken over the twelve months *before* the period being
 * examined, so a single large expense cannot inflate the baseline it is being
 * judged against. Categories with fewer than three prior expenses are skipped:
 * an "average" of one transaction flags everything as unusual.
 */
async function findUnusualExpenses(userId: string, periodStart: string, periodEnd: string) {
  const baselineStart = addMonths(periodStart, -12)

  const rows = await useDb()
    .select({
      transactionId: transactions.id,
      merchant: transactions.merchant,
      amountPesewas: transactions.amountPesewas,
      categoryName: categories.name,
      categoryAverage: sql<string>`(
        select avg(prior.amount_pesewas)
        from transactions prior
        where prior.user_id = ${userId}
          and prior.category_id = ${transactions.categoryId}
          and prior.type = 'expense'
          and prior.occurred_on >= ${baselineStart}
          and prior.occurred_on < ${periodStart}
      )::text`,
      priorCount: sql<string>`(
        select count(*)
        from transactions prior
        where prior.user_id = ${userId}
          and prior.category_id = ${transactions.categoryId}
          and prior.type = 'expense'
          and prior.occurred_on >= ${baselineStart}
          and prior.occurred_on < ${periodStart}
      )::text`
    })
    .from(transactions)
    .innerJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.occurredOn, periodStart),
        lte(transactions.occurredOn, periodEnd)
      )
    )
    .orderBy(desc(transactions.amountPesewas))
    // Only the largest few can plausibly be outliers, and the subqueries above
    // are not free.
    .limit(5)

  return rows
    .filter(row => Number(row.priorCount) >= 3 && row.categoryAverage !== null)
    .map(row => ({
      transactionId: row.transactionId,
      categoryName: row.categoryName,
      merchant: row.merchant,
      amountPesewas: assertSafePesewas(row.amountPesewas, 'amountPesewas'),
      // The average is a float from Postgres; rounded to whole pesewas before
      // it touches the money path.
      categoryAveragePesewas: Math.round(Number(row.categoryAverage))
    }))
}
