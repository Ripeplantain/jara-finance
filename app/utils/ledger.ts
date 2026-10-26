/**
 * Presentation helpers for ledger rows, shared by Home and Transactions.
 *
 * Wording and date formatting only — no amounts are computed here. Dates are
 * formatted in UTC from the ISO string the server sent, so the day on screen is
 * the day the user recorded, in every browser timezone.
 */
import { parseIsoDate } from '#shared/period/dates'

export interface LedgerEntry {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amountPesewas: number
  occurredOn: string
  note: string | null
  merchant: string | null
  transferDirection: 'in' | 'out' | null
  accountName: string
  categoryName: string | null
  categoryIcon: string | null
  categoryColorIndex: number | null
}

function utcDate(iso: string): Date {
  const { year, month, day } = parseIsoDate(iso)
  return new Date(Date.UTC(year, month - 1, day))
}

/** "24 Oct" */
export function formatDayShort(iso: string): string {
  return utcDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

/** "15 Dec 2026" — a date that is not this month's, such as a goal's deadline. */
export function formatDayWithYear(iso: string): string {
  return utcDate(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}

/** "Friday 24 October 2026" */
export function formatDayLong(iso: string): string {
  return utcDate(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC'
  })
}

/** "Monday 26 October", v1's heading date: the year is implied by "today". */
export function formatWeekdayDate(iso: string): string {
  return utcDate(iso).toLocaleDateString('en-GB', {
    weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC'
  })
}

/** "October", from "2026-10" or any ISO date in that month. */
export function formatMonthName(iso: string): string {
  return utcDate(`${iso.slice(0, 7)}-01`).toLocaleDateString('en-GB', { month: 'long', timeZone: 'UTC' })
}

/** "October 2026", from "2026-10" or any ISO date in that month. */
export function formatMonthHeading(iso: string): string {
  return utcDate(`${iso.slice(0, 7)}-01`).toLocaleDateString('en-GB', {
    month: 'long', year: 'numeric', timeZone: 'UTC'
  })
}

export function entryTitle(entry: LedgerEntry): string {
  return entry.merchant || entry.categoryName || (entry.type === 'transfer' ? 'Transfer' : 'Uncategorised')
}

export function entryTypeLabel(entry: LedgerEntry): string {
  return entry.type === 'income' ? 'Income' : entry.type === 'expense' ? 'Expense' : 'Transfer'
}

/** Category · account · date, with the direction spelled out for transfers. */
export function entrySubline(entry: LedgerEntry): string {
  const parts: string[] = []
  if (entry.type === 'transfer') {
    parts.push(entry.transferDirection === 'in' ? 'Received' : 'Sent')
  } else if (entry.categoryName && entry.merchant) {
    parts.push(entry.categoryName)
  }
  parts.push(entry.accountName, formatDayShort(entry.occurredOn))
  return parts.join(' · ')
}

/** Spoken form of a row, for a button that opens it. */
export function entryAriaLabel(entry: LedgerEntry): string {
  return `${entryTitle(entry)}, ${entryTypeLabel(entry)}, ${entrySubline(entry)}. Open details`
}

const COUNT_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

/** 3 → "Three", for a sentence that opens with a count; 12 stays "12". */
export function countWord(count: number): string {
  return COUNT_WORDS[count] ?? String(count)
}
