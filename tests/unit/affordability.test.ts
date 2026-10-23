import { describe, expect, it } from 'vitest'
import {
  deriveAffordability,
  TIGHT_THRESHOLD_PERCENT,
  type AffordabilityInput
} from '#shared/money/affordability'

const base: AffordabilityInput = {
  pricePesewas: 0,
  liquidPesewas: 0,
  committedSavingsPesewas: 0,
  remainingBudgetedPesewas: 0
}

const input = (overrides: Partial<AffordabilityInput>): AffordabilityInput => ({
  ...base,
  ...overrides
})

describe('deriveAffordability', () => {
  it('subtracts commitments from liquid money to get what is actually available', () => {
    // GH₵4,688.10 liquid, GH₵300 already moved into goals, GH₵512.60 still
    // budgeted for the month → GH₵3,875.50 available.
    const result = deriveAffordability(
      input({
        pricePesewas: 50_000,
        liquidPesewas: 468_810,
        committedSavingsPesewas: 30_000,
        remainingBudgetedPesewas: 51_260
      })
    )
    expect(result.availablePesewas).toBe(387_550)
    expect(result.afterPurchasePesewas).toBe(337_550)
    expect(result.verdict).toBe('yes')
  })

  it('refuses a purchase larger than what is available', () => {
    const result = deriveAffordability(
      input({ pricePesewas: 500_000, liquidPesewas: 468_810 })
    )
    expect(result.verdict).toBe('no')
    expect(result.afterPurchasePesewas).toBeLessThan(0)
  })

  it('calls a purchase that fits but leaves almost nothing "tight"', () => {
    // A plain yes/no is misleading at the margin: this is affordable and
    // probably unwise, and the coach should be able to say so.
    const result = deriveAffordability(
      input({ pricePesewas: 95_000, liquidPesewas: 100_000 })
    )
    expect(result.verdict).toBe('tight')
    expect(result.percentOfAvailable).toBeGreaterThanOrEqual(TIGHT_THRESHOLD_PERCENT)
    expect(result.afterPurchasePesewas).toBe(5_000)
  })

  it('treats spending exactly everything available as tight, not impossible', () => {
    const result = deriveAffordability(
      input({ pricePesewas: 100_000, liquidPesewas: 100_000 })
    )
    expect(result.afterPurchasePesewas).toBe(0)
    expect(result.verdict).toBe('tight')
  })

  it('says no when commitments have already consumed everything', () => {
    // Liquid money exists, but all of it is committed — so nothing is available
    // and the percentage must not come back negative or infinite.
    const result = deriveAffordability(
      input({
        pricePesewas: 1_000,
        liquidPesewas: 50_000,
        committedSavingsPesewas: 30_000,
        remainingBudgetedPesewas: 25_000
      })
    )
    expect(result.availablePesewas).toBe(-5_000)
    expect(result.percentOfAvailable).toBe(100)
    expect(result.verdict).toBe('no')
  })

  it('handles an overdrawn account without producing a nonsense verdict', () => {
    const result = deriveAffordability(
      input({ pricePesewas: 1_000, liquidPesewas: -1_240 })
    )
    expect(result.verdict).toBe('no')
    expect(result.percentOfAvailable).toBe(100)
  })

  it('is exact on amounts a float would round', () => {
    // GH₵19.99 against GH₵20.00 — the classic case where cents arithmetic in
    // floats goes wrong.
    const result = deriveAffordability(
      input({ pricePesewas: 1_999, liquidPesewas: 2_000 })
    )
    expect(result.afterPurchasePesewas).toBe(1)
    expect(result.verdict).toBe('tight')
  })
})
