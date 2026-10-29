import { boolean, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pesewas, updatedAt } from './columns'
import { user } from './auth'

export const accountType = pgEnum('account_type', [
  'cash',
  'mobile_money',
  'bank',
  'savings'
])

/**
 * A place money sits. Named `financial_accounts` because `account` already
 * belongs to Better Auth (OAuth/credential records) — two very different things.
 *
 * `openingBalancePesewas` is the only stored balance. The current balance is
 * always derived in `server/services/balances.ts`; storing it would mean two
 * sources of truth and a reconciliation bug waiting to happen.
 *
 * Accounts with history are archived so every transaction keeps its parent.
 * An unused account may be deleted; the service refuses one referenced by the ledger or a goal.
 */
export const financialAccounts = pgTable(
  'financial_accounts',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    type: accountType().notNull(),
    // e.g. "MTN MoMo", "GCB Bank". Free text — Ghana has too many providers to enumerate.
    institution: text(),
    openingBalancePesewas: pesewas().notNull().default(0),
    currency: text().notNull().default('GHS'),
    isArchived: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [index('financial_accounts_user_idx').on(table.userId)]
)
