import { addMonths, endOfMonth, parseIsoDate, startOfMonth, type IsoDate } from './dates'

/**
 * Month windows for trend series. Pure date arithmetic, no timezone: callers
 * pass "today" already resolved in the user's own timezone.
 */

const SHORT_MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** First day of each of the last `count` months, oldest first, ending with today's month. */
export function lastMonthStarts(today: IsoDate, count: number): IsoDate[] {
  const thisMonth = startOfMonth(today)
  return Array.from({ length: count }, (_, index) => addMonths(thisMonth, index - (count - 1)))
}

/** Inclusive bounds covering the last `count` months, ending with today's month. */
export function lastMonthsWindow(today: IsoDate, count: number): { start: IsoDate, end: IsoDate } {
  return { start: lastMonthStarts(today, count)[0]!, end: endOfMonth(today) }
}

/** `"2026-05-01"` → `"May"`. */
export function shortMonthLabel(date: IsoDate): string {
  return SHORT_MONTHS[parseIsoDate(date).month - 1]!
}

/** `"2026-05-17"` → `"2026-05"`. */
export const monthKey = (date: IsoDate): string => date.slice(0, 7)
