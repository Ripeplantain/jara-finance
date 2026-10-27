import { and, desc, eq, gte, lte, ne, sql } from 'drizzle-orm'
import { addPesewas, assertSafePesewas, subtractPesewas } from '#shared/money/pesewas'
import { endOfMonth, resolvePeriod, startOfMonth, todayInTimezone, type Period, type PeriodKind } from '#shared/period/month'
import type { IsoDate } from '#shared/period/dates'
import { lastMonthsWindow } from '#shared/period/series'
import type { DashboardRange } from '#shared/schemas/reports'
import { categories, goalEntries, transactions } from '../database/schema'
import type { Database } from '../types/database'
import { getLiquidBalance } from './balances'

/**
 * Reporting aggregates: period totals and the spending breakdown.
 *
 * Every aggregate here filters `type <> 'transfer'` or names `income`/`expense`
 * explicitly. That single predicate is the difference between a correct report
 * and one where moving GH₵600 into savings shows up as GH₵600 of income *and*
 * GH₵600 of spending. It is restated in each query rather than factored into a
 * shared helper precisely because forgetting it is the bug this module exists
 * to prevent — an integration test asserts it.
 */

/** `sum()` over `bigint` arrives as a string; cast and range-check it. */
function sumAmount(type: 'income' | 'expense') {
  return sql<string>`coalesce(sum(case when ${transactions.type} = ${type} then ${transactions.amountPesewas} else 0 end), 0)::text`
}

function toPesewas(value: string | null, label: string): number {
  return assertSafePesewas(Number(value ?? 0), label)
}

export interface PeriodTotals {
  period: Period
  incomePesewas: number
  expensePesewas: number
  /** income − expense. Excludes transfers entirely. */
  netPesewas: number
  /** Share of income kept. 0 when there was no income — not Infinity. */
  savingsRatePercent: number
  transactionCount: number
}

export async function getPeriodTotals(
  userId: string,
  timezone: string,
  kind: PeriodKind = 'this_month',
  custom?: { start?: IsoDate, end?: IsoDate }
): Promise<PeriodTotals> {
  const period = resolvePeriod({ kind, ...custom }, timezone)
  return queryPeriodTotals(useDb(), userId, period)
}

export async function queryPeriodTotals(
  db: Database,
  userId: string,
  period: Period
): Promise<PeriodTotals> {
  const [row] = await db
    .select({
      income: sumAmount('income'),
      expense: sumAmount('expense'),
      // Transfers are excluded from the count too: the list a user reasons
      // about is "things I earned or spent", and a transfer is neither.
      count: sql<string>`count(*) filter (where ${transactions.type} <> 'transfer')::text`
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, period.start),
        lte(transactions.occurredOn, period.end)
      )
    )

  const incomePesewas = toPesewas(row?.income ?? '0', 'incomePesewas')
  const expensePesewas = toPesewas(row?.expense ?? '0', 'expensePesewas')
  const netPesewas = subtractPesewas(incomePesewas, expensePesewas)

  return {
    period,
    incomePesewas,
    expensePesewas,
    netPesewas,
    savingsRatePercent: incomePesewas === 0 ? 0 : (netPesewas / incomePesewas) * 100,
    transactionCount: Number(row?.count ?? 0)
  }
}

export interface CategorySpend {
  categoryId: string | null
  name: string
  icon: string
  colorIndex: number
  amountPesewas: number
  /** Share of total spending in the period. */
  percentOfTotal: number
  transactionCount: number
}

/**
 * Spending by category, largest first — the dashboard donut and the AI's
 * "where did my money go" tool.
 *
 * Uncategorised expenses are returned as a real row with a null id rather than
 * dropped, so the slices always sum to the period's expense total. Hiding them
 * would make the chart quietly disagree with the headline figure.
 */
export async function getSpendingByCategory(
  userId: string,
  timezone: string,
  kind: PeriodKind = 'this_month',
  custom?: { start?: IsoDate, end?: IsoDate }
): Promise<{ period: Period, totalPesewas: number, categories: CategorySpend[] }> {
  const period = resolvePeriod({ kind, ...custom }, timezone)
  return querySpendingByCategory(useDb(), userId, period)
}

export async function querySpendingByCategory(
  db: Database,
  userId: string,
  period: Period
): Promise<{ period: Period, totalPesewas: number, categories: CategorySpend[] }> {
  const rows = await db
    .select({
      categoryId: categories.id,
      name: categories.name,
      icon: categories.icon,
      colorIndex: categories.colorIndex,
      amount: sql<string>`sum(${transactions.amountPesewas})::text`,
      count: sql<string>`count(*)::text`
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.occurredOn, period.start),
        lte(transactions.occurredOn, period.end)
      )
    )
    .groupBy(categories.id, categories.name, categories.icon, categories.colorIndex)
    .orderBy(desc(sql`sum(${transactions.amountPesewas})`))

  const breakdown = rows.map(row => ({
    categoryId: row.categoryId,
    name: row.name ?? 'Uncategorised',
    icon: row.icon ?? 'circle-help',
    colorIndex: row.colorIndex ?? 6,
    amountPesewas: toPesewas(row.amount, 'amountPesewas'),
    percentOfTotal: 0,
    transactionCount: Number(row.count)
  }))

  const totalPesewas = breakdown.reduce(
    (total, row) => addPesewas(total, row.amountPesewas),
    0
  )

  for (const row of breakdown) {
    row.percentOfTotal = totalPesewas === 0 ? 0 : (row.amountPesewas / totalPesewas) * 100
  }

  return { period, totalPesewas, categories: breakdown }
}

/**
 * A daily income/expense series for the period — the dashboard trend chart.
 *
 * Returns only days that have activity; the client fills the gaps. Generating a
 * zero row per day in SQL would mean a `generate_series` join for data the chart
 * can interpolate for free.
 */
export async function getDailyFlow(
  userId: string,
  timezone: string,
  kind: PeriodKind = 'this_month',
  custom?: { start?: IsoDate, end?: IsoDate }
) {
  const period = resolvePeriod({ kind, ...custom }, timezone)

  const rows = await useDb()
    .select({
      day: transactions.occurredOn,
      income: sumAmount('income'),
      expense: sumAmount('expense')
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        ne(transactions.type, 'transfer'),
        gte(transactions.occurredOn, period.start),
        lte(transactions.occurredOn, period.end)
      )
    )
    .groupBy(transactions.occurredOn)
    .orderBy(transactions.occurredOn)

  return {
    period,
    days: rows.map(row => ({
      day: row.day,
      incomePesewas: toPesewas(row.income, 'incomePesewas'),
      expensePesewas: toPesewas(row.expense, 'expensePesewas')
    }))
  }
}

/**
 * Money moved into goals inside a window: every contribution dated there,
 * backed or tracked, which is the figure goal progress itself counts. Not a
 * transaction total — a backed contribution's transfer is already excluded from
 * income and spending above.
 */
export async function querySavedInPeriod(
  db: Database,
  userId: string,
  period: Pick<Period, 'start' | 'end'>
): Promise<number> {
  const [row] = await db
    .select({ saved: sql<string>`coalesce(sum(${goalEntries.amountPesewas}), 0)::text` })
    .from(goalEntries)
    .where(
      and(
        eq(goalEntries.userId, userId),
        gte(goalEntries.occurredOn, period.start),
        lte(goalEntries.occurredOn, period.end)
      )
    )
  return toPesewas(row?.saved ?? '0', 'savedPesewas')
}

/**
 * Everything the dashboard needs, in one round trip.
 *
 * `range` is additive: the default is this month, exactly as before. `last_6_months`
 * totals six whole calendar months, but the category breakdown stays on the
 * latest month — six months of categories would bury the one that moved.
 */
export async function getDashboard(
  userId: string,
  timezone: string,
  range: DashboardRange = 'this_month',
  month?: IsoDate
) {
  const db = useDb()
  const today = todayInTimezone(timezone)
  // With a month chosen, "the month" is that one whatever `range` says (the
  // legacy `last_month` included); only `last_6_months` widens the totals.
  const anchor = month ? startOfMonth(month) : null
  const monthPeriod: Pick<Period, 'start' | 'end'> | null = anchor
    ? { start: anchor, end: endOfMonth(anchor) }
    : null

  const totalsPeriod: Period = range === 'last_6_months'
    ? resolvePeriod({ kind: 'custom', ...lastMonthsWindow(anchor ?? today, 6) }, timezone)
    : monthPeriod
      ? resolvePeriod({ kind: 'custom', ...monthPeriod }, timezone)
      : resolvePeriod({ kind: range }, timezone)
  const monthKind: PeriodKind = range === 'last_month' ? 'last_month' : 'this_month'
  const monthCustom = monthPeriod ?? undefined
  const kindForMonth: PeriodKind = monthPeriod ? 'custom' : monthKind

  const [liquid, totals, spending, flow, saved] = await Promise.all([
    getLiquidBalance(userId),
    queryPeriodTotals(db, userId, totalsPeriod),
    getSpendingByCategory(userId, timezone, kindForMonth, monthCustom),
    getDailyFlow(userId, timezone, kindForMonth, monthCustom),
    querySavedInPeriod(db, userId, totalsPeriod)
  ])

  return {
    range,
    liquidPesewas: liquid.liquidPesewas,
    currency: liquid.currency,
    accounts: liquid.accounts,
    totals,
    savedPesewas: saved,
    spending,
    flow: flow.days
  }
}
