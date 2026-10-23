import { tool } from 'ai'
import { z } from 'zod'
import { PERIOD_KINDS, resolvePeriod, todayInTimezone } from '#shared/period/month'
import { parseAmountToPesewas } from '#shared/money/pesewas'
import { getLiquidBalance } from '../../services/balances'
import { getBudgetStatus } from '../../services/budgets'
import { listGoals } from '../../services/goals'
import { getPeriodTotals, getSpendingByCategory } from '../../services/summary'
import { listTransactions } from '../../services/transactions'
import { checkAffordability } from '../../services/affordability'
import type { SaloProfile } from '../../utils/session'

/**
 * The tools Salo may call.
 *
 * Three properties make this set safe to expose to a model:
 *
 * 1. **Every tool is read-only.** None writes, deletes or moves money. The
 *    model cannot act on the user's ledger, only describe it. A write tool
 *    would mean a prompt injection — in a transaction note, say — could spend
 *    someone's money.
 * 2. **Every tool is scoped to one `userId`**, bound here by closure and never
 *    taken as a parameter. A model-supplied `userId` would be a cross-tenant
 *    leak one hallucination away.
 * 3. **Every tool returns computed figures**, so the model never has to do
 *    arithmetic. That is enforced by the prompt, but it only works because the
 *    numbers it needs are all actually available.
 *
 * Periods resolve against the user's own timezone inside each tool, so the
 * model cannot accidentally ask about the server's idea of "this month".
 */

const periodParameter = z
  .enum(PERIOD_KINDS)
  .default('this_month')
  .describe('Which window to report on. Defaults to the current calendar month.')

export function buildTools(userId: string, profile: SaloProfile) {
  const timezone = profile.timezone

  return {
    getBalances: tool({
      description:
        'Current balance of every one of the user\'s accounts, plus their total liquid money. Use for "how much do I have", "what is in my MoMo", or before discussing a purchase.',
      inputSchema: z.object({}),
      execute: async () => {
        const { liquidPesewas, currency, accounts } = await getLiquidBalance(userId)
        return {
          currency,
          liquidPesewas,
          accounts: accounts.map(account => ({
            name: account.name,
            type: account.type,
            institution: account.institution,
            balancePesewas: account.balancePesewas
          }))
        }
      }
    }),

    getPeriodSummary: tool({
      description:
        'Total income, total expenses, net and savings rate for a period. Use for "how did I do this month" or "did I spend more than I earned".',
      inputSchema: z.object({ period: periodParameter }),
      execute: async ({ period }) => {
        const totals = await getPeriodTotals(userId, timezone, period)
        return {
          period: totals.period.label,
          start: totals.period.start,
          end: totals.period.end,
          incomePesewas: totals.incomePesewas,
          expensePesewas: totals.expensePesewas,
          netPesewas: totals.netPesewas,
          savingsRatePercent: Math.round(totals.savingsRatePercent * 10) / 10,
          transactionCount: totals.transactionCount,
          // Stated explicitly so the model can say so rather than wondering
          // whether a transfer is hiding in these totals.
          note: 'Transfers between the user\'s own accounts are excluded from income and expenses.'
        }
      }
    }),

    getSpendingByCategory: tool({
      description:
        'Spending broken down by category for a period, largest first. Use for "where did my money go" or "what do I spend most on".',
      inputSchema: z.object({ period: periodParameter }),
      execute: async ({ period }) => {
        const result = await getSpendingByCategory(userId, timezone, period)
        return {
          period: result.period.label,
          totalPesewas: result.totalPesewas,
          categories: result.categories.map(category => ({
            name: category.name,
            amountPesewas: category.amountPesewas,
            percentOfTotal: Math.round(category.percentOfTotal * 10) / 10,
            transactionCount: category.transactionCount
          }))
        }
      }
    }),

    getBudgetStatus: tool({
      description:
        'The user\'s budget for a month with live progress per category, plus how much of the month has elapsed. Use for "am I on track" or "how is my food budget".',
      inputSchema: z.object({
        month: z
          .string()
          .regex(/^\d{4}-\d{2}-\d{2}$/)
          .optional()
          .describe('Any date in the month, as YYYY-MM-DD. Omit for the current month.')
      }),
      execute: async ({ month }) => {
        const status = await getBudgetStatus(userId, timezone, month)
        if (!status.exists) {
          return {
            month: status.monthLabel,
            hasBudget: false,
            // An explicit "no budget" beats an empty object the model might
            // read as "nothing spent".
            message: 'The user has not set a budget for this month.'
          }
        }
        return {
          month: status.monthLabel,
          hasBudget: true,
          periodElapsedPercent: Math.round(status.periodElapsedPercent),
          totalLimitPesewas: status.totalLimitPesewas,
          totalSpentPesewas: status.totalSpentPesewas,
          lines: status.lines.map(line => ({
            category: line.name,
            limitPesewas: line.targetPesewas,
            spentPesewas: line.actualPesewas,
            remainingPesewas: line.remainingPesewas,
            percentUsed: Math.round(line.percentUsed),
            isOver: line.isOver
          })),
          unbudgetedSpend: status.unbudgetedSpend.map(row => ({
            category: row.name,
            amountPesewas: row.amountPesewas
          }))
        }
      }
    }),

    getGoals: tool({
      description:
        'The user\'s savings goals with progress, and what they would need to save monthly to hit each one on time. Use for "how is my laptop fund" or "am I saving enough".',
      inputSchema: z.object({}),
      execute: async () => {
        const goals = await listGoals(userId, timezone)
        return {
          goals: goals.map(goal => ({
            name: goal.name,
            status: goal.status,
            targetPesewas: goal.targetPesewas,
            savedPesewas: goal.actualPesewas,
            // The distinction matters and the model must be able to voice it.
            movedIntoSavingsPesewas: goal.backedPesewas,
            plannedButNotMovedPesewas: goal.trackedPesewas,
            remainingPesewas: goal.remainingPesewas,
            percentComplete: Math.round(goal.percentUsed),
            targetDate: goal.targetDate,
            monthsRemaining: goal.monthsRemaining,
            suggestedMonthlyPesewas: goal.suggestedMonthlyPesewas,
            isBehind: goal.isBehind
          }))
        }
      }
    }),

    getRecentTransactions: tool({
      description:
        'Individual transactions for a period, newest first, optionally filtered by a search term. Use when the user asks about a specific purchase or wants examples behind a total.',
      inputSchema: z.object({
        period: periodParameter,
        search: z
          .string()
          .max(80)
          .optional()
          .describe('Optional text to match against the merchant or note.'),
        limit: z.number().int().min(1).max(25).default(10)
      }),
      execute: async ({ period, search, limit }) => {
        const result = await listTransactions(userId, timezone, {
          period,
          search,
          limit,
          start: undefined,
          end: undefined,
          accountId: undefined,
          categoryId: undefined,
          type: undefined,
          cursor: undefined
        })
        return {
          period: result.period.label,
          transactions: result.transactions.map(row => ({
            date: row.occurredOn,
            type: row.type,
            amountPesewas: row.amountPesewas,
            account: row.accountName,
            category: row.categoryName,
            merchant: row.merchant,
            note: row.note
          }))
        }
      }
    }),

    checkAffordability: tool({
      description:
        'Whether the user can afford a given price right now, with the figures behind the verdict. Use for any "can I afford", "should I buy" or "do I have enough for" question.',
      inputSchema: z.object({
        price: z
          .string()
          .describe('The price, e.g. "250" or "1,299.99". In cedis, not pesewas.')
      }),
      execute: async ({ price }) => {
        // Parsed through the same money path as user input, so "1,299.99"
        // becomes exactly 129999 pesewas and a malformed price is an error
        // rather than a silently wrong verdict.
        const pricePesewas = parseAmountToPesewas(price)
        const result = await checkAffordability(userId, timezone, pricePesewas)
        return {
          pricePesewas: result.pricePesewas,
          verdict: result.verdict,
          availablePesewas: result.availablePesewas,
          liquidPesewas: result.liquidPesewas,
          committedToGoalsPesewas: result.committedSavingsPesewas,
          stillBudgetedThisMonthPesewas: result.remainingBudgetedPesewas,
          leftAfterPurchasePesewas: result.afterPurchasePesewas,
          percentOfAvailable: Math.round(result.percentOfAvailable),
          explanation:
            '"available" is liquid money minus what has already been moved into goals and minus what is still budgeted for the rest of this month.'
        }
      }
    }),

    getToday: tool({
      description:
        'Today\'s date in the user\'s timezone. Use when a question depends on the date and you need to be certain of it.',
      inputSchema: z.object({}),
      execute: async () => {
        const period = resolvePeriod({ kind: 'this_month' }, timezone)
        return {
          today: todayInTimezone(timezone),
          timezone,
          currentMonth: period.label,
          monthStart: period.start,
          monthEnd: period.end
        }
      }
    })
  }
}
