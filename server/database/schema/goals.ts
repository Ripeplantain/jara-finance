import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  pgEnum,
  pgTable,
  text,
  uniqueIndex,
  uuid
} from 'drizzle-orm/pg-core'
import { createdAt, pesewas, updatedAt } from './columns'
import { user } from './auth'
import { financialAccounts } from './accounts'
import { transactions } from './transactions'

export const goalStatus = pgEnum('goal_status', ['active', 'achieved', 'archived'])

export const goals = pgTable(
  'goals',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    targetPesewas: pesewas().notNull(),
    // Null is allowed: "save GH₵5,000 eventually" is a real goal. Without a date
    // there is no suggested monthly contribution, and the UI says so.
    targetDate: date({ mode: 'string' }),
    // The savings account backing allocations land in. Null means the goal is
    // tracked only — see `goalEntries`.
    accountId: uuid().references(() => financialAccounts.id, { onDelete: 'set null' }),
    status: goalStatus().notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [
    index('goals_user_status_idx').on(table.userId, table.status),
    check('goals_target_positive', sql`${table.targetPesewas} > 0`)
  ]
)

/**
 * A contribution towards a goal. The `linkedTransactionId` is what makes goal
 * progress honest, and it splits entries into two kinds:
 *
 * | Kind        | `linkedTransactionId` | Means                            | Balances | Affordability           |
 * |-------------|-----------------------|----------------------------------|----------|-------------------------|
 * | **Backed**  | set                   | A real transfer into savings     | Moves    | Subtracted as committed |
 * | **Tracked** | null                  | Bookkeeping intent only          | None     | Flagged, not subtracted |
 *
 * This is how the app satisfies two PRD rules at once: an allocation is never
 * mistaken for new income, and it is never double-counted as an asset. The UI
 * badges tracked entries as "not yet moved".
 *
 * The link points at the `in` leg of the transfer — the row landing in savings.
 * It cascades on delete: if the real money movement is gone, the allocation it
 * represented is gone too. Degrading it to a tracked entry instead would quietly
 * overstate how much the user has actually saved.
 */
export const goalEntries = pgTable(
  'goal_entries',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    goalId: uuid()
      .notNull()
      .references(() => goals.id, { onDelete: 'cascade' }),
    amountPesewas: pesewas().notNull(),
    occurredOn: date({ mode: 'string' }).notNull(),
    linkedTransactionId: uuid().references(() => transactions.id, { onDelete: 'cascade' }),
    note: text(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [
    index('goal_entries_goal_idx').on(table.goalId),
    index('goal_entries_user_idx').on(table.userId),
    // One transfer can back at most one goal entry, so the same GH₵100 can never
    // count towards two goals.
    uniqueIndex('goal_entries_linked_transaction_idx').on(table.linkedTransactionId),
    check('goal_entries_amount_positive', sql`${table.amountPesewas} > 0`)
  ]
)
