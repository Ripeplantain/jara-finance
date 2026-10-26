import { describe, expect, it } from 'vitest'
import {
  BUDGET_WATCH_THRESHOLD_PERCENT,
  deriveBudgetPaceStatus,
  deriveProgress,
  periodElapsedPercentage
} from '#shared/money/progress'

describe('deriveProgress', () => {
  it('reports an untouched budget as nothing used', () => {
    const progress = deriveProgress(0, 60_000)
    expect(progress.percentUsed).toBe(0)
    expect(progress.remainingPesewas).toBe(60_000)
    expect(progress.isOver).toBe(false)
  })

  it('computes a partial spend', () => {
    // GH₵87.40 of a GH₵600 food budget
    const progress = deriveProgress(8_740, 60_000)
    expect(progress.remainingPesewas).toBe(51_260)
    expect(progress.percentUsed).toBeCloseTo(14.57, 2)
    expect(progress.percentForBar).toBeCloseTo(14.57, 2)
  })

  it('reports an overspend past 100% rather than clamping the figure', () => {
    // GH₵400 against a GH₵300 cap. A bar showing 100% would hide the overspend,
    // so the number and the bar width are deliberately different values.
    const progress = deriveProgress(40_000, 30_000)
    expect(progress.percentUsed).toBeCloseTo(133.33, 2)
    expect(progress.percentForBar).toBe(100)
    expect(progress.remainingPesewas).toBe(-10_000)
    expect(progress.isOver).toBe(true)
  })

  it('treats an exactly met target as met but not over', () => {
    const progress = deriveProgress(30_000, 30_000)
    expect(progress.isOver).toBe(false)
    expect(progress.isExactlyMet).toBe(true)
    expect(progress.remainingPesewas).toBe(0)
    expect(progress.percentUsed).toBe(100)
  })

  it('survives a zero target instead of dividing by zero', () => {
    // An unbudgeted category must not crash the dashboard.
    const progress = deriveProgress(5_000, 0)
    expect(progress.percentUsed).toBe(0)
    expect(progress.percentForBar).toBe(0)
    expect(progress.isOver).toBe(true)
    expect(progress.isExactlyMet).toBe(false)
  })

  it('reports zero of zero as neither over nor met', () => {
    const progress = deriveProgress(0, 0)
    expect(progress.isOver).toBe(false)
    expect(progress.isExactlyMet).toBe(false)
  })
})

describe('periodElapsedPercentage', () => {
  it('reports the share of a month that has passed', () => {
    // Day 23 of 31
    expect(periodElapsedPercentage(23, 31)).toBeCloseTo(74.19, 2)
  })

  it('clamps beyond the period rather than exceeding 100', () => {
    expect(periodElapsedPercentage(40, 31)).toBe(100)
    expect(periodElapsedPercentage(-5, 31)).toBe(0)
  })

  it('returns zero for an empty period instead of dividing by zero', () => {
    expect(periodElapsedPercentage(5, 0)).toBe(0)
  })
})

describe('deriveBudgetPaceStatus', () => {
  it('names the watch threshold as 85', () => {
    expect(BUDGET_WATCH_THRESHOLD_PERCENT).toBe(85)
  })

  it('is on track with nothing spent', () => {
    expect(deriveBudgetPaceStatus(0, 60_000)).toBe('on-track')
  })

  it('has no verdict for a zero target, spent or not', () => {
    expect(deriveBudgetPaceStatus(0, 0)).toBe('unbudgeted')
    expect(deriveBudgetPaceStatus(5_000, 0)).toBe('unbudgeted')
  })

  it('stays on track just under 85%', () => {
    // 84.99 of 100.00
    expect(deriveBudgetPaceStatus(8_499, 10_000)).toBe('on-track')
  })

  it('watches from exactly 85%', () => {
    expect(deriveBudgetPaceStatus(8_500, 10_000)).toBe('watch')
    // Integer comparison, so these hold regardless of float rounding.
    expect(deriveBudgetPaceStatus(17, 20)).toBe('watch')
    expect(deriveBudgetPaceStatus(85, 100)).toBe('watch')
  })

  it('watches just over 85%', () => {
    expect(deriveBudgetPaceStatus(8_501, 10_000)).toBe('watch')
  })

  it('watches, not over, when the cap is exactly met', () => {
    expect(deriveBudgetPaceStatus(10_000, 10_000)).toBe('watch')
  })

  it('is over only strictly past the cap', () => {
    expect(deriveBudgetPaceStatus(10_001, 10_000)).toBe('over')
    expect(deriveBudgetPaceStatus(40_000, 30_000)).toBe('over')
  })

  it('agrees with deriveProgress.isOver wherever there is a cap', () => {
    for (const [actual, target] of [[0, 1], [99, 100], [100, 100], [101, 100], [1, 1_000_000]] as const) {
      expect(deriveBudgetPaceStatus(actual, target) === 'over').toBe(deriveProgress(actual, target).isOver)
    }
  })

  it('does not overflow near the safe-integer limit', () => {
    const big = Number.MAX_SAFE_INTEGER
    expect(deriveBudgetPaceStatus(big, big)).toBe('watch')
    expect(deriveBudgetPaceStatus(big - 1, big)).toBe('watch')
  })
})
