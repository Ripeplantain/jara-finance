import { describe, expect, it } from 'vitest'
import {
  formatPercentage,
  formatPesewas,
  formatPesewasCompact,
  formatSignedPesewas
} from '#shared/money/format'
import { MoneyError } from '#shared/money/pesewas'

// Asserted against Node's own ICU output for en-GH/GHS rather than a guess at
// the symbol. If an ICU upgrade ever changes the shape, these fail loudly
// instead of the UI quietly showing "GHS 1,234.56".
describe('formatPesewas', () => {
  it('formats with the cedi symbol and two decimals', () => {
    expect(formatPesewas(123_456)).toBe('GH₵1,234.56')
    expect(formatPesewas(0)).toBe('GH₵0.00')
    expect(formatPesewas(7)).toBe('GH₵0.07')
  })

  it('can drop decimals on whole-cedi amounts for dense layouts', () => {
    expect(formatPesewas(123_400, { hideZeroDecimals: true })).toBe('GH₵1,234')
    // Not a whole cedi, so the decimals stay — truncating them would be a lie.
    expect(formatPesewas(123_456, { hideZeroDecimals: true })).toBe('GH₵1,234.56')
  })

  it('refuses to format a fractional pesewa amount', () => {
    expect(() => formatPesewas(10.5)).toThrow(MoneyError)
  })
})

describe('formatSignedPesewas', () => {
  it('marks direction explicitly', () => {
    expect(formatSignedPesewas(2000)).toBe('+GH₵20.00')
    // U+2212 MINUS SIGN, not a hyphen, so negatives align in tabular figures.
    expect(formatSignedPesewas(-2000)).toBe('−GH₵20.00')
  })

  it('leaves zero unsigned', () => {
    expect(formatSignedPesewas(0)).toBe('GH₵0.00')
  })
})

describe('formatPesewasCompact', () => {
  it('abbreviates large amounts for chart axes', () => {
    expect(formatPesewasCompact(123_456_700)).toBe('GH₵1.2M')
    expect(formatPesewasCompact(120_000)).toBe('GH₵1.2K')
  })
})

describe('formatPercentage', () => {
  it('rounds for display', () => {
    expect(formatPercentage(42.7)).toBe('43%')
    expect(formatPercentage(150)).toBe('150%')
  })
})
