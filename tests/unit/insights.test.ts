import { describe, expect, it } from 'vitest'
import { deriveInsights, type InsightContext } from '#shared/money/insights'

const base: InsightContext = {
  currency: 'GHS',
  periodLabel: 'October 2026',
  previousPeriodLabel: 'September 2026',
  totalExpensePesewas: 0,
  totalIncomePesewas: 0,
  previousExpensePesewas: 0,
  topCategory: undefined,
  budgetOverruns: [],
  unusualExpenses: [],
  goalsOffTrack: []
}

const context = (overrides: Partial<InsightContext>): InsightContext => ({
  ...base,
  ...overrides
})

const kinds = (result: ReturnType<typeof deriveInsights>) => result.map(insight => insight.kind)

describe('deriveInsights', () => {
  it('says nothing about an empty month', () => {
    // A new user with no data must not be shown invented observations.
    expect(deriveInsights(base)).toEqual([])
  })

  describe('top category', () => {
    it('names a category that dominates spending', () => {
      const result = deriveInsights(
        context({
          totalExpensePesewas: 51_240,
          topCategory: { categoryId: 'cat-1', name: 'Transport', amountPesewas: 40_000 }
        })
      )
      expect(kinds(result)).toContain('top_category')
      expect(result[0]!.body).toContain('Transport')
      expect(result[0]!.body).toContain('GH₵400.00')
      // The period is always stated, so a figure can be traced to its window.
      expect(result[0]!.body).toContain('October 2026')
    })

    it('stays quiet when no category stands out', () => {
      // 15% of spending is not "your biggest expense" worth reporting.
      const result = deriveInsights(
        context({
          totalExpensePesewas: 100_000,
          topCategory: { categoryId: 'cat-1', name: 'Food', amountPesewas: 15_000 }
        })
      )
      expect(kinds(result)).not.toContain('top_category')
    })
  })

  describe('month over month', () => {
    it('reports a significant rise', () => {
      const result = deriveInsights(
        context({ totalExpensePesewas: 150_000, previousExpensePesewas: 100_000 })
      )
      const insight = result.find(row => row.kind === 'month_over_month')!
      expect(insight.severity).toBe('warning')
      expect(insight.body).toContain('more')
      expect(insight.payload.changePesewas).toBe(50_000)
    })

    it('reports a fall as information, not a warning', () => {
      const result = deriveInsights(
        context({ totalExpensePesewas: 70_000, previousExpensePesewas: 100_000 })
      )
      const insight = result.find(row => row.kind === 'month_over_month')!
      expect(insight.severity).toBe('info')
      expect(insight.body).toContain('less')
    })

    it('ignores a small change as noise', () => {
      const result = deriveInsights(
        context({ totalExpensePesewas: 105_000, previousExpensePesewas: 100_000 })
      )
      expect(kinds(result)).not.toContain('month_over_month')
    })

    it('says nothing when there is no previous month to compare against', () => {
      // Otherwise a first month reads as an infinite increase.
      const result = deriveInsights(
        context({ totalExpensePesewas: 100_000, previousExpensePesewas: 0 })
      )
      expect(kinds(result)).not.toContain('month_over_month')
    })
  })

  describe('budget overruns', () => {
    const overrun = {
      categoryId: 'cat-1',
      name: 'Transport',
      limitPesewas: 30_000,
      spentPesewas: 40_000,
      percentUsed: 133.33,
      periodElapsedPercent: 74
    }

    it('flags going over a cap as critical', () => {
      const result = deriveInsights(context({ budgetOverruns: [overrun] }))
      const insight = result.find(row => row.kind === 'budget_overrun')!
      expect(insight.severity).toBe('critical')
      expect(insight.body).toContain('GH₵100.00 over')
    })

    it('warns when spending outpaces the month even though the cap holds', () => {
      const result = deriveInsights(
        context({
          budgetOverruns: [
            { ...overrun, spentPesewas: 24_000, percentUsed: 80, periodElapsedPercent: 20 }
          ]
        })
      )
      const insight = result.find(row => row.kind === 'budget_overrun')!
      expect(insight.severity).toBe('warning')
      expect(insight.title).toContain('ahead of the month')
    })

    it('stays quiet when spending is in step with the month', () => {
      // This is what stops the app crying wolf on day two: 50% spent at 55%
      // through the month is fine.
      const result = deriveInsights(
        context({
          budgetOverruns: [
            { ...overrun, spentPesewas: 15_000, percentUsed: 50, periodElapsedPercent: 55 }
          ]
        })
      )
      expect(kinds(result)).not.toContain('budget_overrun')
    })
  })

  describe('unusual expenses', () => {
    it('flags an expense far above the category average', () => {
      const result = deriveInsights(
        context({
          unusualExpenses: [
            {
              transactionId: 'txn-1',
              categoryName: 'Food & Groceries',
              merchant: 'Melcom',
              amountPesewas: 30_000,
              categoryAveragePesewas: 5_000
            }
          ]
        })
      )
      const insight = result.find(row => row.kind === 'unusual_expense')!
      expect(insight.body).toContain('Melcom')
      expect(insight.body).toContain('6×')
    })

    it('ignores an expense only modestly above average', () => {
      const result = deriveInsights(
        context({
          unusualExpenses: [
            {
              transactionId: 'txn-1',
              categoryName: 'Food',
              merchant: null,
              amountPesewas: 7_000,
              categoryAveragePesewas: 5_000
            }
          ]
        })
      )
      expect(kinds(result)).not.toContain('unusual_expense')
    })

    it('does not divide by a zero average', () => {
      const result = deriveInsights(
        context({
          unusualExpenses: [
            {
              transactionId: 'txn-1',
              categoryName: 'Food',
              merchant: null,
              amountPesewas: 7_000,
              categoryAveragePesewas: 0
            }
          ]
        })
      )
      expect(kinds(result)).not.toContain('unusual_expense')
    })
  })

  describe('savings rate', () => {
    it('reports spending more than was earned as critical', () => {
      const result = deriveInsights(
        context({ totalIncomePesewas: 100_000, totalExpensePesewas: 130_000 })
      )
      const insight = result.find(row => row.kind === 'savings_rate')!
      expect(insight.severity).toBe('critical')
      expect(insight.body).toContain('GH₵300.00 more than you earned')
    })

    it('warns on a thin savings rate', () => {
      const result = deriveInsights(
        context({ totalIncomePesewas: 100_000, totalExpensePesewas: 95_000 })
      )
      const insight = result.find(row => row.kind === 'savings_rate')!
      expect(insight.severity).toBe('warning')
      expect(insight.payload.savingsRatePercent).toBeCloseTo(5, 5)
    })

    it('stays quiet on a healthy savings rate', () => {
      const result = deriveInsights(
        context({ totalIncomePesewas: 350_000, totalExpensePesewas: 51_240 })
      )
      expect(kinds(result)).not.toContain('savings_rate')
    })

    it('says nothing when there was no income to measure against', () => {
      const result = deriveInsights(context({ totalExpensePesewas: 50_000 }))
      expect(kinds(result)).not.toContain('savings_rate')
    })
  })

  describe('goals', () => {
    it('reports a dated goal that is behind', () => {
      const result = deriveInsights(
        context({
          goalsOffTrack: [
            { goalId: 'goal-1', name: 'Laptop', remainingPesewas: 450_000, monthsRemaining: 6 }
          ]
        })
      )
      const insight = result.find(row => row.kind === 'goal_off_track')!
      expect(insight.body).toContain('Laptop')
      expect(insight.body).toContain('6 months')
    })

    it('words a goal past its date differently', () => {
      const result = deriveInsights(
        context({
          goalsOffTrack: [
            { goalId: 'goal-1', name: 'Laptop', remainingPesewas: 100_000, monthsRemaining: 0 }
          ]
        })
      )
      const insight = result.find(row => row.kind === 'goal_off_track')!
      expect(insight.body).toContain('past its date')
    })
  })

  it('gives every insight a stable dedupe key so a recompute upserts', () => {
    const built = context({
      totalExpensePesewas: 51_240,
      totalIncomePesewas: 60_000,
      previousExpensePesewas: 20_000,
      topCategory: { categoryId: 'cat-1', name: 'Transport', amountPesewas: 40_000 },
      budgetOverruns: [
        {
          categoryId: 'cat-1',
          name: 'Transport',
          limitPesewas: 30_000,
          spentPesewas: 40_000,
          percentUsed: 133,
          periodElapsedPercent: 74
        }
      ]
    })

    const first = deriveInsights(built)
    const second = deriveInsights(built)

    expect(first.length).toBeGreaterThan(1)
    expect(first.map(row => row.dedupeKey)).toEqual(second.map(row => row.dedupeKey))
    // Unique within one run, or an upsert would collapse two observations.
    expect(new Set(first.map(row => row.dedupeKey)).size).toBe(first.length)
  })
})
