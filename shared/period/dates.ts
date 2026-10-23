/**
 * Calendar-date arithmetic for an app whose ledger is dated by day, not instant.
 *
 * `transactions.occurredOn` is a Postgres `date`, so every reporting boundary is
 * also a date. That lets this whole module be pure integer arithmetic on
 * `YYYY-MM-DD` strings — no `Date` objects in the month maths at all, which
 * makes an off-by-one-day DST or UTC bug structurally impossible rather than
 * merely unlikely.
 *
 * Exactly one function needs a timezone: `todayInTimezone`, which answers "what
 * day is it where the user is". Everything downstream flows from its result.
 */

/** A calendar date as `YYYY-MM-DD`. The only date format stored or compared. */
export type IsoDate = string

const ISO_DATE_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/

/** The floor for "all time" ranges — the Unix epoch, before any plausible record. */
export const EARLIEST_DATE: IsoDate = '1970-01-01'

export class DateRangeError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'DateRangeError'
  }
}

export interface DateParts {
  year: number
  /** 1-12. One-based, matching how the string reads — not JS's 0-11. */
  month: number
  day: number
}

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== 'string') return false
  const match = ISO_DATE_PATTERN.exec(value)
  if (!match) return false
  const [, year, month, day] = match
  const parts = { year: Number(year), month: Number(month), day: Number(day) }
  if (parts.month < 1 || parts.month > 12) return false
  return parts.day >= 1 && parts.day <= daysInMonth(parts.year, parts.month)
}

export function assertIsoDate(value: unknown, label = 'date'): IsoDate {
  if (!isIsoDate(value)) {
    throw new DateRangeError(`${label} must be a valid YYYY-MM-DD date, got ${String(value)}`)
  }
  return value
}

export function parseIsoDate(value: IsoDate): DateParts {
  const match = ISO_DATE_PATTERN.exec(assertIsoDate(value))!
  return { year: Number(match[1]), month: Number(match[2]), day: Number(match[3]) }
}

export function toIsoDate({ year, month, day }: DateParts): IsoDate {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

/** Days in a given one-based month, leap years included. */
export function daysInMonth(year: number, month: number): number {
  if (month === 2) {
    const isLeap = (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0
    return isLeap ? 29 : 28
  }
  return [4, 6, 9, 11].includes(month) ? 30 : 31
}

/**
 * Today's calendar date in an IANA timezone.
 *
 * Built on `Intl.DateTimeFormat` parts rather than any date library: the
 * platform's own tzdata is the authority, and reading the parts avoids trusting
 * a locale to produce a particular string shape.
 */
export function todayInTimezone(timezone: string, now: Date = new Date()): IsoDate {
  let parts: Intl.DateTimeFormatPart[]
  try {
    parts = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit'
    }).formatToParts(now)
  } catch {
    throw new DateRangeError(`"${timezone}" is not a recognised IANA timezone`)
  }

  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value
  const year = read('year')
  const month = read('month')
  const day = read('day')
  if (!year || !month || !day) {
    throw new DateRangeError(`Could not resolve today's date in timezone "${timezone}"`)
  }
  return assertIsoDate(`${year}-${month}-${day}`)
}

/** Lexicographic comparison is correct for zero-padded ISO dates. */
export function compareIsoDates(a: IsoDate, b: IsoDate): number {
  const left = assertIsoDate(a, 'a')
  const right = assertIsoDate(b, 'b')
  return left < right ? -1 : left > right ? 1 : 0
}

export function startOfMonth(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date)
  return toIsoDate({ year, month, day: 1 })
}

export function endOfMonth(date: IsoDate): IsoDate {
  const { year, month } = parseIsoDate(date)
  return toIsoDate({ year, month, day: daysInMonth(year, month) })
}

/**
 * Shift by whole months, clamping the day to the target month's length so
 * 31 January minus one month is 31 December and 31 March plus one month is
 * 30 April rather than an invalid date or a silent roll into May.
 */
export function addMonths(date: IsoDate, months: number): IsoDate {
  const { year, month, day } = parseIsoDate(date)
  const zeroBased = year * 12 + (month - 1) + months
  const targetYear = Math.floor(zeroBased / 12)
  const targetMonth = (zeroBased % 12) + 1
  return toIsoDate({
    year: targetYear,
    month: targetMonth,
    day: Math.min(day, daysInMonth(targetYear, targetMonth))
  })
}

/**
 * Shift by days. `Date.UTC` is used purely as a civil-calendar calculator — UTC
 * has no DST, so the arithmetic carries no timezone semantics.
 */
export function addDays(date: IsoDate, days: number): IsoDate {
  const { year, month, day } = parseIsoDate(date)
  const shifted = new Date(Date.UTC(year, month - 1, day + days))
  return toIsoDate({
    year: shifted.getUTCFullYear(),
    month: shifted.getUTCMonth() + 1,
    day: shifted.getUTCDate()
  })
}

/** Inclusive day count. The same date start and end is one day, not zero. */
export function daysBetweenInclusive(start: IsoDate, end: IsoDate): number {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)
  const millis =
    Date.UTC(to.year, to.month - 1, to.day) - Date.UTC(from.year, from.month - 1, from.day)
  return Math.round(millis / 86_400_000) + 1
}

/** Whole calendar months from `start` to `end`, ignoring the day of month. */
export function monthsBetween(start: IsoDate, end: IsoDate): number {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)
  return (to.year - from.year) * 12 + (to.month - from.month)
}
