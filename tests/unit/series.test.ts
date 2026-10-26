import { describe, expect, it } from 'vitest'
import { compareSpend, cumulativeSeries, fillMonthlySeries } from '#shared/money/series'
import { lastMonthsWindow, lastMonthStarts, monthKey, shortMonthLabel } from '#shared/period/series'

describe('lastMonthStarts', () => {
  it('returns the last six month starts, oldest first, ending with this month', () => {
    expect(lastMonthStarts('2026-10-26', 6)).toEqual([
      '2026-05-01', '2026-06-01', '2026-07-01', '2026-08-01', '2026-09-01', '2026-10-01'
    ])
  })

  it('crosses a year boundary', () => {
    expect(lastMonthStarts('2026-02-10', 4)).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01'])
  })

  it('covers the whole of the final month in the window', () => {
    expect(lastMonthsWindow('2026-10-26', 6)).toEqual({ start: '2026-05-01', end: '2026-10-31' })
  })
})

describe('month labels', () => {
  it('labels and keys a month', () => {
    expect(shortMonthLabel('2026-05-01')).toBe('May')
    expect(monthKey('2026-05-17')).toBe('2026-05')
  })
})

describe('fillMonthlySeries', () => {
  it('fills months with no rows with zeros instead of skipping them', () => {
    const series = fillMonthlySeries(['2026-08', '2026-09'], [
      { month: '2026-09', incomePesewas: 100, expensePesewas: 40 }
    ])
    expect(series).toEqual([
      { month: '2026-08', incomePesewas: 0, expensePesewas: 0, savedPesewas: 0 },
      { month: '2026-09', incomePesewas: 100, expensePesewas: 40, savedPesewas: 0 }
    ])
  })

  it('ignores rows outside the requested months', () => {
    expect(fillMonthlySeries(['2026-09'], [{ month: '2020-01', incomePesewas: 5 }])[0]!.incomePesewas).toBe(0)
  })
})

describe('cumulativeSeries', () => {
  it('keeps a running total', () => {
    expect(cumulativeSeries([100, 0, 250])).toEqual([100, 100, 350])
  })

  it('refuses a fractional amount', () => {
    expect(() => cumulativeSeries([1.5])).toThrow()
  })
})

describe('compareSpend', () => {
  it('names the direction of the change', () => {
    expect(compareSpend(10, 5)).toBe('more')
    expect(compareSpend(5, 10)).toBe('less')
    expect(compareSpend(5, 5)).toBe('same')
  })
})
