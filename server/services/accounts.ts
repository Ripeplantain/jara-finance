import { and, eq, sql } from 'drizzle-orm'
import type { CreateAccountInput, UpdateAccountInput } from '#shared/schemas/accounts'
import { financialAccounts, goals, transactions } from '../database/schema'
import type { Database } from '../types/database'
import { queryAccountBalances, type AccountBalance } from './balances'

/**
 * Accounts are the places money sits. Their *balances* are not here — they come
 * from `balances.ts`, which is the only module allowed to compute one.
 */

export interface AccountListItem extends AccountBalance {
  /** Safe to remove permanently: no ledger rows or savings goal depends on it. */
  canDelete: boolean
}

/**
 * One expression defines "unused" for both the list UI and the DELETE itself.
 * Each child lookup is scoped independently: ownership is asserted at every
 * hop rather than inferred from the account's foreign keys.
 */
function hasNoDependencies(userId: string) {
  return sql`not exists (
      select 1 from ${transactions}
      where ${transactions.accountId} = ${financialAccounts.id}
        and ${transactions.userId} = ${userId}
    ) and not exists (
      select 1 from ${goals}
      where ${goals.accountId} = ${financialAccounts.id}
        and ${goals.userId} = ${userId}
    )`
}

/** Accounts with their derived balances and deletion eligibility. */
export async function listAccounts(userId: string, includeArchived = false) {
  return queryAccounts(useDb(), userId, includeArchived)
}

/** `listAccounts` with the database passed in, so its policy is integration-testable. */
export async function queryAccounts(
  db: Database,
  userId: string,
  includeArchived = false
): Promise<AccountListItem[]> {
  const [accounts, eligibility] = await Promise.all([
    queryAccountBalances(db, userId, { includeArchived }),
    db
      .select({
        accountId: financialAccounts.id,
        canDelete: sql<boolean>`${hasNoDependencies(userId)}`
      })
      .from(financialAccounts)
      .where(
        and(
          eq(financialAccounts.userId, userId),
          includeArchived ? undefined : eq(financialAccounts.isArchived, false)
        )
      )
  ])

  const canDeleteById = new Map(eligibility.map(row => [row.accountId, row.canDelete]))
  return accounts.map(account => ({
    ...account,
    canDelete: canDeleteById.get(account.accountId) ?? false
  }))
}

export async function createAccount(userId: string, input: CreateAccountInput) {
  const [account] = await useDb()
    .insert(financialAccounts)
    .values({
      userId,
      name: input.name,
      type: input.type,
      institution: input.institution,
      openingBalancePesewas: input.openingBalance
    })
    .returning()

  return account
}

/**
 * Updates an account, scoped by `userId` in the `where` clause.
 *
 * The ownership check is part of the UPDATE itself rather than a preceding
 * SELECT: a fetch-then-write would be both a wasted round trip and a race, and
 * the README's rule is that user data is filtered in SQL, never in JS.
 * No matching row means the account isn't the caller's, which is reported as a
 * 404 — a 403 would confirm the id exists.
 */
export async function updateAccount(
  userId: string,
  accountId: string,
  input: UpdateAccountInput
) {
  const [account] = await useDb()
    .update(financialAccounts)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.institution !== undefined && { institution: input.institution }),
      ...(input.openingBalance !== undefined && {
        openingBalancePesewas: input.openingBalance
      }),
      ...(input.isArchived !== undefined && { isArchived: input.isArchived }),
      updatedAt: new Date()
    })
    .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
    .returning()

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: 'Account not found' })
  }

  return account
}

/** Deletes an account only while nothing in the ledger or goals depends on it. */
export async function deleteAccount(userId: string, accountId: string) {
  return removeAccount(useDb(), userId, accountId)
}

/** `deleteAccount` with the database passed in, so the atomic guard can be tested. */
export async function removeAccount(db: Database, userId: string, accountId: string) {
  return db.transaction(async (tx) => {
    // Lock the parent before checking children. A concurrent FK insert that won
    // the race commits before the next statement's snapshot; one arriving later
    // waits until this delete commits and then fails instead of losing its link.
    const [account] = await tx
      .select({ id: financialAccounts.id })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
      .limit(1)
      .for('update')

    if (!account) {
      throw createError({ statusCode: 404, statusMessage: 'Account not found' })
    }

    const [eligibility] = await tx
      .select({ canDelete: sql<boolean>`${hasNoDependencies(userId)}` })
      .from(financialAccounts)
      .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
      .limit(1)

    if (!eligibility?.canDelete) {
      throw createError({
        statusCode: 409,
        statusMessage: 'This account is in use. Archive it instead, or remove its transactions and savings goal first.'
      })
    }

    await tx
      .delete(financialAccounts)
      .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))

    return { deleted: true }
  })
}

/**
 * Asserts the account exists and belongs to the user, returning its currency.
 *
 * Used by the transaction and transfer paths before writing a ledger row. The
 * foreign key alone would not catch pointing a transaction at *someone else's*
 * account — it only checks that the row exists.
 */
export async function assertOwnedAccount(
  db: Database,
  userId: string,
  accountId: string,
  label = 'account'
) {
  const [account] = await db
    .select({
      id: financialAccounts.id,
      currency: financialAccounts.currency,
      isArchived: financialAccounts.isArchived
    })
    .from(financialAccounts)
    .where(and(eq(financialAccounts.id, accountId), eq(financialAccounts.userId, userId)))
    .limit(1)

  if (!account) {
    throw createError({ statusCode: 404, statusMessage: `That ${label} does not exist` })
  }
  if (account.isArchived) {
    throw createError({
      statusCode: 409,
      statusMessage: `That ${label} is archived — restore it before adding transactions`
    })
  }

  return account
}
