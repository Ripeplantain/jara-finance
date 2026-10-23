import { formatPercentage, formatPesewas } from './format'
import { percentageOfPesewas, subtractPesewas } from './pesewas'

/**
 * The insight rules — deterministic, pure, and the model's input rather than
 * its output.
 *
 * Jara's rule is that the AI explains numbers it was given and never authors
 * them. These functions are where the observations come from, which is what
 * makes the dashboard's headline claims reproducible and testable: the same
 * ledger always yields the same insights, and each one carries the figures
 * behind it in `payload` so the UI can re-render them with the app's own money
 * formatting instead of parsing them out of prose.
 */

export type InsightKind =
  | 'top_category'
  | 'month_over_month'
  | 'budget_overrun'
  | 'unusual_expense'
  | 'goal_off_track'
  | 'savings_rate'

export type InsightSeverity = 'info' | 'warning' | 'critical'

export interface Insight {
  kind: InsightKind
  severity: InsightSeverity
  /** Stable identity for one observation in one period, for upsert-on-recompute. */
  dedupeKey: string
  title: string
  body: string
  payload: Record<string, unknown>
}

/** Below this share of spending, "your biggest category" isn't worth saying. */
const TOP_CATEGORY_MIN_SHARE = 20
/** Month-over-month moves smaller than this are noise, not news. */
const SIGNIFICANT_CHANGE_PERCENT = 15
/** An expense this many times the category's average is worth a flag. */
const UNUSUAL_EXPENSE_MULTIPLE = 3
/** Saving less than this share of income warrants a nudge. */
const LOW_SAVINGS_RATE_PERCENT = 10

export interface InsightContext {
  currency: string
  periodLabel: string
  previousPeriodLabel: string
  totalExpensePesewas: number
  totalIncomePesewas: number
  previousExpensePesewas: number
  topCategory?: { categoryId: string, name: string, amountPesewas: number }
  budgetOverruns: Array<{
    categoryId: string
    name: string
    limitPesewas: number
    spentPesewas: number
    percentUsed: number
    periodElapsedPercent: number
  }>
  unusualExpenses: Array<{
    transactionId: string
    categoryName: string
    merchant: string | null
    amountPesewas: number
    categoryAveragePesewas: number
  }>
  goalsOffTrack: Array<{
    goalId: string
    name: string
    remainingPesewas: number
    monthsRemaining: number | null
  }>
}

export function deriveInsights(context: InsightContext): Insight[] {
  const money = (value: number) => formatPesewas(value, { currency: context.currency })
  const insights: Insight[] = []

  if (context.topCategory && context.totalExpensePesewas > 0) {
    const share = percentageOfPesewas(
      context.topCategory.amountPesewas,
      context.totalExpensePesewas
    )
    if (share >= TOP_CATEGORY_MIN_SHARE) {
      insights.push({
        kind: 'top_category',
        severity: 'info',
        dedupeKey: `top_category:${context.topCategory.categoryId}`,
        title: `${context.topCategory.name} is your biggest expense`,
        body: `You spent ${money(context.topCategory.amountPesewas)} on ${context.topCategory.name} in ${context.periodLabel} — ${formatPercentage(share)} of everything you spent.`,
        payload: {
          categoryId: context.topCategory.categoryId,
          amountPesewas: context.topCategory.amountPesewas,
          sharePercent: share
        }
      })
    }
  }

  // Month-over-month needs a previous month to compare against. Reporting a
  // first month as an infinite increase would be arithmetically true and
  // useless.
  if (context.previousExpensePesewas > 0 && context.totalExpensePesewas > 0) {
    const change = subtractPesewas(
      context.totalExpensePesewas,
      context.previousExpensePesewas
    )
    const changePercent = percentageOfPesewas(change, context.previousExpensePesewas)

    if (Math.abs(changePercent) >= SIGNIFICANT_CHANGE_PERCENT) {
      const rose = change > 0
      insights.push({
        kind: 'month_over_month',
        severity: rose ? 'warning' : 'info',
        dedupeKey: 'month_over_month',
        title: rose ? 'Spending is up on last month' : 'Spending is down on last month',
        body: `You have spent ${money(Math.abs(change))} ${rose ? 'more' : 'less'} than in ${context.previousPeriodLabel} — ${formatPercentage(Math.abs(changePercent))} ${rose ? 'up' : 'down'}.`,
        payload: {
          changePesewas: change,
          changePercent,
          currentPesewas: context.totalExpensePesewas,
          previousPesewas: context.previousExpensePesewas
        }
      })
    }
  }

  for (const overrun of context.budgetOverruns) {
    // Over the cap outright is critical; merely ahead of the month's pace is a
    // warning. Comparing spend against elapsed time is what stops the app
    // crying wolf on day 2 of the month.
    const isOver = overrun.spentPesewas > overrun.limitPesewas
    const isAheadOfPace = overrun.percentUsed > overrun.periodElapsedPercent + 20

    if (!isOver && !isAheadOfPace) continue

    insights.push({
      kind: 'budget_overrun',
      severity: isOver ? 'critical' : 'warning',
      dedupeKey: `budget_overrun:${overrun.categoryId}`,
      title: isOver
        ? `${overrun.name} is over budget`
        : `${overrun.name} is running ahead of the month`,
      body: isOver
        ? `You have spent ${money(overrun.spentPesewas)} of your ${money(overrun.limitPesewas)} ${overrun.name} budget — ${money(overrun.spentPesewas - overrun.limitPesewas)} over.`
        : `You have used ${formatPercentage(overrun.percentUsed)} of your ${overrun.name} budget but only ${formatPercentage(overrun.periodElapsedPercent)} of the month has passed.`,
      payload: {
        categoryId: overrun.categoryId,
        limitPesewas: overrun.limitPesewas,
        spentPesewas: overrun.spentPesewas,
        percentUsed: overrun.percentUsed,
        periodElapsedPercent: overrun.periodElapsedPercent
      }
    })
  }

  for (const expense of context.unusualExpenses) {
    const multiple = expense.categoryAveragePesewas === 0
      ? 0
      : expense.amountPesewas / expense.categoryAveragePesewas
    if (multiple < UNUSUAL_EXPENSE_MULTIPLE) continue

    insights.push({
      kind: 'unusual_expense',
      severity: 'info',
      dedupeKey: `unusual_expense:${expense.transactionId}`,
      title: `A large ${expense.categoryName} expense`,
      body: `${expense.merchant ?? 'An expense'} of ${money(expense.amountPesewas)} is about ${Math.round(multiple)}× your usual ${expense.categoryName} spend of ${money(expense.categoryAveragePesewas)}.`,
      payload: {
        transactionId: expense.transactionId,
        amountPesewas: expense.amountPesewas,
        categoryAveragePesewas: expense.categoryAveragePesewas,
        multiple
      }
    })
  }

  for (const goal of context.goalsOffTrack) {
    insights.push({
      kind: 'goal_off_track',
      severity: 'warning',
      dedupeKey: `goal_off_track:${goal.goalId}`,
      title: `${goal.name} needs attention`,
      body: goal.monthsRemaining === null || goal.monthsRemaining === 0
        ? `${goal.name} is past its date with ${money(goal.remainingPesewas)} still to save.`
        : `To hit ${goal.name} on time you need about ${money(Math.ceil(goal.remainingPesewas / goal.monthsRemaining))} a month for the next ${goal.monthsRemaining} month${goal.monthsRemaining === 1 ? '' : 's'}.`,
      payload: {
        goalId: goal.goalId,
        remainingPesewas: goal.remainingPesewas,
        monthsRemaining: goal.monthsRemaining
      }
    })
  }

  if (context.totalIncomePesewas > 0) {
    const net = subtractPesewas(context.totalIncomePesewas, context.totalExpensePesewas)
    const rate = percentageOfPesewas(net, context.totalIncomePesewas)

    if (rate < LOW_SAVINGS_RATE_PERCENT) {
      insights.push({
        kind: 'savings_rate',
        severity: net < 0 ? 'critical' : 'warning',
        dedupeKey: 'savings_rate',
        title: net < 0 ? 'You spent more than you earned' : 'You are keeping very little',
        body: net < 0
          ? `In ${context.periodLabel} you spent ${money(Math.abs(net))} more than you earned.`
          : `You kept ${money(net)} of the ${money(context.totalIncomePesewas)} you earned in ${context.periodLabel} — ${formatPercentage(rate)}.`,
        payload: {
          netPesewas: net,
          incomePesewas: context.totalIncomePesewas,
          savingsRatePercent: rate
        }
      })
    }
  }

  return insights
}
