import { and, asc, eq, gte, lte, sql } from 'drizzle-orm'
import type { MonthTotalsQuery } from '#shared/schemas/reports'
import { assertSafePesewas } from '#shared/money/pesewas'
import {
  compareSpend,
  cumulativeSeries,
  fillMonthlySeries,
  type MonthTotal,
  type SpendDirection
} from '#shared/money/series'
import {
  parseIsoDate,
  resolvePeriod,
  todayInTimezone,
  type IsoDate,
  type Period
} from '#shared/period/month'
import { lastMonthStarts, lastMonthsWindow, monthKey, shortMonthLabel } from '#shared/period/series'
import { goalEntries, transactions } from '../database/schema'
import type { Database } from '../types/database'
import { querySpendingByCategory } from './summary'

/**
 * Read-only series behind the dashboard chart, the Insights screen and the
 * month headings on the ledger.
 *
 * Every query filters `user_id` in its WHERE clause, restates the transfer
 * exclusion (a transfer is never income or expense) and returns integer
 * pesewas. Period edges come from the user's own timezone via `todayInTimezone`;
 * nothing here asks the server what day it is.
 */

const monthOf = (column: typeof transactions.occurredOn | typeof goalEntries.occurredOn) =>
  sql<string>`to_char(${column}, 'YYYY-MM')`

const toPesewas = (value: string | null, label: string) => assertSafePesewas(Number(value ?? 0), label)

export interface MonthlyPoint extends MonthTotal {
  /** `May`. */
  label: string
}

/**
 * Income, spending and money moved into goals for each of the last `count`
 * months, oldest first. Months with no activity are present as zeros.
 *
 * "Moved into goals" is every goal contribution dated in the month, backed or
 * tracked: it is the same figure the goals' own progress counts.
 */
export async function queryMonthlySeries(
  db: Database,
  userId: string,
  timezone: string,
  count = 6,
  now: Date = new Date()
): Promise<{ months: MonthlyPoint[] }> {
  const today = todayInTimezone(timezone, now)
  const starts = lastMonthStarts(today, count)
  const { start, end } = lastMonthsWindow(today, count)

  const flowMonth = monthOf(transactions.occurredOn)
  const flowRows = await db
    .select({
      month: flowMonth,
      income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountPesewas} else 0 end), 0)::text`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountPesewas} else 0 end), 0)::text`
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.type} <> 'transfer'`,
        gte(transactions.occurredOn, start),
        lte(transactions.occurredOn, end)
      )
    )
    .groupBy(flowMonth)

  const savedMonth = monthOf(goalEntries.occurredOn)
  const savedRows = await db
    .select({
      month: savedMonth,
      saved: sql<string>`coalesce(sum(${goalEntries.amountPesewas}), 0)::text`
    })
    .from(goalEntries)
    .where(
      and(
        eq(goalEntries.userId, userId),
        gte(goalEntries.occurredOn, start),
        lte(goalEntries.occurredOn, end)
      )
    )
    .groupBy(savedMonth)

  const merged = new Map<string, Partial<MonthTotal> & { month: string }>()
  for (const row of flowRows) {
    merged.set(row.month, {
      month: row.month,
      incomePesewas: toPesewas(row.income, 'incomePesewas'),
      expensePesewas: toPesewas(row.expense, 'expensePesewas')
    })
  }
  for (const row of savedRows) {
    merged.set(row.month, {
      ...(merged.get(row.month) ?? { month: row.month }),
      savedPesewas: toPesewas(row.saved, 'savedPesewas')
    })
  }

  const series = fillMonthlySeries(starts.map(monthKey), [...merged.values()])
  return {
    months: series.map((point, index) => ({ ...point, label: shortMonthLabel(starts[index]!) }))
  }
}

export interface DailySpendPoint {
  day: number
  spendPesewas: number
  /** Running total of spending through this day. */
  cumulativePesewas: number
}

/**
 * Spending for each day of the current month up to and including today, with a
 * running total. Days with no spending are zeros so the line is continuous.
 */
export async function queryDailySpend(
  db: Database,
  userId: string,
  timezone: string,
  now: Date = new Date()
): Promise<{ month: IsoDate, monthLabel: string, days: DailySpendPoint[] }> {
  const today = todayInTimezone(timezone, now)
  const period = resolvePeriod({ kind: 'this_month' }, timezone, now)

  const rows = await db
    .select({
      day: transactions.occurredOn,
      spend: sql<string>`sum(${transactions.amountPesewas})::text`
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.occurredOn, period.start),
        lte(transactions.occurredOn, today)
      )
    )
    .groupBy(transactions.occurredOn)
    .orderBy(asc(transactions.occurredOn))

  const spendByDay = new Map(rows.map(row => [parseIsoDate(row.day).day, toPesewas(row.spend, 'spendPesewas')]))
  const dayCount = parseIsoDate(today).day
  const perDay = Array.from({ length: dayCount }, (_, index) => spendByDay.get(index + 1) ?? 0)
  const running = cumulativeSeries(perDay)

  return {
    month: period.start,
    monthLabel: period.label,
    days: perDay.map((spendPesewas, index) => ({
      day: index + 1,
      spendPesewas,
      cumulativePesewas: running[index]!
    }))
  }
}

export interface CategoryComparisonRow {
  categoryId: string | null
  name: string
  icon: string
  colorIndex: number
  currentPesewas: number
  previousPesewas: number
  direction: SpendDirection
}

/** Category spending this month beside last month, largest this month first. */
export async function queryCategoryComparison(
  db: Database,
  userId: string,
  timezone: string,
  now: Date = new Date()
): Promise<{ current: Period, previous: Period, rows: CategoryComparisonRow[] }> {
  const current = resolvePeriod({ kind: 'this_month' }, timezone, now)
  const previous = resolvePeriod({ kind: 'last_month' }, timezone, now)
  const [currentSpend, before] = await Promise.all([
    querySpendingByCategory(db, userId, current),
    querySpendingByCategory(db, userId, previous)
  ])

  const keyOf = (id: string | null) => id ?? 'uncategorised'
  const merged = new Map<string, CategoryComparisonRow>()
  for (const row of before.categories) {
    merged.set(keyOf(row.categoryId), {
      categoryId: row.categoryId,
      name: row.name,
      icon: row.icon,
      colorIndex: row.colorIndex,
      currentPesewas: 0,
      previousPesewas: row.amountPesewas,
      direction: 'less'
    })
  }
  for (const row of currentSpend.categories) {
    const key = keyOf(row.categoryId)
    const existing = merged.get(key)
    merged.set(key, {
      categoryId: row.categoryId,
      name: row.name,
      icon: row.icon,
      colorIndex: row.colorIndex,
      currentPesewas: row.amountPesewas,
      previousPesewas: existing?.previousPesewas ?? 0,
      direction: 'more'
    })
  }

  const rows = [...merged.values()]
    .map(row => ({ ...row, direction: compareSpend(row.currentPesewas, row.previousPesewas) }))
    .sort((a, b) => b.currentPesewas - a.currentPesewas || b.previousPesewas - a.previousPesewas)

  return { current, previous, rows }
}

export interface MonthTotalsRow {
  month: string
  incomePesewas: number
  expensePesewas: number
}

/**
 * In and out for each calendar month that has activity in the period, newest
 * first — the totals beside a month heading on the ledger. Transfers are
 * neither, so they never appear in either figure.
 */
export async function queryTransactionMonthTotals(
  db: Database,
  userId: string,
  timezone: string,
  query: MonthTotalsQuery,
  now: Date = new Date()
): Promise<{ period: Period, months: MonthTotalsRow[] }> {
  const period = resolvePeriod({ kind: query.period, start: query.start, end: query.end }, timezone, now)
  const month = monthOf(transactions.occurredOn)

  const rows = await db
    .select({
      month,
      income: sql<string>`coalesce(sum(case when ${transactions.type} = 'income' then ${transactions.amountPesewas} else 0 end), 0)::text`,
      expense: sql<string>`coalesce(sum(case when ${transactions.type} = 'expense' then ${transactions.amountPesewas} else 0 end), 0)::text`
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        sql`${transactions.type} <> 'transfer'`,
        gte(transactions.occurredOn, period.start),
        lte(transactions.occurredOn, period.end),
        query.accountId ? eq(transactions.accountId, query.accountId) : undefined
      )
    )
    .groupBy(month)
    .orderBy(sql`${month} desc`)

  return {
    period,
    months: rows.map(row => ({
      month: row.month,
      incomePesewas: toPesewas(row.income, 'incomePesewas'),
      expensePesewas: toPesewas(row.expense, 'expensePesewas')
    }))
  }
}
