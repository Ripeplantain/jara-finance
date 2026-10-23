import { describe, expect, it } from 'vitest'
import {
  addDays,
  addMonths,
  assertIsoDate,
  compareIsoDates,
  DateRangeError,
  daysBetweenInclusive,
  daysInMonth,
  endOfMonth,
  isIsoDate,
  monthsBetween,
  startOfMonth,
  todayInTimezone
} from '#shared/period/dates'
import {
  budgetPeriodFor,
  currentBudgetPeriod,
  monthLabel,
  periodLabel,
  resolvePeriod
} from '#shared/period/month'

describe('isIsoDate', () => {
  it.each(['2026-10-17', '2024-02-29', '2026-01-01', '2026-12-31'])('accepts %s', (date) => {
    expect(isIsoDate(date)).toBe(true)
  })

  it.each([
    '2026-02-30', // February has no 30th
    '2025-02-29', // 2025 is not a leap year
    '2026-13-01', // no 13th month
    '2026-00-10',
    '2026-10-32',
    '2026-10-0',
    '26-10-17',
    '2026/10/17',
    '2026-10-17T00:00:00Z',
    '',
    null,
    undefined,
    20261017
  ])('rejects %o', (value) => {
    expect(isIsoDate(value)).toBe(false)
  })

  it('throws a labelled error from assertIsoDate', () => {
    expect(() => assertIsoDate('2026-02-30', 'occurredOn')).toThrow(DateRangeError)
    expect(() => assertIsoDate('nope', 'occurredOn')).toThrow(/occurredOn/)
  })
})

describe('daysInMonth', () => {
  it('knows the ordinary months', () => {
    expect(daysInMonth(2026, 1)).toBe(31)
    expect(daysInMonth(2026, 4)).toBe(30)
    expect(daysInMonth(2026, 12)).toBe(31)
  })

  it('handles leap years, including the century rules', () => {
    expect(daysInMonth(2026, 2)).toBe(28)
    expect(daysInMonth(2024, 2)).toBe(29)
    expect(daysInMonth(1900, 2)).toBe(28) // divisible by 100, not 400
    expect(daysInMonth(2000, 2)).toBe(29) // divisible by 400
  })
})

describe('month boundaries', () => {
  it('finds the first and last day of a month', () => {
    expect(startOfMonth('2026-10-17')).toBe('2026-10-01')
    expect(endOfMonth('2026-10-17')).toBe('2026-10-31')
  })

  it('gets February right in both leap and common years', () => {
    expect(endOfMonth('2024-02-10')).toBe('2024-02-29')
    expect(endOfMonth('2026-02-10')).toBe('2026-02-28')
  })

  it('is idempotent on an already-boundary date', () => {
    expect(startOfMonth('2026-10-01')).toBe('2026-10-01')
    expect(endOfMonth('2026-10-31')).toBe('2026-10-31')
  })
})

describe('addMonths', () => {
  it('rolls December into January of the next year', () => {
    expect(addMonths('2026-12-15', 1)).toBe('2027-01-15')
    expect(addMonths('2026-12-01', 1)).toBe('2027-01-01')
  })

  it('rolls January back into December of the previous year', () => {
    expect(addMonths('2026-01-15', -1)).toBe('2025-12-15')
    expect(addMonths('2026-01-01', -1)).toBe('2025-12-01')
  })

  it('clamps the day to the target month rather than overflowing into the next', () => {
    expect(addMonths('2026-03-31', -1)).toBe('2026-02-28')
    expect(addMonths('2024-03-31', -1)).toBe('2024-02-29')
    expect(addMonths('2026-01-31', 1)).toBe('2026-02-28')
    expect(addMonths('2026-03-31', 1)).toBe('2026-04-30')
  })

  it('spans multiple years in both directions', () => {
    expect(addMonths('2026-10-17', 15)).toBe('2028-01-17')
    expect(addMonths('2026-10-17', -22)).toBe('2024-12-17')
  })

  it('is a no-op for zero', () => {
    expect(addMonths('2026-10-17', 0)).toBe('2026-10-17')
  })
})

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
    expect(addDays('2027-01-01', -1)).toBe('2026-12-31')
  })

  it('crosses a leap day', () => {
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(addDays('2026-02-28', 1)).toBe('2026-03-01')
  })
})

describe('daysBetweenInclusive', () => {
  it('counts a single day as one', () => {
    expect(daysBetweenInclusive('2026-10-17', '2026-10-17')).toBe(1)
  })

  it('counts a full month', () => {
    expect(daysBetweenInclusive('2026-10-01', '2026-10-31')).toBe(31)
    expect(daysBetweenInclusive('2026-02-01', '2026-02-28')).toBe(28)
  })

  it('counts across a year boundary', () => {
    expect(daysBetweenInclusive('2026-12-31', '2027-01-01')).toBe(2)
  })
})

describe('monthsBetween', () => {
  it('counts whole calendar months across a year boundary', () => {
    expect(monthsBetween('2026-10-01', '2027-01-01')).toBe(3)
    expect(monthsBetween('2026-10-31', '2027-01-01')).toBe(3)
    expect(monthsBetween('2026-10-01', '2026-10-31')).toBe(0)
  })
})

describe('compareIsoDates', () => {
  it('orders dates', () => {
    expect(compareIsoDates('2026-01-01', '2026-10-01')).toBe(-1)
    expect(compareIsoDates('2026-10-01', '2026-01-01')).toBe(1)
    expect(compareIsoDates('2026-10-01', '2026-10-01')).toBe(0)
  })
})

describe('todayInTimezone', () => {
  it('returns the local calendar day, not the UTC one', () => {
    // 23:30 UTC on 17 Oct. Accra is UTC+0 so it is still the 17th there, but
    // Auckland (UTC+13) has already rolled over to the 18th. This is the exact
    // class of bug that would date a transaction to the wrong month.
    const instant = new Date('2026-10-17T23:30:00Z')
    expect(todayInTimezone('Africa/Accra', instant)).toBe('2026-10-17')
    expect(todayInTimezone('Pacific/Auckland', instant)).toBe('2026-10-18')
  })

  it('handles the other side of midnight', () => {
    const instant = new Date('2026-10-18T02:00:00Z')
    expect(todayInTimezone('Africa/Accra', instant)).toBe('2026-10-18')
    expect(todayInTimezone('America/Los_Angeles', instant)).toBe('2026-10-17')
  })

  it('rejects a timezone the platform does not know', () => {
    expect(() => todayInTimezone('Africa/Atlantis')).toThrow(DateRangeError)
  })
})

describe('resolvePeriod', () => {
  const accra = 'Africa/Accra'
  const midOctober = new Date('2026-10-17T12:00:00Z')

  it('resolves this_month to inclusive month bounds', () => {
    const period = resolvePeriod({ kind: 'this_month' }, accra, midOctober)
    expect(period).toMatchObject({ start: '2026-10-01', end: '2026-10-31', days: 31 })
    expect(period.label).toBe('October 2026')
  })

  it('defaults to this_month when no kind is given', () => {
    expect(resolvePeriod({}, accra, midOctober).kind).toBe('this_month')
  })

  it('resolves last_month across a year boundary', () => {
    const january = new Date('2027-01-09T12:00:00Z')
    const period = resolvePeriod({ kind: 'last_month' }, accra, january)
    expect(period).toMatchObject({ start: '2026-12-01', end: '2026-12-31' })
    expect(period.label).toBe('December 2026')
  })

  it('resolves last_month into February correctly', () => {
    const march = new Date('2024-03-31T12:00:00Z')
    const period = resolvePeriod({ kind: 'last_month' }, accra, march)
    expect(period).toMatchObject({ start: '2024-02-01', end: '2024-02-29' })
  })

  it('makes last_30_days span exactly 30 days including today', () => {
    const period = resolvePeriod({ kind: 'last_30_days' }, accra, midOctober)
    expect(period).toMatchObject({ start: '2026-09-18', end: '2026-10-17', days: 30 })
  })

  it('resolves this_year', () => {
    const period = resolvePeriod({ kind: 'this_year' }, accra, midOctober)
    expect(period).toMatchObject({ start: '2026-01-01', end: '2026-12-31' })
    expect(period.label).toBe('2026')
  })

  it('resolves all_time up to today', () => {
    const period = resolvePeriod({ kind: 'all_time' }, accra, midOctober)
    expect(period).toMatchObject({ start: '1970-01-01', end: '2026-10-17' })
    expect(period.label).toBe('All time')
  })

  it('resolves a custom range', () => {
    const period = resolvePeriod(
      { kind: 'custom', start: '2026-10-05', end: '2026-10-09' },
      accra,
      midOctober
    )
    expect(period).toMatchObject({ start: '2026-10-05', end: '2026-10-09', days: 5 })
  })

  it('rejects a custom range that runs backwards', () => {
    expect(() =>
      resolvePeriod({ kind: 'custom', start: '2026-10-09', end: '2026-10-05' }, accra, midOctober)
    ).toThrow(/after end/)
  })

  it('rejects a custom range with invalid or missing bounds', () => {
    expect(() => resolvePeriod({ kind: 'custom', start: '2026-10-05' }, accra, midOctober)).toThrow(
      DateRangeError
    )
    expect(() =>
      resolvePeriod({ kind: 'custom', start: 'yesterday', end: '2026-10-05' }, accra, midOctober)
    ).toThrow(DateRangeError)
  })

  it('resolves relative to the user timezone, not the server', () => {
    // 23:30 UTC on 31 October: still October in Accra, already November in Auckland.
    const instant = new Date('2026-10-31T23:30:00Z')
    expect(resolvePeriod({ kind: 'this_month' }, 'Africa/Accra', instant).start).toBe('2026-10-01')
    expect(resolvePeriod({ kind: 'this_month' }, 'Pacific/Auckland', instant).start).toBe(
      '2026-11-01'
    )
  })
})

describe('budget periods', () => {
  it('pins a budget to the first of its month', () => {
    expect(budgetPeriodFor('2026-10-17')).toEqual({
      periodStart: '2026-10-01',
      periodEnd: '2026-10-31'
    })
  })

  it('reads the current budget month from the user timezone', () => {
    const instant = new Date('2026-12-31T23:30:00Z')
    expect(currentBudgetPeriod('Africa/Accra', instant).periodStart).toBe('2026-12-01')
    expect(currentBudgetPeriod('Pacific/Auckland', instant).periodStart).toBe('2027-01-01')
  })
})

describe('labels', () => {
  it('names a month', () => {
    expect(monthLabel('2026-10-01')).toBe('October 2026')
    expect(monthLabel('2027-01-31')).toBe('January 2027')
  })

  it('collapses a whole month to the month name', () => {
    expect(periodLabel('2026-10-01', '2026-10-31')).toBe('October 2026')
  })

  it('drops the repeated month inside a single month', () => {
    expect(periodLabel('2026-10-05', '2026-10-09')).toBe('5–9 Oct 2026')
  })

  it('spells out both months when the range crosses one', () => {
    expect(periodLabel('2026-09-18', '2026-10-17')).toBe('18 Sep – 17 Oct 2026')
  })

  it('spells out both years when the range crosses one', () => {
    expect(periodLabel('2026-12-20', '2027-01-05')).toBe('20 Dec 2026 – 5 Jan 2027')
  })
})
