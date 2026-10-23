import { z } from 'zod'
import { positiveAmountSchema, textSchema } from './common'

export const INCOME_FREQUENCIES = ['weekly', 'biweekly', 'monthly', 'irregular'] as const
export type IncomeFrequency = (typeof INCOME_FREQUENCIES)[number]

export const INCOME_FREQUENCY_LABELS: Record<IncomeFrequency, string> = {
  weekly: 'Weekly',
  biweekly: 'Every two weeks',
  monthly: 'Monthly',
  irregular: 'Irregular — it varies'
}

/**
 * `timezone` is validated by asking the platform to use it, rather than against
 * a hardcoded list: the IANA database changes and the runtime's copy is the only
 * authority that matters for `todayInTimezone`.
 */
const timezoneSchema = z
  .string()
  .trim()
  .min(1)
  .refine((value) => {
    try {
      new Intl.DateTimeFormat('en-US', { timeZone: value })
      return true
    } catch {
      return false
    }
  }, 'Not a recognised timezone')

export const onboardingSchema = z.object({
  displayName: textSchema(60, 'Your name'),
  timezone: timezoneSchema.default('Africa/Accra'),
  incomeFrequency: z.enum(INCOME_FREQUENCIES).default('monthly'),
  // Nullable, not zero: "I don't know" is a real answer for irregular earners,
  // and faking it as zero would quietly poison every affordability figure.
  expectedIncome: positiveAmountSchema.nullish().transform(value => value ?? null)
})

export const updateProfileSchema = z
  .object({
    displayName: textSchema(60, 'Your name').optional(),
    timezone: timezoneSchema.optional(),
    incomeFrequency: z.enum(INCOME_FREQUENCIES).optional(),
    expectedIncome: positiveAmountSchema.nullish().transform(value => value ?? null).optional()
  })
  .refine(value => Object.keys(value).length > 0, 'Nothing to update')

export type OnboardingInput = z.infer<typeof onboardingSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
