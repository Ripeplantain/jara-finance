import { describe, expect, it } from 'vitest'
import { amountSchema, periodQuerySchema, positiveAmountSchema } from '#shared/schemas/common'
import { createTransferSchema } from '#shared/schemas/transactions'
import {
  contributeToGoalSchema,
  createGoalSchema,
  moveGoalEntrySchema,
  updateGoalEntrySchema
} from '#shared/schemas/goals'
import { upsertBudgetSchema } from '#shared/schemas/budgets'
import { dashboardQuerySchema, monthAnchorQuerySchema } from '#shared/schemas/reports'
import { addMonths, startOfMonth } from '#shared/period/month'

/**
 * The validation boundary.
 *
 * These schemas are where a float from a client would get into the money path
 * if it could, so they are tested as carefully as the arithmetic itself.
 */

const UUID_A = '11111111-1111-4111-8111-111111111111'
const UUID_B = '22222222-2222-4222-8222-222222222222'

describe('amountSchema', () => {
  it('parses what a user can actually type into integer pesewas', () => {
    expect(amountSchema.parse('1234')).toBe(123_400)
    expect(amountSchema.parse('1,234.56')).toBe(123_456)
    expect(amountSchema.parse('GH₵ 20')).toBe(2_000)
    expect(amountSchema.parse(19.99)).toBe(1_999)
    expect(amountSchema.parse('0.05')).toBe(5)
  })

  it('rejects more precision than money has, instead of rounding it away', () => {
    // Silently picking an interpretation of someone's money is worse than
    // asking again.
    const result = amountSchema.safeParse('12.345')
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toContain('two decimal places')
  })

  it('rejects text that is not an amount', () => {
    expect(amountSchema.safeParse('a lot').success).toBe(false)
    expect(amountSchema.safeParse('').success).toBe(false)
  })

  it('surfaces a money error as a field message, not a thrown exception', () => {
    const result = amountSchema.safeParse('not money')
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toBeTruthy()
  })
})

describe('positiveAmountSchema', () => {
  it('rejects zero and negatives, because stored amounts are magnitudes', () => {
    expect(positiveAmountSchema.safeParse('0').success).toBe(false)
    expect(positiveAmountSchema.safeParse('-50').success).toBe(false)
    expect(positiveAmountSchema.parse('50')).toBe(5_000)
  })
})

describe('createTransferSchema', () => {
  it('accepts a transfer between two different accounts', () => {
    const result = createTransferSchema.safeParse({
      fromAccountId: UUID_A,
      toAccountId: UUID_B,
      amount: '600',
      occurredOn: '2026-10-06'
    })
    expect(result.success).toBe(true)
    expect(result.data!.amount).toBe(60_000)
  })

  it('refuses a transfer to the same account', () => {
    // The two rows would net to nothing while still appearing in the ledger.
    const result = createTransferSchema.safeParse({
      fromAccountId: UUID_A,
      toAccountId: UUID_A,
      amount: '600',
      occurredOn: '2026-10-06'
    })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.path).toEqual(['toAccountId'])
  })

  it('rejects an impossible date', () => {
    const result = createTransferSchema.safeParse({
      fromAccountId: UUID_A,
      toAccountId: UUID_B,
      amount: '600',
      occurredOn: '2026-02-30'
    })
    expect(result.success).toBe(false)
  })
})

describe('contributeToGoalSchema', () => {
  it('requires a source account for a contribution that moves real money', () => {
    const result = contributeToGoalSchema.safeParse({
      kind: 'backed',
      amount: '300',
      occurredOn: '2026-10-13'
    })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.path).toEqual(['fromAccountId'])
  })

  it('does not require one for a tracked contribution', () => {
    const result = contributeToGoalSchema.safeParse({
      kind: 'tracked',
      amount: '200',
      occurredOn: '2026-10-12'
    })
    expect(result.success).toBe(true)
    expect(result.data!.fromAccountId).toBeNull()
  })

  it('defaults to tracked, the option that cannot move money by surprise', () => {
    const result = contributeToGoalSchema.parse({ amount: '100', occurredOn: '2026-10-12' })
    expect(result.kind).toBe('tracked')
  })
})

describe('upsertBudgetSchema', () => {
  it('rejects two limits on the same category', () => {
    // The other half of removing the "two caps on Food" ambiguity.
    const result = upsertBudgetSchema.safeParse({
      month: '2026-10-01',
      allocations: [
        { categoryId: UUID_A, limit: '600' },
        { categoryId: UUID_A, limit: '700' }
      ]
    })
    expect(result.success).toBe(false)
    expect(result.error!.issues[0]!.message).toContain('one limit')
  })

  it('accepts an empty allocation list, which clears a month', () => {
    const result = upsertBudgetSchema.safeParse({ month: '2026-10-01', allocations: [] })
    expect(result.success).toBe(true)
  })

  it('rejects a zero limit rather than storing a meaningless cap', () => {
    const result = upsertBudgetSchema.safeParse({
      month: '2026-10-01',
      allocations: [{ categoryId: UUID_A, limit: '0' }]
    })
    expect(result.success).toBe(false)
  })
})

describe('periodQuerySchema', () => {
  it('defaults to the current month', () => {
    expect(periodQuerySchema.parse({}).period).toBe('this_month')
  })

  it('requires both bounds for a custom period', () => {
    expect(periodQuerySchema.safeParse({ period: 'custom' }).success).toBe(false)
    expect(
      periodQuerySchema.safeParse({
        period: 'custom',
        start: '2026-10-01',
        end: '2026-10-31'
      }).success
    ).toBe(true)
  })
})

describe('dashboardQuerySchema', () => {
  it('defaults to this month with no month chosen, so existing callers are unchanged', () => {
    expect(dashboardQuerySchema.parse({})).toEqual({ range: 'this_month' })
  })

  it('accepts a month to report on', () => {
    expect(dashboardQuerySchema.parse({ range: 'last_6_months', month: '2026-03-01' }))
      .toEqual({ range: 'last_6_months', month: '2026-03-01' })
  })

  it('rejects a month that is not a date', () => {
    expect(dashboardQuerySchema.safeParse({ month: '2026-13-01' }).success).toBe(false)
    expect(dashboardQuerySchema.safeParse({ month: 'March' }).success).toBe(false)
  })
})

describe('monthAnchorQuerySchema', () => {
  it('treats the month as optional', () => {
    expect(monthAnchorQuerySchema.parse({})).toEqual({})
    expect(monthAnchorQuerySchema.parse({ month: '2026-03-01' })).toEqual({ month: '2026-03-01' })
  })
})

describe('month stepping', () => {
  it('steps whole months across a year boundary from the 1st', () => {
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
    expect(startOfMonth('2026-05-17')).toBe('2026-05-01')
  })
})

describe('createGoalSchema', () => {
  it('has no starting amount unless one is given', () => {
    const parsed = createGoalSchema.parse({ name: 'Laptop', target: '5000' })
    expect(parsed.alreadySaved).toBeNull()
  })

  it('reads an already-saved amount as integer pesewas', () => {
    const parsed = createGoalSchema.parse({ name: 'Laptop', target: '5000', alreadySaved: '1,200.50' })
    expect(parsed.alreadySaved).toBe(120_050)
  })

  it('rejects a zero or negative already-saved amount', () => {
    expect(createGoalSchema.safeParse({ name: 'Laptop', target: '5000', alreadySaved: '0' }).success).toBe(false)
    expect(createGoalSchema.safeParse({ name: 'Laptop', target: '5000', alreadySaved: '-5' }).success).toBe(false)
  })
})

describe('updateGoalEntrySchema', () => {
  it('leaves the note alone when it is not sent', () => {
    const parsed = updateGoalEntrySchema.parse({ amount: '40' })
    expect(parsed).toEqual({ amount: 4_000 })
    expect('note' in parsed).toBe(false)
  })

  it('clears the note only when it is sent empty', () => {
    expect(updateGoalEntrySchema.parse({ note: '' })).toEqual({ note: null })
  })

  it('refuses an edit that changes nothing', () => {
    expect(updateGoalEntrySchema.safeParse({}).success).toBe(false)
  })

  it('refuses a non-positive amount', () => {
    expect(updateGoalEntrySchema.safeParse({ amount: '0' }).success).toBe(false)
  })
})

describe('moveGoalEntrySchema', () => {
  it('needs the account the money moves from', () => {
    expect(moveGoalEntrySchema.safeParse({}).success).toBe(false)
    expect(moveGoalEntrySchema.safeParse({ fromAccountId: 'not-a-uuid' }).success).toBe(false)
  })
})
