import { z } from 'zod'
import { optionalTextSchema, signedAmountSchema, textSchema, uuidSchema } from './common'

export const ACCOUNT_TYPES = ['cash', 'mobile_money', 'bank', 'savings'] as const
export type AccountType = (typeof ACCOUNT_TYPES)[number]

/** Labels for the UI. Kept beside the enum so the two can't drift. */
export const ACCOUNT_TYPE_LABELS: Record<AccountType, string> = {
  cash: 'Cash',
  mobile_money: 'Mobile Money',
  bank: 'Bank',
  savings: 'Savings'
}

export const createAccountSchema = z.object({
  name: textSchema(80, 'Account name'),
  type: z.enum(ACCOUNT_TYPES),
  institution: optionalTextSchema(80),
  // Signed: someone starting with an overdrawn account is entitled to say so.
  openingBalance: signedAmountSchema.default(0)
})

/**
 * Every field optional, but at least one required — a PATCH that changes
 * nothing is a client bug worth surfacing rather than a silent no-op.
 *
 * `type` is absent on purpose: re-typing an account after transactions exist
 * would retroactively change what its history means.
 */
export const updateAccountSchema = z
  .object({
    name: textSchema(80, 'Account name').optional(),
    institution: optionalTextSchema(80),
    openingBalance: signedAmountSchema.optional(),
    isArchived: z.boolean().optional()
  })
  .refine(value => Object.keys(value).length > 0, 'Nothing to update')

export const accountIdSchema = z.object({ id: uuidSchema })

export type CreateAccountInput = z.infer<typeof createAccountSchema>
export type UpdateAccountInput = z.infer<typeof updateAccountSchema>
