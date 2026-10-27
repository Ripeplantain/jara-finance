import { randomUUID } from 'node:crypto'
import { and, desc, eq, gte, ilike, isNull, lte, or, sql } from 'drizzle-orm'
import type {
  CreateEntryInput,
  CreateTransferInput,
  TransactionQuery,
  UpdateEntryInput
} from '#shared/schemas/transactions'
import { resolvePeriod, type Period } from '#shared/period/month'
import { categories, financialAccounts, goalEntries, goals, transactions } from '../database/schema'
import type { Database, DatabaseTransaction } from '../types/database'
import { assertOwnedAccount } from './accounts'
import { assertUsableCategory } from './categories'

/**
 * The ledger's write and read paths.
 *
 * The invariants this module exists to protect, all of which the database also
 * enforces with CHECK constraints:
 *
 * - `amountPesewas` is a positive magnitude; direction lives in `type`.
 * - A transfer is **two rows** sharing a `transferGroupId`, written in one
 *   database transaction, so it can never half-exist.
 * - A transfer carries no category, and is neither income nor expense.
 */

export interface TransactionRow {
  id: string
  type: 'income' | 'expense' | 'transfer'
  amountPesewas: number
  occurredOn: string
  note: string | null
  merchant: string | null
  transferGroupId: string | null
  transferDirection: 'in' | 'out' | null
  accountId: string
  accountName: string
  categoryId: string | null
  categoryName: string | null
  categoryIcon: string | null
  categoryColorIndex: number | null
}

/** The `(occurredOn, id)` keyset cursor, encoded for a query string. */
function encodeCursor(row: { occurredOn: string, id: string }): string {
  return `${row.occurredOn}|${row.id}`
}

function decodeCursor(cursor: string): { occurredOn: string, id: string } | undefined {
  const [occurredOn, id] = cursor.split('|')
  if (!occurredOn || !id) return undefined
  return { occurredOn, id }
}

/**
 * A page of transactions, newest first.
 *
 * Keyset rather than offset pagination: the ordering is
 * `(occurredOn desc, id desc)` and `transactions_user_date_idx` matches it
 * exactly, so page 40 costs what page 1 costs. Offset pagination would also
 * duplicate a row across pages whenever a transaction is added mid-browse.
 */
export async function listTransactions(
  userId: string,
  timezone: string,
  query: TransactionQuery
): Promise<{ transactions: TransactionRow[], nextCursor: string | null, period: Period }> {
  const period = resolvePeriod({ kind: query.period, start: query.start, end: query.end }, timezone)
  const cursor = query.cursor ? decodeCursor(query.cursor) : undefined

  const rows = await useDb()
    .select({
      id: transactions.id,
      type: transactions.type,
      amountPesewas: transactions.amountPesewas,
      occurredOn: transactions.occurredOn,
      note: transactions.note,
      merchant: transactions.merchant,
      transferGroupId: transactions.transferGroupId,
      transferDirection: transactions.transferDirection,
      accountId: financialAccounts.id,
      accountName: financialAccounts.name,
      categoryId: categories.id,
      categoryName: categories.name,
      categoryIcon: categories.icon,
      categoryColorIndex: categories.colorIndex
    })
    .from(transactions)
    .innerJoin(financialAccounts, eq(financialAccounts.id, transactions.accountId))
    .leftJoin(categories, eq(categories.id, transactions.categoryId))
    .where(
      and(
        eq(transactions.userId, userId),
        gte(transactions.occurredOn, period.start),
        lte(transactions.occurredOn, period.end),
        query.accountId ? eq(transactions.accountId, query.accountId) : undefined,
        query.categoryId ? eq(transactions.categoryId, query.categoryId) : undefined,
        query.type ? eq(transactions.type, query.type) : undefined,
        query.search
          ? or(
              ilike(transactions.merchant, `%${query.search}%`),
              ilike(transactions.note, `%${query.search}%`)
            )
          : undefined,
        // Strictly after the cursor in the composite ordering. Written as a row
        // comparison so Postgres can seek straight to it on the index.
        cursor
          ? sql`(${transactions.occurredOn}, ${transactions.id}) < (${cursor.occurredOn}::date, ${cursor.id}::uuid)`
          : undefined
      )
    )
    .orderBy(desc(transactions.occurredOn), desc(transactions.id))
    // One extra row answers "is there another page?" without a second COUNT query.
    .limit(query.limit + 1)

  const hasMore = rows.length > query.limit
  const page = hasMore ? rows.slice(0, query.limit) : rows

  return {
    transactions: page,
    nextCursor: hasMore && page.length > 0 ? encodeCursor(page[page.length - 1]!) : null,
    period
  }
}

/** Records income or an expense — a single row. */
export async function createEntry(userId: string, input: CreateEntryInput) {
  const db = useDb()
  await assertOwnedAccount(db, userId, input.accountId)
  if (input.categoryId) {
    await assertUsableCategory(db, userId, input.categoryId, input.type)
  }

  const [row] = await db
    .insert(transactions)
    .values({
      userId,
      accountId: input.accountId,
      categoryId: input.categoryId,
      type: input.type,
      amountPesewas: input.amount,
      occurredOn: input.occurredOn,
      merchant: input.merchant,
      note: input.note
    })
    .returning()

  return row
}

/**
 * Records a transfer as **two rows in one database transaction**: an `out` leg
 * debiting the source and an `in` leg crediting the destination, sharing a
 * `transferGroupId`.
 *
 * Atomicity is the whole point. A transfer written as two independent inserts
 * could leave money debited from one account and never credited to the other
 * after a mid-write failure — a ledger that doesn't balance, which no later
 * recomputation could detect or repair.
 *
 * Optionally links the `in` leg to a goal, producing a *backed* goal entry (see
 * `goalEntries`): real money moved, so it counts towards the goal and is
 * subtracted from what's available to spend.
 */
export async function createTransfer(userId: string, input: CreateTransferInput) {
  const db = useDb()

  const [from, to] = await Promise.all([
    assertOwnedAccount(db, userId, input.fromAccountId, 'source account'),
    assertOwnedAccount(db, userId, input.toAccountId, 'destination account')
  ])

  // Converting between currencies needs a rate and a stored rate policy, which
  // the MVP does not have. Refusing is the honest answer; silently treating
  // GH₵100 as $100 is not.
  if (from.currency !== to.currency) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Transfers between different currencies are not supported yet'
    })
  }

  const transferGroupId = randomUUID()

  return db.transaction(async (tx) => {
    const legs = await tx
      .insert(transactions)
      .values([
        {
          userId,
          accountId: input.fromAccountId,
          type: 'transfer' as const,
          transferDirection: 'out' as const,
          transferGroupId,
          amountPesewas: input.amount,
          occurredOn: input.occurredOn,
          note: input.note
        },
        {
          userId,
          accountId: input.toAccountId,
          type: 'transfer' as const,
          transferDirection: 'in' as const,
          transferGroupId,
          amountPesewas: input.amount,
          occurredOn: input.occurredOn,
          note: input.note
        }
      ])
      .returning()

    if (input.goalId) {
      // The link points at the `in` leg — the row landing in savings.
      const inLeg = legs.find(leg => leg.transferDirection === 'in')!
      await linkTransferToGoal(tx, userId, input.goalId, inLeg, input.amount, input.occurredOn)
    }

    return { transferGroupId, legs }
  })
}

/**
 * Edits both legs of a transfer together, inside the caller's transaction.
 *
 * Takes the `in` leg's id (what a backed goal entry links to) and rewrites every
 * row sharing its `transferGroupId`, so the pair can never disagree about the
 * amount, the date or the note.
 */
export async function updateTransferPair(
  tx: DatabaseTransaction,
  userId: string,
  inLegId: string,
  patch: { amount?: number, occurredOn?: string, note?: string | null }
) {
  const [leg] = await tx
    .select({ transferGroupId: transactions.transferGroupId })
    .from(transactions)
    .where(
      and(
        eq(transactions.id, inLegId),
        eq(transactions.userId, userId),
        eq(transactions.type, 'transfer')
      )
    )
    .limit(1)

  if (!leg?.transferGroupId) {
    throw createError({ statusCode: 404, statusMessage: 'That transfer no longer exists' })
  }

  await tx
    .update(transactions)
    .set({
      ...(patch.amount !== undefined && { amountPesewas: patch.amount }),
      ...(patch.occurredOn !== undefined && { occurredOn: patch.occurredOn }),
      ...(patch.note !== undefined && { note: patch.note }),
      updatedAt: new Date()
    })
    .where(
      and(
        eq(transactions.userId, userId),
        eq(transactions.transferGroupId, leg.transferGroupId)
      )
    )
}

/**
 * Turns a tracked goal contribution into a real transfer: writes the pair from
 * `fromAccountId` into the goal's savings account and links the existing entry
 * to it, in one database transaction.
 *
 * The entry is adopted rather than recreated, so its date, amount and history
 * are untouched and it can never be counted twice. The update is guarded on the
 * entry still being tracked, so two concurrent moves cannot both succeed.
 */
export async function moveTrackedEntryIntoTransfer(
  userId: string,
  entryId: string,
  fromAccountId: string
) {
  return moveEntryIntoTransfer(useDb(), userId, entryId, fromAccountId)
}

/** `moveTrackedEntryIntoTransfer` with the database passed in, so it can run against a test database. */
export async function moveEntryIntoTransfer(
  db: Database,
  userId: string,
  entryId: string,
  fromAccountId: string
) {
  const [entry] = await db
    .select({
      id: goalEntries.id,
      goalId: goalEntries.goalId,
      amountPesewas: goalEntries.amountPesewas,
      occurredOn: goalEntries.occurredOn,
      note: goalEntries.note,
      linkedTransactionId: goalEntries.linkedTransactionId
    })
    .from(goalEntries)
    .where(and(eq(goalEntries.id, entryId), eq(goalEntries.userId, userId)))
    .limit(1)

  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'Contribution not found' })
  }
  if (entry.linkedTransactionId) {
    throw createError({ statusCode: 409, statusMessage: 'This money has already been moved' })
  }

  const [goal] = await db
    .select({ id: goals.id, name: goals.name, accountId: goals.accountId })
    .from(goals)
    .where(and(eq(goals.id, entry.goalId), eq(goals.userId, userId)))
    .limit(1)

  if (!goal) {
    throw createError({ statusCode: 404, statusMessage: 'That goal does not exist' })
  }
  if (!goal.accountId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Give this goal a savings account before moving money into it'
    })
  }
  if (goal.accountId === fromAccountId) {
    throw createError({ statusCode: 409, statusMessage: 'Choose two different accounts' })
  }

  const [from, to] = await Promise.all([
    assertOwnedAccount(db, userId, fromAccountId, 'source account'),
    assertOwnedAccount(db, userId, goal.accountId, 'savings account')
  ])
  if (from.currency !== to.currency) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Transfers between different currencies are not supported yet'
    })
  }

  const transferGroupId = randomUUID()
  const note = entry.note ?? `Towards ${goal.name}`

  return db.transaction(async (tx) => {
    const legs = await tx
      .insert(transactions)
      .values([
        {
          userId,
          accountId: fromAccountId,
          type: 'transfer' as const,
          transferDirection: 'out' as const,
          transferGroupId,
          amountPesewas: entry.amountPesewas,
          occurredOn: entry.occurredOn,
          note
        },
        {
          userId,
          accountId: goal.accountId!,
          type: 'transfer' as const,
          transferDirection: 'in' as const,
          transferGroupId,
          amountPesewas: entry.amountPesewas,
          occurredOn: entry.occurredOn,
          note
        }
      ])
      .returning()

    const inLeg = legs.find(leg => leg.transferDirection === 'in')!
    const linked = await tx
      .update(goalEntries)
      .set({ linkedTransactionId: inLeg.id, updatedAt: new Date() })
      .where(
        and(
          eq(goalEntries.id, entry.id),
          eq(goalEntries.userId, userId),
          isNull(goalEntries.linkedTransactionId)
        )
      )
      .returning({ id: goalEntries.id })

    // Someone else moved it between the read above and here: roll everything back.
    if (linked.length === 0) {
      throw createError({ statusCode: 409, statusMessage: 'This money has already been moved' })
    }

    return { transferGroupId, legs }
  })
}

/**
 * Creates the backed goal entry for a transfer leg, inside the caller's
 * transaction.
 *
 * The goal's ownership is checked with a query right here rather than by
 * calling into `goals.ts`. `goals.ts` depends on `createTransfer` to back a
 * contribution, so importing it back would make the two modules circular — and
 * a cycle between the ledger and goals is exactly the kind of knot that later
 * makes one of them impossible to test alone.
 */
async function linkTransferToGoal(
  tx: DatabaseTransaction,
  userId: string,
  goalId: string,
  inLeg: { id: string },
  amountPesewas: number,
  occurredOn: string
) {
  const [goal] = await tx
    .select({ id: goals.id })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1)

  if (!goal) {
    throw createError({ statusCode: 404, statusMessage: 'That goal does not exist' })
  }

  await tx.insert(goalEntries).values({
    userId,
    goalId,
    amountPesewas,
    occurredOn,
    linkedTransactionId: inLeg.id
  })
}

/**
 * Edits income or an expense.
 *
 * Transfers are not editable: changing one leg's amount or account would leave
 * the pair inconsistent, and "edit" has no single correct meaning across two
 * rows. The UI offers delete-and-re-enter instead, which keeps the pair whole.
 */
export async function updateEntry(userId: string, id: string, input: UpdateEntryInput) {
  const db = useDb()

  const [existing] = await db
    .select({ id: transactions.id, type: transactions.type })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })
  }
  if (existing.type === 'transfer') {
    throw createError({
      statusCode: 409,
      statusMessage: 'Delete the transfer and record it again to change it'
    })
  }

  if (input.accountId) {
    await assertOwnedAccount(db, userId, input.accountId)
  }
  if (input.categoryId) {
    await assertUsableCategory(db, userId, input.categoryId, existing.type)
  }

  const [row] = await db
    .update(transactions)
    .set({
      ...(input.accountId !== undefined && { accountId: input.accountId }),
      ...(input.categoryId !== undefined && { categoryId: input.categoryId }),
      ...(input.amount !== undefined && { amountPesewas: input.amount }),
      ...(input.occurredOn !== undefined && { occurredOn: input.occurredOn }),
      ...(input.merchant !== undefined && { merchant: input.merchant }),
      ...(input.note !== undefined && { note: input.note }),
      updatedAt: new Date()
    })
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .returning()

  return row
}

/**
 * Deletes a transaction. Deleting either leg of a transfer removes **both** —
 * a lone leg would be money appearing from or vanishing into nowhere.
 *
 * Any goal entry backed by the deleted leg goes with it, by the cascade on
 * `goalEntries.linkedTransactionId`: if the money movement is gone, the
 * allocation it represented is gone too, rather than quietly degrading into a
 * tracked entry that would overstate savings.
 */
export async function deleteTransaction(userId: string, id: string) {
  const db = useDb()

  const [existing] = await db
    .select({ id: transactions.id, transferGroupId: transactions.transferGroupId })
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1)

  if (!existing) {
    throw createError({ statusCode: 404, statusMessage: 'Transaction not found' })
  }

  const deleted = await db
    .delete(transactions)
    .where(
      and(
        eq(transactions.userId, userId),
        existing.transferGroupId
          ? eq(transactions.transferGroupId, existing.transferGroupId)
          : eq(transactions.id, id)
      )
    )
    .returning({ id: transactions.id })

  return { deletedCount: deleted.length }
}

/** One transaction, scoped to its owner. */
export async function getTransaction(db: Database, userId: string, id: string) {
  const [row] = await db
    .select()
    .from(transactions)
    .where(and(eq(transactions.id, id), eq(transactions.userId, userId)))
    .limit(1)
  return row
}
