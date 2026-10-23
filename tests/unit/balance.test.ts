import { describe, expect, it } from 'vitest'
import { deriveBalance, deriveNetFlow, type BalanceComponents } from '#shared/money/balance'
import { MoneyError, sumPesewas } from '#shared/money/pesewas'

const empty: BalanceComponents = {
  openingBalancePesewas: 0,
  incomePesewas: 0,
  expensePesewas: 0,
  transferInPesewas: 0,
  transferOutPesewas: 0
}

const components = (overrides: Partial<BalanceComponents>): BalanceComponents => ({
  ...empty,
  ...overrides
})

describe('deriveBalance', () => {
  it('returns the opening balance for an untouched account', () => {
    expect(deriveBalance(components({ openingBalancePesewas: 50_000 }))).toBe(50_000)
  })

  it('adds income and subtracts expenses', () => {
    // GH₵500 opening, GH₵1,200 earned, GH₵430.50 spent → GH₵1,269.50
    expect(
      deriveBalance(
        components({
          openingBalancePesewas: 50_000,
          incomePesewas: 120_000,
          expensePesewas: 43_050
        })
      )
    ).toBe(126_950)
  })

  it('moves money on both legs of a transfer', () => {
    const source = components({ openingBalancePesewas: 100_000, transferOutPesewas: 30_000 })
    const destination = components({ transferInPesewas: 30_000 })
    expect(deriveBalance(source)).toBe(70_000)
    expect(deriveBalance(destination)).toBe(30_000)
  })

  it('leaves net worth unchanged across a transfer', () => {
    // The property that makes transfers safe: GH₵300 moved from cash to savings
    // changes both accounts and changes nothing overall.
    const before = [
      components({ openingBalancePesewas: 100_000 }),
      components({ openingBalancePesewas: 0 })
    ]
    const after = [
      components({ openingBalancePesewas: 100_000, transferOutPesewas: 30_000 }),
      components({ openingBalancePesewas: 0, transferInPesewas: 30_000 })
    ]
    const total = (accounts: BalanceComponents[]) => sumPesewas(accounts.map(deriveBalance))
    expect(total(after)).toBe(total(before))
  })

  it('goes negative when an account is overdrawn', () => {
    expect(deriveBalance(components({ incomePesewas: 1000, expensePesewas: 2500 }))).toBe(-1500)
  })

  it('handles a negative opening balance — a credit position is legitimate', () => {
    expect(
      deriveBalance(components({ openingBalancePesewas: -20_000, incomePesewas: 50_000 }))
    ).toBe(30_000)
  })

  it('stays exact across many small amounts', () => {
    // 1,000 × GH₵0.07. In float cedis this drifts; in pesewas it is exact.
    const total = sumPesewas(Array.from({ length: 1000 }, () => 7))
    expect(deriveBalance(components({ incomePesewas: total }))).toBe(7000)
  })

  it('throws on a fractional component rather than rounding it away', () => {
    expect(() => deriveBalance(components({ incomePesewas: 10.5 }))).toThrow(MoneyError)
  })

  it('names the offending component in the error', () => {
    expect(() => deriveBalance(components({ expensePesewas: Number.NaN }))).toThrow(
      /expensePesewas/
    )
  })
})

describe('deriveNetFlow', () => {
  it('is income minus expenses', () => {
    expect(deriveNetFlow(components({ incomePesewas: 120_000, expensePesewas: 43_050 }))).toBe(
      76_950
    )
  })

  it('ignores the opening balance — net flow is about the window, not the account', () => {
    expect(
      deriveNetFlow(
        components({ openingBalancePesewas: 500_000, incomePesewas: 1000, expensePesewas: 400 })
      )
    ).toBe(600)
  })

  it('ignores transfers entirely', () => {
    // Moving GH₵300 into savings is neither earning nor spending. If this ever
    // fails, the dashboard will tell users they earned money they already had.
    expect(
      deriveNetFlow(components({ transferInPesewas: 30_000, transferOutPesewas: 30_000 }))
    ).toBe(0)
    expect(
      deriveNetFlow(
        components({ incomePesewas: 120_000, expensePesewas: 0, transferOutPesewas: 30_000 })
      )
    ).toBe(120_000)
  })

  it('is negative in a month of overspending', () => {
    expect(deriveNetFlow(components({ incomePesewas: 50_000, expensePesewas: 65_000 }))).toBe(
      -15_000
    )
  })
})
