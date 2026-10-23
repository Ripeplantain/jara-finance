import { sql } from 'drizzle-orm'
import { check, date, index, pgEnum, pgTable, text, uuid } from 'drizzle-orm/pg-core'
import { createdAt, pesewas, updatedAt } from './columns'
import { user } from './auth'
import { financialAccounts } from './accounts'
import { categories } from './categories'

export const transactionType = pgEnum('transaction_type', ['income', 'expense', 'transfer'])
export const transferDirection = pgEnum('transfer_direction', ['in', 'out'])

/**
 * The ledger. Every other number in Jara is derived from these rows.
 *
 * Three deliberate design choices:
 *
 * 1. **`amountPesewas` is always a positive magnitude.** Direction lives in
 *    `type` (and `transferDirection` for transfers). Signed amounts invite
 *    double-negative bugs in aggregates.
 *
 * 2. **`occurredOn` is a calendar date, not a timestamp.** A user recording
 *    "GH₵20 on trotro yesterday" means a day in their own timezone, not an
 *    instant. Storing a date removes every off-by-one-day timezone bug from
 *    reporting. `createdAt` keeps the real instant for audit.
 *
 * 3. **A transfer is two rows sharing a `transferGroupId`** — one `out` of the
 *    source, one `in` to the destination — written in a single DB transaction so
 *    a transfer can never half-exist. Transfers are never income or expense and
 *    must be excluded from every spending and earning total.
 *
 * The CHECK constraints below make those invariants the database's problem, not
 * a convention any future code path could quietly break.
 */
export const transactions = pgTable(
  'transactions',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    accountId: uuid()
      .notNull()
      .references(() => financialAccounts.id, { onDelete: 'restrict' }),
    // Null for transfers (always) and permitted for uncategorised income/expense.
    categoryId: uuid().references(() => categories.id, { onDelete: 'set null' }),
    type: transactionType().notNull(),
    amountPesewas: pesewas().notNull(),
    occurredOn: date({ mode: 'string' }).notNull(),
    note: text(),
    // Free-text payee ("Melcom", "Bolt"). Not a foreign key — Ghana's informal
    // economy has no merchant registry worth modelling in an MVP.
    merchant: text(),
    transferGroupId: uuid(),
    transferDirection: transferDirection(),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [
    // Primary list view and cursor pagination: newest first, `id` as tiebreaker.
    index('transactions_user_date_idx').on(table.userId, table.occurredOn.desc(), table.id.desc()),
    index('transactions_user_account_date_idx').on(
      table.userId,
      table.accountId,
      table.occurredOn.desc()
    ),
    index('transactions_user_category_date_idx').on(
      table.userId,
      table.categoryId,
      table.occurredOn.desc()
    ),
    index('transactions_transfer_group_idx').on(table.transferGroupId),

    check('transactions_amount_positive', sql`${table.amountPesewas} > 0`),
    // A transfer has both a group and a direction; nothing else has either.
    //
    // Each field is checked against `type` *separately*. The tempting single
    // comparison — `(type = 'transfer') = (group IS NOT NULL AND direction IS
    // NOT NULL)` — passes an expense that carries a stray group id, because both
    // sides evaluate false. An integration test caught exactly that.
    check(
      'transactions_transfer_shape',
      sql`((${table.type} = 'transfer') = (${table.transferGroupId} IS NOT NULL))
          AND ((${table.type} = 'transfer') = (${table.transferDirection} IS NOT NULL))`
    ),
    // Transfers are not spending, so they carry no category.
    check(
      'transactions_transfer_uncategorised',
      sql`${table.type} <> 'transfer' OR ${table.categoryId} IS NULL`
    )
  ]
)
