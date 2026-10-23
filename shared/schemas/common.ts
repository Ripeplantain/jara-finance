import { z } from 'zod'
import { isIsoDate, PERIOD_KINDS } from '../period/month'
import { MAX_SAFE_PESEWAS, MoneyError, parseAmountToPesewas } from '../money/pesewas'

/**
 * Shared Zod primitives. Every API route validates its input through this
 * module, so "what is a valid amount" has exactly one answer on both sides of
 * the wire.
 *
 * The money rule from the README — integer pesewas, never a float — is enforced
 * *here*, at the boundary. A route that took a raw number would let a float into
 * the money path before any service could object.
 */

/** A `YYYY-MM-DD` calendar date, validated against the real calendar. */
export const isoDateSchema = z
  .string()
  .refine(isIsoDate, 'Must be a valid YYYY-MM-DD date')

export const uuidSchema = z.uuid('Must be a valid id')

/**
 * Money arriving from a client, normalised to integer pesewas.
 *
 * Accepts what a user can actually type — `"1,234.56"`, `"GH₵20"`, `20`, `"20"`
 * — and funnels all of it through `parseAmountToPesewas`, which does integer
 * arithmetic on the digits. A `MoneyError` becomes a field-level validation
 * message rather than a 500.
 */
export const amountSchema = z
  .union([z.string(), z.number()])
  .transform((input, ctx) => {
    try {
      return parseAmountToPesewas(input)
    } catch (error) {
      ctx.addIssue({
        code: 'custom',
        message: error instanceof MoneyError ? error.message : 'Enter a valid amount'
      })
      return z.NEVER
    }
  })

/** A positive amount. Every stored amount in Jara is a positive magnitude. */
export const positiveAmountSchema = amountSchema.refine(
  value => value > 0,
  'Amount must be greater than zero'
)

/** An amount that may be negative — only an opening balance qualifies. */
export const signedAmountSchema = amountSchema.refine(
  value => Math.abs(value) <= MAX_SAFE_PESEWAS,
  'Amount is too large'
)

/** Trimmed, non-empty, length-capped free text. */
export function textSchema(max: number, label = 'This field') {
  return z
    .string()
    .trim()
    .min(1, `${label} is required`)
    .max(max, `${label} must be ${max} characters or fewer`)
}

/** Optional free text where an empty string means "not provided". */
export function optionalTextSchema(max: number) {
  return z
    .string()
    .trim()
    .max(max, `Must be ${max} characters or fewer`)
    .transform(value => (value === '' ? null : value))
    .nullish()
    .transform(value => value ?? null)
}

/**
 * A reporting window request. Resolved server-side by `resolvePeriod` against
 * the user's own timezone — never in the browser, so a wrong device clock can't
 * change what "this month" means.
 */
export const periodQuerySchema = z
  .object({
    period: z.enum(PERIOD_KINDS).default('this_month'),
    start: isoDateSchema.optional(),
    end: isoDateSchema.optional()
  })
  .refine(
    value => value.period !== 'custom' || (value.start && value.end),
    { message: 'A custom period needs both start and end', path: ['start'] }
  )

export type PeriodQuery = z.infer<typeof periodQuerySchema>
