/**
 * Money arithmetic. Every cedi amount in Jara is an integer number of pesewas
 * (1 GHS = 100 pesewas) from the moment it is parsed until the moment it is
 * formatted for display.
 *
 * There are no floats in this module's results. `0.1 + 0.2 !== 0.3` is a bug in
 * a budgeting app, not a curiosity, and the only reliable fix is to never let a
 * fractional currency value exist in the first place.
 */

/**
 * JS numbers are exact integers up to 2^53 − 1. In pesewas that is about
 * GH₵ 90 trillion — far beyond any real balance, but the ceiling is asserted
 * rather than assumed so an overflow surfaces as a thrown error instead of a
 * silently wrong total.
 */
export const MAX_SAFE_PESEWAS = Number.MAX_SAFE_INTEGER

export class MoneyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'MoneyError'
  }
}

/** Throws unless `value` is an exact, finite, in-range integer pesewa amount. */
export function assertSafePesewas(value: number, label = 'amount'): number {
  if (!Number.isFinite(value)) {
    throw new MoneyError(`${label} must be a finite number, got ${value}`)
  }
  if (!Number.isInteger(value)) {
    throw new MoneyError(`${label} must be an integer number of pesewas, got ${value}`)
  }
  if (Math.abs(value) > MAX_SAFE_PESEWAS) {
    throw new MoneyError(`${label} exceeds the safe integer range (${value})`)
  }
  return value
}

export function addPesewas(...values: number[]): number {
  let total = 0
  for (const value of values) {
    total += assertSafePesewas(value)
  }
  return assertSafePesewas(total, 'sum')
}

export function subtractPesewas(minuend: number, subtrahend: number): number {
  return assertSafePesewas(
    assertSafePesewas(minuend, 'minuend') - assertSafePesewas(subtrahend, 'subtrahend'),
    'difference'
  )
}

export function sumPesewas(values: Iterable<number>): number {
  let total = 0
  for (const value of values) {
    total += assertSafePesewas(value)
  }
  return assertSafePesewas(total, 'sum')
}

/**
 * Scale an amount, rounding half away from zero — GH₵ 0.005 becomes a full
 * pesewa in the direction the amount already points. Banker's rounding would be
 * defensible too, but half-up matches what a user sees on a receipt.
 *
 * Use for proportional maths (a share of income, a suggested contribution).
 * Never for summing: use `sumPesewas`.
 */
export function multiplyPesewas(amount: number, factor: number): number {
  assertSafePesewas(amount)
  if (!Number.isFinite(factor)) {
    throw new MoneyError(`factor must be a finite number, got ${factor}`)
  }
  const scaled = amount * factor
  const rounded = scaled < 0 ? -Math.round(-scaled) : Math.round(scaled)
  return assertSafePesewas(rounded, 'product')
}

/**
 * Split `total` into `parts` shares that sum back to exactly `total`.
 *
 * Naive division loses pesewas: GH₵ 10.00 over 3 months is 333 + 333 + 333 =
 * GH₵ 9.99. The remainder is distributed one pesewa at a time across the leading
 * shares, so the total is always conserved. Used for suggested periodic
 * contributions towards a goal.
 */
export function dividePesewas(total: number, parts: number): number[] {
  assertSafePesewas(total, 'total')
  if (!Number.isInteger(parts) || parts < 1) {
    throw new MoneyError(`parts must be a positive integer, got ${parts}`)
  }
  const sign = total < 0 ? -1 : 1
  const magnitude = Math.abs(total)
  const base = Math.floor(magnitude / parts)
  const remainder = magnitude - base * parts
  return Array.from({ length: parts }, (_, index) =>
    sign * (base + (index < remainder ? 1 : 0))
  )
}

/**
 * Percentage of `whole` represented by `part`, as a float for display only.
 *
 * This is the one function here that returns a non-integer, because a percentage
 * is not money. Never feed the result back into the money path. A `whole` of
 * zero yields 0 rather than Infinity — "0% of nothing spent" is what a progress
 * bar needs, and an unbudgeted category should not crash the dashboard.
 */
export function percentageOfPesewas(part: number, whole: number): number {
  assertSafePesewas(part, 'part')
  assertSafePesewas(whole, 'whole')
  if (whole === 0) return 0
  return (part / whole) * 100
}

const AMOUNT_PATTERN = /^(-?)(\d+)(?:\.(\d{1,2}))?$/

/**
 * Parse user input into integer pesewas.
 *
 * Accepts `"1234"`, `"1,234.5"`, `"GH₵ 1,234.56"`, `"₵1234.56"` and plain
 * numbers. Rejects anything with more than two decimal places rather than
 * rounding it: if someone types `12.345` they have made a mistake, and silently
 * picking an interpretation of their money is worse than asking again.
 *
 * The string path does integer arithmetic on the digits, so there is no
 * `value * 100` float multiply anywhere — `19.99` parses to exactly `1999`.
 */
export function parseAmountToPesewas(input: string | number): number {
  if (typeof input === 'number') {
    if (!Number.isFinite(input)) {
      throw new MoneyError(`Enter a valid amount, got ${input}`)
    }
    // Route through the string path so the digits, not the float, decide.
    return parseAmountToPesewas(input.toFixed(2))
  }

  const normalised = input
    .trim()
    .replace(/^(?:GH[₵S]|₵|GHS)\s*/i, '')
    .replace(/,/g, '')
    .replace(/\s/g, '')

  if (normalised === '') {
    throw new MoneyError('Enter an amount')
  }

  const match = AMOUNT_PATTERN.exec(normalised)
  if (!match) {
    throw new MoneyError(`"${input}" is not a valid amount. Use up to two decimal places.`)
  }

  const [, sign, whole, fraction = ''] = match
  const pesewas = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return assertSafePesewas(sign === '-' ? -pesewas : pesewas, 'amount')
}

/**
 * Pesewas to a cedi float. **Display and charting only** — the return value is
 * a float and must never re-enter the money path.
 */
export function pesewasToCedis(value: number): number {
  return assertSafePesewas(value) / 100
}

/**
 * Pesewas to the plain amount a person would type: `8740` → `"87.40"`.
 *
 * Integer arithmetic on the digits, the mirror of `parseAmountToPesewas`, so
 * prefilling an edit form and parsing it back is lossless. Use this, not
 * `pesewasToCedis`, wherever the result goes back into a request.
 */
export function pesewasToAmountString(value: number): string {
  const safe = assertSafePesewas(value)
  const abs = Math.abs(safe)
  const whole = Math.trunc(abs / 100)
  const fraction = String(abs % 100).padStart(2, '0')
  return `${safe < 0 ? '-' : ''}${whole}.${fraction}`
}
