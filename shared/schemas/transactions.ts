import { z } from 'zod'
import {
  isoDateSchema,
  optionalTextSchema,
  positiveAmountSchema,
  uuidSchema
} from './common'

export const ENTRY_TYPES = ['income', 'expense'] as const
export type EntryType = (typeof ENTRY_TYPES)[number]

/**
 * Income and expense share a shape; a transfer does not, and gets its own
 * schema below.
 *
 * That split is deliberate. A single schema with an optional `toAccountId` and
 * an optional `categoryId` would accept a "transfer with a category" or an
 * "expense with a destination account" — both of which the database CHECK
 * constraints reject. Rejecting them here means the user gets a field error
 * instead of a constraint violation.
 */
export const createEntrySchema = z.object({
  type: z.enum(ENTRY_TYPES),
  accountId: uuidSchema,
  // Null is permitted: forcing a category on every entry is the fastest way to
  // make someone stop recording transactions at all.
  categoryId: uuidSchema.nullish().transform(value => value ?? null),
  amount: positiveAmountSchema,
  occurredOn: isoDateSchema,
  merchant: optionalTextSchema(80),
  note: optionalTextSchema(280)
})

/**
 * A transfer between two of the user's own accounts.
 *
 * Carries no category by design — moving your own money is not spending — and
 * the two accounts must differ, or the resulting pair of rows would net to
 * nothing while still appearing in the ledger twice.
 */
export const createTransferSchema = z
  .object({
    fromAccountId: uuidSchema,
    toAccountId: uuidSchema,
    amount: positiveAmountSchema,
    occurredOn: isoDateSchema,
    note: optionalTextSchema(280),
    /** Optionally credit this transfer to a savings goal. */
    goalId: uuidSchema.nullish().transform(value => value ?? null)
  })
  .refine(
    value => value.fromAccountId !== value.toAccountId,
    { message: 'Choose two different accounts', path: ['toAccountId'] }
  )

export const updateEntrySchema = z
  .object({
    accountId: uuidSchema.optional(),
    categoryId: uuidSchema.nullish().transform(value => value ?? null).optional(),
    amount: positiveAmountSchema.optional(),
    occurredOn: isoDateSchema.optional(),
    merchant: optionalTextSchema(80),
    note: optionalTextSchema(280)
  })
  .refine(value => Object.keys(value).length > 0, 'Nothing to update')

/**
 * List filters and cursor pagination.
 *
 * Keyset pagination rather than offset: the list is ordered by
 * `(occurredOn desc, id desc)` and backed by an index of exactly that shape, so
 * page 40 costs the same as page 1 and inserting a transaction mid-browse can't
 * make a row appear twice.
 */
export const transactionQuerySchema = z.object({
  period: z.enum(['this_month', 'last_month', 'last_30_days', 'this_year', 'all_time', 'custom'])
    .default('this_month'),
  start: isoDateSchema.optional(),
  end: isoDateSchema.optional(),
  accountId: uuidSchema.optional(),
  categoryId: uuidSchema.optional(),
  type: z.enum(['income', 'expense', 'transfer']).optional(),
  search: z.string().trim().max(80).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** `occurredOn|id` of the last row of the previous page. */
  cursor: z.string().trim().max(80).optional()
})

export type CreateEntryInput = z.infer<typeof createEntrySchema>
export type CreateTransferInput = z.infer<typeof createTransferSchema>
export type UpdateEntryInput = z.infer<typeof updateEntrySchema>
export type TransactionQuery = z.infer<typeof transactionQuerySchema>
