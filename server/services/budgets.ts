import { and, eq, gte, inArray, lte, sql } from 'drizzle-orm'
import type { UpsertBudgetInput } from '#shared/schemas/budgets'
import { addPesewas, assertSafePesewas } from '#shared/money/pesewas'
import { deriveProgress, periodElapsedPercentage, type Progress } from '#shared/money/progress'
import {
  budgetPeriodFor,
  currentBudgetPeriod,
  daysBetweenInclusive,
  monthLabel,
  todayInTimezone,
  compareIsoDates,
  type IsoDate
} from '#shared/period/month'
import { budgetAllocations, budgets, categories, transactions } from '../database/schema'
import type { Database } from '../types/database'

/**
 * Budgets are monthly snapshots — exactly one per user per month, which is what
 * makes "what is my limit for Food right now?" have a single answer.
 *
 * Nothing about a budget's *progress* is stored. Actual spend is always
 * re-aggregated from the ledger, so editing a transaction immediately and
 * necessarily changes the budget that covers it.
 */

export interface BudgetLine extends Progress {
  categoryId: string
  name: string
  icon: string
  colorIndex: number
}

export interface BudgetStatus {
  month: IsoDate
  monthLabel: string
  periodStart: IsoDate
  periodEnd: IsoDate
  exists: boolean
  note: string | null
  totalLimitPesewas: number
  totalSpentPesewas: number
  overall: Progress
  /** How far through the month we are, so "60% spent" can be judged in context. */
  periodElapsedPercent: number
  lines: BudgetLine[]
  /** Expense categories with spending this month but no cap set. */
  unbudgetedSpend: Array<{
    categoryId: string | null
    name: string
    icon: string
    colorIndex: number
    amountPesewas: number
  }>
}

/**
 * The budget for a month, with live progress.
 *
 * Returns a usable, empty status when no budget exists rather than a 404: the
 * UI's job in that case is to offer to create one, and "no budget" is a normal
 * state for a new user, not an error.
 */
export async function getBudgetStatus(
  userId: string,
  timezone: string,
  month?: IsoDate
): Promise<BudgetStatus> {
  return queryBudgetStatus(useDb(), userId, timezone, month)
}

export async function queryBudgetStatus(
  db: Database,
  userId: string,
  timezone: string,
  month?: IsoDate
): Promise<BudgetStatus> {
  const { periodStart, periodEnd } = month
    ? budgetPeriodFor(month)
    : currentBudgetPeriod(timezone)

  const [budget] = await db
    .select({ id: budgets.id, note: budgets.note })
    .from(budgets)
    .where(and(eq(budgets.userId, userId), eq(budgets.periodStart, periodStart)))
    .limit(1)

  const allocations = budget
    ? await db
        .select({
          categoryId: budgetAllocations.categoryId,
          limitPesewas: budgetAllocations.limitPesewas,
          name: categories.name,
          icon: categories.icon,
          colorIndex: categories.colorIndex
        })
        .from(budgetAllocations)
        .innerJoin(categories, eq(categories.id, budgetAllocations.categoryId))
        .where(eq(budgetAllocations.budgetId, budget.id))
    : []

  // Actual spend for the month, per category. Expenses only — a transfer into
  // savings is not spending and must never consume a budget line.
  const spendRows = await db
    .select({
      categoryId: transactions.categoryId,
      name: categories.name,
      icon: categories.icon,
      colorIndex: categories.colorIndex,
      amount: sql<string>`sum(${transactions.amountPesewas})::text`
    })
    .from(transactions)
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.type, 'expense'),
        gte(transactions.occurredOn, periodStart),
        lte(transactions.occurredOn, periodEnd)
      )
    )
    .groupBy(transactions.categoryId, categories.name, categories.icon, categories.colorIndex)

  const spentByCategory = new Map<string | null, number>()
  for (const row of spendRows) {
    spentByCategory.set(row.categoryId, assertSafePesewas(Number(row.amount), 'spent'))
  }

  const lines: BudgetLine[] = allocations
    .map(allocation => ({
      categoryId: allocation.categoryId,
      name: allocation.name,
      icon: allocation.icon,
      colorIndex: allocation.colorIndex,
      ...deriveProgress(
        spentByCategory.get(allocation.categoryId) ?? 0,
        allocation.limitPesewas
      )
    }))
    // Worst overspend first: the line that needs attention leads the list.
    .sort((a, b) => b.percentUsed - a.percentUsed)

  const budgetedIds = new Set(allocations.map(allocation => allocation.categoryId))
  const unbudgetedSpend = spendRows
    .filter(row => !budgetedIds.has(row.categoryId ?? ''))
    .map(row => ({
      categoryId: row.categoryId,
      name: row.name ?? 'Uncategorised',
      icon: row.icon ?? 'circle-help',
      colorIndex: row.colorIndex ?? 6,
      amountPesewas: assertSafePesewas(Number(row.amount), 'amountPesewas')
    }))
    .sort((a, b) => b.amountPesewas - a.amountPesewas)

  const totalLimitPesewas = allocations.reduce(
    (total, allocation) => addPesewas(total, allocation.limitPesewas),
    0
  )
  // Every expense in the month, budgeted or not: the headline "spent" figure
  // must match what the dashboard says, or the two screens contradict.
  const totalSpentPesewas = spendRows.reduce(
    (total, row) => addPesewas(total, assertSafePesewas(Number(row.amount), 'spent')),
    0
  )

  const today = todayInTimezone(timezone)
  const totalDays = daysBetweenInclusive(periodStart, periodEnd)
  // A past month is fully elapsed; a future one, not at all.
  const elapsedDays =
    compareIsoDates(today, periodStart) < 0
      ? 0
      : compareIsoDates(today, periodEnd) > 0
        ? totalDays
        : daysBetweenInclusive(periodStart, today)

  return {
    month: periodStart,
    monthLabel: monthLabel(periodStart),
    periodStart,
    periodEnd,
    exists: Boolean(budget),
    note: budget?.note ?? null,
    totalLimitPesewas,
    totalSpentPesewas,
    overall: deriveProgress(totalSpentPesewas, totalLimitPesewas),
    periodElapsedPercent: periodElapsedPercentage(elapsedDays, totalDays),
    lines,
    unbudgetedSpend
  }
}

/**
 * Creates or replaces a month's budget and its allocations, atomically.
 *
 * The allocation list is replaced wholesale rather than diffed. Delete-then-
 * insert inside one transaction is both simpler and safer than reconciling
 * three cases (added, changed, removed) against the unique index — and it means
 * "remove this cap" needs no separate endpoint.
 */
export async function upsertBudget(userId: string, input: UpsertBudgetInput) {
  const db = useDb()
  const { periodStart, periodEnd } = budgetPeriodFor(input.month)

  // Only expense categories can be capped. A CHECK constraint can't reach
  // `categories.kind` from `budget_allocations`, so it is enforced here.
  if (input.allocations.length > 0) {
    const ids = input.allocations.map(allocation => allocation.categoryId)
    const usable = await db
      .select({ id: categories.id, kind: categories.kind, userId: categories.userId })
      .from(categories)
      .where(inArray(categories.id, ids))

    for (const id of ids) {
      const category = usable.find(row => row.id === id)
      if (!category || (category.userId !== null && category.userId !== userId)) {
        throw createError({ statusCode: 404, statusMessage: 'That category does not exist' })
      }
      if (category.kind !== 'expense') {
        throw createError({
          statusCode: 400,
          statusMessage: 'Only expense categories can have a spending limit'
        })
      }
    }
  }

  return db.transaction(async (tx) => {
    const [budget] = await tx
      .insert(budgets)
      .values({ userId, periodStart, periodEnd, note: input.note })
      .onConflictDoUpdate({
        target: [budgets.userId, budgets.periodStart],
        set: { note: input.note, periodEnd, updatedAt: new Date() }
      })
      .returning()

    await tx.delete(budgetAllocations).where(eq(budgetAllocations.budgetId, budget!.id))

    if (input.allocations.length > 0) {
      await tx.insert(budgetAllocations).values(
        input.allocations.map(allocation => ({
          budgetId: budget!.id,
          categoryId: allocation.categoryId,
          limitPesewas: allocation.limit
        }))
      )
    }

    return budget!
  })
}
