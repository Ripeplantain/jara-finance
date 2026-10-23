import { assertSafePesewas, pesewasToCedis } from './pesewas'

const DEFAULT_LOCALE = 'en-GH'
const DEFAULT_CURRENCY = 'GHS'

// Intl.NumberFormat construction is not free and money is formatted hundreds of
// times per page, so instances are memoised per option set.
const formatterCache = new Map<string, Intl.NumberFormat>()

function formatter(locale: string, options: Intl.NumberFormatOptions): Intl.NumberFormat {
  const key = `${locale}:${JSON.stringify(options)}`
  let cached = formatterCache.get(key)
  if (!cached) {
    cached = new Intl.NumberFormat(locale, options)
    formatterCache.set(key, cached)
  }
  return cached
}

export interface FormatMoneyOptions {
  currency?: string
  locale?: string
  /** Drop the `.00` on whole-cedi amounts. For dense tables and chart labels. */
  hideZeroDecimals?: boolean
}

/** `1234567` → `"GH₵1,234,567.00"`. */
export function formatPesewas(value: number, options: FormatMoneyOptions = {}): string {
  assertSafePesewas(value)
  const {
    currency = DEFAULT_CURRENCY,
    locale = DEFAULT_LOCALE,
    hideZeroDecimals = false
  } = options
  const fractionDigits = hideZeroDecimals && value % 100 === 0 ? 0 : 2
  return formatter(locale, {
    style: 'currency',
    currency,
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits
  }).format(pesewasToCedis(value))
}

/**
 * Money with an explicit direction: `"+GH₵20.00"` / `"−GH₵20.00"`.
 *
 * Uses U+2212 MINUS SIGN, not a hyphen, so negatives line up with digits in
 * tabular figures instead of looking like a dash. Zero gets no sign.
 */
export function formatSignedPesewas(value: number, options: FormatMoneyOptions = {}): string {
  const magnitude = formatPesewas(Math.abs(value), options)
  if (value === 0) return magnitude
  return `${value > 0 ? '+' : '−'}${magnitude}`
}

/** `1234567` → `"GH₵1.2M"`. Chart axes and tight summary cards only. */
export function formatPesewasCompact(value: number, options: FormatMoneyOptions = {}): string {
  assertSafePesewas(value)
  const { currency = DEFAULT_CURRENCY, locale = DEFAULT_LOCALE } = options
  return formatter(locale, {
    style: 'currency',
    currency,
    notation: 'compact',
    maximumFractionDigits: 1
  }).format(pesewasToCedis(value))
}

/**
 * `42.7` → `"43%"`. Percentages are rounded for display because a budget bar
 * showing "42.71428%" communicates nothing a reader can use.
 */
export function formatPercentage(value: number, locale = DEFAULT_LOCALE): string {
  return formatter(locale, {
    style: 'percent',
    maximumFractionDigits: 0
  }).format(value / 100)
}
