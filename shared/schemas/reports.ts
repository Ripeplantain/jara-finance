import { z } from 'zod'
import { isoDateSchema, uuidSchema } from './common'

/** The range switcher on Home. `last_6_months` is whole calendar months, this one included. */
export const DASHBOARD_RANGES = ['this_month', 'last_month', 'last_6_months'] as const
export type DashboardRange = (typeof DASHBOARD_RANGES)[number]

export const dashboardQuerySchema = z.object({
  range: z.enum(DASHBOARD_RANGES).default('this_month')
})

/** The same period vocabulary as the ledger list, so a month heading's totals match the rows under it. */
export const monthTotalsQuerySchema = z.object({
  period: z.enum(['this_month', 'last_month', 'last_30_days', 'this_year', 'all_time', 'custom'])
    .default('this_month'),
  start: isoDateSchema.optional(),
  end: isoDateSchema.optional(),
  accountId: uuidSchema.optional()
})

export type DashboardQuery = z.infer<typeof dashboardQuerySchema>
export type MonthTotalsQuery = z.infer<typeof monthTotalsQuerySchema>
