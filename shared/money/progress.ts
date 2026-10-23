import { percentageOfPesewas, subtractPesewas } from './pesewas'

/**
 * Progress against a target, in one place.
 *
 * Budgets ("spent GH₵340 of a GH₵500 cap") and goals ("saved GH₵1,200 of
 * GH₵5,000") ask the same question in opposite moods — one is bad to exceed,
 * the other good to reach — so they share the arithmetic and differ only in how
 * the UI words the result.
 *
 * Pure, with no database or Nuxt coupling, so the edge cases that actually bite
 * are unit-testable: a zero target, an overspend, an exactly-met cap.
 */
export interface Progress {
  /** What has happened so far. Always a positive magnitude. */
  actualPesewas: number
  /** The cap or target. */
  targetPesewas: number
  /** `target − actual`. Negative once the target is passed. */
  remainingPesewas: number
  /** Unclamped, so an overspend reads as 140% rather than a misleading 100%. */
  percentUsed: number
  /** Clamped to 0–100, for a progress bar's width. */
  percentForBar: number
  /** True once `actual` is strictly greater than `target`. */
  isOver: boolean
  /** True when `actual` exactly equals a non-zero `target`. */
  isExactlyMet: boolean
}

export function deriveProgress(actualPesewas: number, targetPesewas: number): Progress {
  const remainingPesewas = subtractPesewas(targetPesewas, actualPesewas)
  // `percentageOfPesewas` already answers 0 for a zero target rather than
  // Infinity — an unbudgeted category must not crash a dashboard.
  const percentUsed = percentageOfPesewas(actualPesewas, targetPesewas)

  return {
    actualPesewas,
    targetPesewas,
    remainingPesewas,
    percentUsed,
    percentForBar: Math.max(0, Math.min(100, percentUsed)),
    isOver: actualPesewas > targetPesewas,
    isExactlyMet: targetPesewas !== 0 && actualPesewas === targetPesewas
  }
}

/**
 * How much of the period has elapsed, as a percentage.
 *
 * Paired with `percentUsed`, this is what makes a budget bar honest: spending
 * 60% of a food budget is fine on day 20 of 31 and alarming on day 3. The UI
 * compares the two to decide whether to warn, and the AI is given both so it
 * can say which it is instead of guessing.
 */
export function periodElapsedPercentage(dayOfPeriod: number, totalDays: number): number {
  if (totalDays <= 0) return 0
  return Math.max(0, Math.min(100, (dayOfPeriod / totalDays) * 100))
}
