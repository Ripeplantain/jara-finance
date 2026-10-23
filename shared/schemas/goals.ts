import { z } from 'zod'
import {
  isoDateSchema,
  optionalTextSchema,
  positiveAmountSchema,
  textSchema,
  uuidSchema
} from './common'

export const GOAL_STATUSES = ['active', 'achieved', 'archived'] as const
export type GoalStatus = (typeof GOAL_STATUSES)[number]

export const createGoalSchema = z.object({
  name: textSchema(80, 'Goal name'),
  target: positiveAmountSchema,
  // Null is allowed: "save GH₵5,000 eventually" is a real goal. Without a date
  // there is no suggested monthly contribution and the UI says so.
  targetDate: isoDateSchema.nullish().transform(value => value ?? null),
  /** The savings account backing contributions land in. */
  accountId: uuidSchema.nullish().transform(value => value ?? null)
})

export const updateGoalSchema = z
  .object({
    name: textSchema(80, 'Goal name').optional(),
    target: positiveAmountSchema.optional(),
    targetDate: isoDateSchema.nullish().transform(value => value ?? null).optional(),
    accountId: uuidSchema.nullish().transform(value => value ?? null).optional(),
    status: z.enum(GOAL_STATUSES).optional()
  })
  .refine(value => Object.keys(value).length > 0, 'Nothing to update')

/**
 * A contribution towards a goal, in one of two kinds (see `goalEntries`):
 *
 * - **tracked** — bookkeeping only. No money moves, balances don't change.
 * - **backed** — a real transfer from `fromAccountId` into the goal's account,
 *   written as a transfer pair and linked to this entry.
 *
 * `fromAccountId` is required for `backed` and meaningless for `tracked`, which
 * the refinement enforces rather than leaving to the service.
 */
export const contributeToGoalSchema = z
  .object({
    kind: z.enum(['tracked', 'backed']).default('tracked'),
    amount: positiveAmountSchema,
    occurredOn: isoDateSchema,
    fromAccountId: uuidSchema.nullish().transform(value => value ?? null),
    note: optionalTextSchema(280)
  })
  .refine(
    value => value.kind !== 'backed' || value.fromAccountId !== null,
    { message: 'Choose the account the money moves from', path: ['fromAccountId'] }
  )

export type CreateGoalInput = z.infer<typeof createGoalSchema>
export type UpdateGoalInput = z.infer<typeof updateGoalSchema>
export type ContributeToGoalInput = z.infer<typeof contributeToGoalSchema>
