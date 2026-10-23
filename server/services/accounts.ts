import { and, eq } from 'drizzle-orm'
import type { CreateAccountInput, UpdateAccountInput } from '#shared/schemas/accounts'
import { financialAccounts } from '../database/schema'
import type { Database } from '../types/database'
import { getAccountBalances } from './balances'

/**
 * Accounts are the places money sits. Their *balances* are not here — they come
 * from `balances.ts`, which is the only module allowed to compute one.
 */

/** Accounts with their derived balances, for the list and picker UIs. */
export async function listAccounts(userId: string, includeArchived = false) {
  return getAccountBalances(userId, { includeArchived })
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
