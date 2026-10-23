import { z } from 'zod'
import { isoDateSchema, optionalTextSchema, positiveAmountSchema, uuidSchema } from './common'

/**
 * A budget is addressed by the month it covers, not by its id — there is
 * exactly one per user per month, so the month *is* the identity. The service
 * normalises any date in the month to its first day.
 */
export const budgetMonthSchema = z.object({
  month: isoDateSchema.optional()
})

export const budgetAllocationSchema = z.object({
  categoryId: uuidSchema,
  limit: positiveAmountSchema
})

/**
 * Upserts a whole month at once: the allocation list replaces whatever was
 * there. Sending the complete set rather than per-row edits means the client
 * can't produce a half-saved budget, and "remove this cap" needs no delete
 * endpoint.
 */
export const upsertBudgetSchema = z.object({
  month: isoDateSchema,
  note: optionalTextSchema(280),
  allocations: z
    .array(budgetAllocationSchema)
    .max(40, 'That is more categories than a budget can usefully track')
    .refine((rows) => {
      const ids = rows.map(row => row.categoryId)
      return new Set(ids).size === ids.length
    }, 'Each category can only have one limit')
})

export type UpsertBudgetInput = z.infer<typeof upsertBudgetSchema>
