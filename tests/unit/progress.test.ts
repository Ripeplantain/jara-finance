import { describe, expect, it } from 'vitest'
import { deriveProgress, periodElapsedPercentage } from '#shared/money/progress'

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
