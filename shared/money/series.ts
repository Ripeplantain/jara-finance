import { addPesewas } from './pesewas'

/**
 * Presentation-shaped series built from per-period sums the database already
 * produced. Pure, so the gap-filling and the word for a comparison are tested
 * once rather than re-derived by each screen.
 */

export interface MonthTotal {
  /** `YYYY-MM`. */
  month: string
  incomePesewas: number
  expensePesewas: number
  savedPesewas: number
}

/**
 * One point per requested month. A month with no rows is a real zero, not a
 * missing point: a chart that skipped it would stretch the neighbours together
 * and hide that nothing happened.
 */
export function fillMonthlySeries(
  months: readonly string[],
  rows: ReadonlyArray<Partial<MonthTotal> & { month: string }>
): MonthTotal[] {
  const byMonth = new Map(rows.map(row => [row.month, row]))
  return months.map((month) => {
    const row = byMonth.get(month)
    return {
      month,
      incomePesewas: row?.incomePesewas ?? 0,
      expensePesewas: row?.expensePesewas ?? 0,
      savedPesewas: row?.savedPesewas ?? 0
    }
  })
}

/** Running total of per-day amounts, one entry per input. */
export function cumulativeSeries(values: readonly number[]): number[] {
  let running = 0
  return values.map((value) => {
    running = addPesewas(running, value)
    return running
  })
}

export type SpendDirection = 'more' | 'less' | 'same'

/** How this period's spend compares with the previous one, as a word the UI can print. */
export function compareSpend(currentPesewas: number, previousPesewas: number): SpendDirection {
  if (currentPesewas > previousPesewas) return 'more'
  if (currentPesewas < previousPesewas) return 'less'
  return 'same'
}
