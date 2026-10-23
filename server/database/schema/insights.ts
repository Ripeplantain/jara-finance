import {
  date,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { createdAt } from './columns'
import { user } from './auth'

export const insightKind = pgEnum('insight_kind', [
  'top_category',
  'month_over_month',
  'budget_overrun',
  'unusual_expense',
  'goal_off_track',
  'savings_rate'
])

export const insightSeverity = pgEnum('insight_severity', ['info', 'warning', 'critical'])

/**
 * Deterministic, rule-based observations (PRD §10) — computed by
 * `server/services/insights.ts`, never by the model. Salo may read and explain
 * them; it does not author them. That keeps the headline numbers on the
 * dashboard reproducible and testable.
 *
 * `payload` holds the figures behind the text so the UI can re-render them with
 * the app's own money formatting instead of parsing them back out of prose.
 */
export const insights = pgTable(
  'insights',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    kind: insightKind().notNull(),
    severity: insightSeverity().notNull().default('info'),
    periodStart: date({ mode: 'string' }).notNull(),
    // Stable identity for one observation within a period, e.g.
    // `unusual_expense:<transactionId>` or `budget_overrun:<categoryId>`.
    dedupeKey: text().notNull(),
    title: text().notNull(),
    body: text().notNull(),
    payload: jsonb(),
    dismissedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt()
  },
  table => [
    index('insights_user_period_idx').on(table.userId, table.periodStart.desc()),
    // Recomputing a period upserts rather than duplicating, so a dismissal sticks.
    uniqueIndex('insights_user_dedupe_idx').on(table.userId, table.periodStart, table.dedupeKey)
  ]
)
