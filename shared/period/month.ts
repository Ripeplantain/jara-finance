import {
  addDays,
  addMonths,
  assertIsoDate,
  compareIsoDates,
  daysBetweenInclusive,
  EARLIEST_DATE,
  endOfMonth,
  parseIsoDate,
  startOfMonth,
  todayInTimezone,
  type IsoDate
} from './dates'

export const PERIOD_KINDS = [
  'this_month',
  'last_month',
  'last_30_days',
  'this_year',
  'all_time',
  'custom'
] as const

export type PeriodKind = (typeof PERIOD_KINDS)[number]

/**
 * A resolved reporting window. Both bounds are **inclusive**, which matches how
 * a user reads "1–31 October" and keeps every SQL predicate a plain
 * `occurred_on BETWEEN start AND end`.
 *
 * Every API response that reports figures carries its resolved period, so a
 * number on screen can always be traced to the window it was computed over —
 * and so the AI can state the window instead of implying one.
 */
export interface Period {
  kind: PeriodKind
  start: IsoDate
  end: IsoDate
  /** Human label, e.g. "October 2026" or "1 Oct – 17 Oct 2026". */
  label: string
  days: number
}

export interface ResolvePeriodInput {
  kind?: PeriodKind
  /** Required when `kind` is `custom`. */
  start?: IsoDate
  end?: IsoDate
}

/**
 * Turn a period request into concrete inclusive bounds, relative to today in
 * the user's own timezone.
 *
 * Period resolution happens server-side, never in the browser: a user travelling
 * or a device with a wrong clock must not change what "this month" means for
 * their records.
 */
export function resolvePeriod(
  input: ResolvePeriodInput,
  timezone: string,
  now: Date = new Date()
): Period {
  const today = todayInTimezone(timezone, now)
  const kind = input.kind ?? 'this_month'

  switch (kind) {
    case 'this_month':
      return buildPeriod(kind, startOfMonth(today), endOfMonth(today))

    case 'last_month': {
      const inLastMonth = addMonths(startOfMonth(today), -1)
      return buildPeriod(kind, inLastMonth, endOfMonth(inLastMonth))
    }

    // 30 days ending today, today included — hence -29, not -30.
    case 'last_30_days':
      return buildPeriod(kind, addDays(today, -29), today)

    case 'this_year': {
      const { year } = parseIsoDate(today)
      return buildPeriod(kind, `${year}-01-01`, `${year}-12-31`)
    }

    case 'all_time':
      return buildPeriod(kind, EARLIEST_DATE, today)

    case 'custom': {
      const start = assertIsoDate(input.start, 'start')
      const end = assertIsoDate(input.end, 'end')
      if (compareIsoDates(start, end) > 0) {
        throw new DateRangeOrderError(start, end)
      }
      return buildPeriod(kind, start, end)
    }
  }
}

class DateRangeOrderError extends Error {
  constructor(start: IsoDate, end: IsoDate) {
    super(`Period start ${start} is after end ${end}`)
    this.name = 'DateRangeOrderError'
  }
}

function buildPeriod(kind: PeriodKind, start: IsoDate, end: IsoDate): Period {
  return {
    kind,
    start,
    end,
    label: periodLabel(start, end),
    days: daysBetweenInclusive(start, end)
  }
}

/** The month a budget belongs to: its first day, which is also its identity. */
export function budgetPeriodFor(date: IsoDate): { periodStart: IsoDate, periodEnd: IsoDate } {
  return { periodStart: startOfMonth(date), periodEnd: endOfMonth(date) }
}

/** The current budget month in the user's timezone. */
export function currentBudgetPeriod(
  timezone: string,
  now: Date = new Date()
): { periodStart: IsoDate, periodEnd: IsoDate } {
  return budgetPeriodFor(todayInTimezone(timezone, now))
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

/** `"2026-10-01"` → `"October 2026"`. */
export function monthLabel(date: IsoDate): string {
  const { year, month } = parseIsoDate(date)
  return `${MONTH_NAMES[month - 1]} ${year}`
}

/**
 * Labels a range the way a person would say it: a whole calendar month collapses
 * to "October 2026", a range inside one month drops the repeated month name, and
 * only a range crossing months spells both out.
 */
export function periodLabel(start: IsoDate, end: IsoDate): string {
  const from = parseIsoDate(start)
  const to = parseIsoDate(end)

  if (start === EARLIEST_DATE) return 'All time'

  const spansWholeMonth =
    from.year === to.year && from.month === to.month && start === startOfMonth(start) && end === endOfMonth(end)
  if (spansWholeMonth) return monthLabel(start)

  if (from.year === to.year && from.month === 1 && from.day === 1 && to.month === 12 && to.day === 31) {
    return String(from.year)
  }

  const shortMonth = (month: number) => MONTH_NAMES[month - 1]!.slice(0, 3)

  if (from.year === to.year && from.month === to.month) {
    return `${from.day}–${to.day} ${shortMonth(from.month)} ${from.year}`
  }
  if (from.year === to.year) {
    return `${from.day} ${shortMonth(from.month)} – ${to.day} ${shortMonth(to.month)} ${from.year}`
  }
  return `${from.day} ${shortMonth(from.month)} ${from.year} – ${to.day} ${shortMonth(to.month)} ${to.year}`
}

export * from './dates'
