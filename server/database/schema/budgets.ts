import { sql } from 'drizzle-orm'
import { check, date, index, pgTable, text, uniqueIndex, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pesewas, updatedAt } from './columns'
import { user } from './auth'
import { categories } from './categories'

/**
 * A budget is a calendar-month snapshot: exactly one per user per month,
 * enforced by the unique index on `(userId, periodStart)` with `periodStart`
 * pinned to the 1st.
 *
 * This is a deliberate narrowing of the PRD. Arbitrary overlapping date ranges
 * would make "what is my limit for Food right now?" ambiguous — two budgets
 * could both cap it with different numbers and there would be no principled
 * answer. Monthly snapshots give every question exactly one answer.
 *
 * `periodEnd` is derivable from `periodStart` but stored so SQL range predicates
 * stay simple and indexable.
 */
export const budgets = pgTable(
  'budgets',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    periodStart: date({ mode: 'string' }).notNull(),
    periodEnd: date({ mode: 'string' }).notNull(),
    note: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [
    uniqueIndex('budgets_user_period_idx').on(table.userId, table.periodStart),
    check('budgets_period_start_is_month_start', sql`extract(day from ${table.periodStart}) = 1`),
    check('budgets_period_ordered', sql`${table.periodEnd} > ${table.periodStart}`)
  ]
)

/**
 * A per-category spending cap inside one budget. Only expense categories are
 * valid; that's a cross-table rule the service layer and Zod schemas enforce,
 * since a CHECK can't reach `categories.kind`.
 */
export const budgetAllocations = pgTable(
  'budget_allocations',
  {
    id: uuid().primaryKey().defaultRandom(),
    budgetId: uuid()
      .notNull()
      .references(() => budgets.id, { onDelete: 'cascade' }),
    categoryId: uuid()
      .notNull()
      .references(() => categories.id, { onDelete: 'cascade' }),
    limitPesewas: pesewas().notNull(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [
    index('budget_allocations_budget_idx').on(table.budgetId),
    // One limit per category per budget — the other half of removing the
    // "two caps on Food" ambiguity.
    uniqueIndex('budget_allocations_budget_category_idx').on(table.budgetId, table.categoryId),
    check('budget_allocations_limit_positive', sql`${table.limitPesewas} > 0`)
  ]
)
