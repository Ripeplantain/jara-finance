import { describe, expect, it } from 'vitest'
import {
  addPesewas,
  assertSafePesewas,
  dividePesewas,
  MAX_SAFE_PESEWAS,
  MoneyError,
  multiplyPesewas,
  parseAmountToPesewas,
  percentageOfPesewas,
  pesewasToCedis,
  subtractPesewas,
  sumPesewas
} from '#shared/money/pesewas'

describe('assertSafePesewas', () => {
  it('accepts integers including zero and negatives', () => {
    expect(assertSafePesewas(0)).toBe(0)
    expect(assertSafePesewas(1999)).toBe(1999)
    expect(assertSafePesewas(-1999)).toBe(-1999)
  })

  it('rejects fractional pesewas — the whole point of the integer representation', () => {
    expect(() => assertSafePesewas(19.99)).toThrow(MoneyError)
  })

  it('rejects NaN and Infinity instead of letting them poison a total', () => {
    expect(() => assertSafePesewas(Number.NaN)).toThrow(MoneyError)
    expect(() => assertSafePesewas(Number.POSITIVE_INFINITY)).toThrow(MoneyError)
  })

  it('rejects amounts past the exact-integer ceiling', () => {
    expect(() => assertSafePesewas(MAX_SAFE_PESEWAS + 10)).toThrow(MoneyError)
  })
})

describe('parseAmountToPesewas', () => {
  it.each([
    ['0', 0],
    ['5', 500],
    ['19.99', 1999],
    ['19.9', 1990],
    ['0.01', 1],
    ['1,234.56', 123456],
    ['1,234,567.89', 123456789],
    ['GH₵1,234.56', 123456],
    ['GHS 1234.56', 123456],
    ['₵20', 2000],
    ['  42.50  ', 4250],
    ['-19.99', -1999]
  ])('parses %s to %i pesewas', (input, expected) => {
    expect(parseAmountToPesewas(input)).toBe(expected)
  })

  it('parses the classic float-error amounts exactly', () => {
    // 19.99 * 100 === 1998.9999999999998 in IEEE 754. The string path never
    // performs that multiply, so these are exact rather than nearly right.
    expect(parseAmountToPesewas('19.99')).toBe(1999)
    expect(parseAmountToPesewas('0.07')).toBe(7)
    expect(parseAmountToPesewas('8.29')).toBe(829)
  })

  it('refuses more than two decimal places rather than guessing', () => {
    expect(() => parseAmountToPesewas('12.345')).toThrow(MoneyError)
  })

  it.each(['', '   ', 'abc', '12.', '.5', '1.2.3', '12-', '1e3'])(
    'rejects %o',
    (input) => {
      expect(() => parseAmountToPesewas(input)).toThrow(MoneyError)
    }
  )

  it('routes numeric input through the digits, not the float', () => {
    expect(parseAmountToPesewas(19.99)).toBe(1999)
    expect(parseAmountToPesewas(0.07)).toBe(7)
    expect(parseAmountToPesewas(100)).toBe(10000)
  })

  it('rejects non-finite numeric input', () => {
    expect(() => parseAmountToPesewas(Number.NaN)).toThrow(MoneyError)
  })
})

describe('addition and subtraction', () => {
  it('sums without float drift', () => {
    // 0.1 + 0.2 === 0.30000000000000004 in cedis. In pesewas it is just 30.
    expect(addPesewas(10, 20)).toBe(30)
    expect(sumPesewas([1999, 1, 500_00])).toBe(52_000)
  })

  it('sums an empty list to zero', () => {
    expect(sumPesewas([])).toBe(0)
  })

  it('allows a negative result — an overdrawn account is a real state', () => {
    expect(subtractPesewas(1000, 2500)).toBe(-1500)
  })

  it('throws rather than overflowing', () => {
    expect(() => addPesewas(MAX_SAFE_PESEWAS, MAX_SAFE_PESEWAS)).toThrow(MoneyError)
  })

  it('rejects a fractional operand anywhere in the chain', () => {
    expect(() => sumPesewas([100, 0.5])).toThrow(MoneyError)
  })
})

describe('multiplyPesewas', () => {
  it('rounds half away from zero', () => {
    expect(multiplyPesewas(1999, 0.5)).toBe(1000) // 999.5 → 1000
    expect(multiplyPesewas(-1999, 0.5)).toBe(-1000) // −999.5 → −1000
  })

  it('returns an integer for any finite factor', () => {
    expect(Number.isInteger(multiplyPesewas(123_456, 1 / 3))).toBe(true)
  })

  it('rejects a non-finite factor', () => {
    expect(() => multiplyPesewas(100, Number.NaN)).toThrow(MoneyError)
  })
})

describe('dividePesewas', () => {
  it('conserves the total — no lost pesewas', () => {
    const shares = dividePesewas(1000, 3)
    expect(shares).toEqual([334, 333, 333])
    expect(sumPesewas(shares)).toBe(1000)
  })

  it('divides evenly when it divides evenly', () => {
    expect(dividePesewas(900, 3)).toEqual([300, 300, 300])
  })

  it('handles a single share', () => {
    expect(dividePesewas(1999, 1)).toEqual([1999])
  })

  it('conserves negative totals too', () => {
    const shares = dividePesewas(-1000, 3)
    expect(sumPesewas(shares)).toBe(-1000)
  })

  it('rejects zero or fractional parts', () => {
    expect(() => dividePesewas(1000, 0)).toThrow(MoneyError)
    expect(() => dividePesewas(1000, 2.5)).toThrow(MoneyError)
  })
})

describe('percentageOfPesewas', () => {
  it('computes a display percentage', () => {
    expect(percentageOfPesewas(2500, 10_000)).toBe(25)
  })

  it('returns 0 for a zero whole instead of Infinity', () => {
    // An unbudgeted category must not crash a progress bar.
    expect(percentageOfPesewas(5000, 0)).toBe(0)
  })

  it('can exceed 100 — overspending is representable', () => {
    expect(percentageOfPesewas(15_000, 10_000)).toBe(150)
  })
})

describe('pesewasToCedis', () => {
  it('converts for display', () => {
    expect(pesewasToCedis(123_456)).toBe(1234.56)
  })
})
