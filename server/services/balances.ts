import { and, eq, lte, sql } from 'drizzle-orm'
import { deriveBalance, deriveNetFlow, type BalanceComponents } from '#shared/money/balance'
import { assertSafePesewas, sumPesewas } from '#shared/money/pesewas'
import type { IsoDate } from '#shared/period/dates'
import { financialAccounts, transactions } from '../database/schema'
import type { Database } from '../types/database'

/**
 * **The single source of truth for account balances.**
 *
 * No balance is stored. Every balance in Jara — dashboard cards, the account
 * list, the AI's affordability tool — comes from this module, which rebuilds it
 * from the ledger. One formula, one query shape, no reconciliation step and no
 * possibility of a cached total drifting from the transactions that produced it.
 */

export interface AccountBalance extends BalanceComponents {
  accountId: string
  name: string
  type: typeof financialAccounts.$inferSelect['type']
  institution: string | null
  currency: string
  isArchived: boolean
  /** opening + income − expense + transfersIn − transfersOut */
  balancePesewas: number
  /** income − expense over the window. Excludes transfers and the opening balance. */
  netFlowPesewas: number
}

export interface BalanceOptions {
  /** Include only transactions on or before this date. Omit for "now". */
  asOf?: IsoDate
  includeArchived?: boolean
}

/**
 * Postgres `sum()` over `bigint` yields `numeric`, which node-postgres hands
 * back as a string to avoid lossy parsing. Rather than register a global type
 * parser — which would silently affect every other query — each aggregate is
 * cast to text here and converted through `assertSafePesewas`, so an
 * out-of-range total throws instead of arriving as `NaN` or a rounded float.
 */
function sumOfType(type: 'income' | 'expense') {
  return sql<string>`coalesce(sum(case when ${transactions.type} = ${type} then ${transactions.amountPesewas} else 0 end), 0)::text`
}

function sumOfTransfer(direction: 'in' | 'out') {
  return sql<string>`coalesce(sum(case when ${transactions.type} = 'transfer' and ${transactions.transferDirection} = ${direction} then ${transactions.amountPesewas} else 0 end), 0)::text`
}

function toPesewas(value: string, label: string): number {
  return assertSafePesewas(Number(value), label)
}

/**
 * Balances for every account the user owns, in one query.
 *
 * The join is scoped by `userId` on *both* tables. The account filter alone
 * would be sufficient, but a cross-tenant leak in a finance app is the worst
 * possible bug class, so ownership is asserted at every hop rather than
 * inferred from a foreign key.
 */
export async function getAccountBalances(
  userId: string,
  options: BalanceOptions = {}
): Promise<AccountBalance[]> {
  return queryAccountBalances(useDb(), userId, options)
}

/**
 * The query itself, taking its database explicitly.
 *
 * Split out from `getAccountBalances` for one reason: it lets
 * `tests/integration/balances.test.ts` run this against a real Postgres with its
 * own connection, no Nuxt runtime required. The balance formula is the most
 * consequential SQL in the app and "it compiles" is not evidence that its
 * filtered aggregates are correct.
 */
export async function queryAccountBalances(
  db: Database,
  userId: string,
  options: BalanceOptions = {}
): Promise<AccountBalance[]> {
  const ledgerScope = and(
    eq(transactions.accountId, financialAccounts.id),
    eq(transactions.userId, userId),
    options.asOf ? lte(transactions.occurredOn, options.asOf) : undefined
  )

  const rows = await db
    .select({
      accountId: financialAccounts.id,
      name: financialAccounts.name,
      type: financialAccounts.type,
      institution: financialAccounts.institution,
      currency: financialAccounts.currency,
      isArchived: financialAccounts.isArchived,
      openingBalancePesewas: financialAccounts.openingBalancePesewas,
      income: sumOfType('income'),
      expense: sumOfType('expense'),
      transferIn: sumOfTransfer('in'),
      transferOut: sumOfTransfer('out')
    })
    .from(financialAccounts)
    .leftJoin(transactions, ledgerScope)
    .where(
      and(
        eq(financialAccounts.userId, userId),
        options.includeArchived ? undefined : eq(financialAccounts.isArchived, false)
      )
    )
    .groupBy(financialAccounts.id)
    .orderBy(financialAccounts.name)

  return rows.map((row) => {
    const components: BalanceComponents = {
      openingBalancePesewas: assertSafePesewas(
        row.openingBalancePesewas,
        'openingBalancePesewas'
      ),
      incomePesewas: toPesewas(row.income, 'incomePesewas'),
      expensePesewas: toPesewas(row.expense, 'expensePesewas'),
      transferInPesewas: toPesewas(row.transferIn, 'transferInPesewas'),
      transferOutPesewas: toPesewas(row.transferOut, 'transferOutPesewas')
    }

    return {
      accountId: row.accountId,
      name: row.name,
      type: row.type,
      institution: row.institution,
      currency: row.currency,
      isArchived: row.isArchived,
      ...components,
      balancePesewas: deriveBalance(components),
      netFlowPesewas: deriveNetFlow(components)
    }
  })
}

export async function getAccountBalance(
  userId: string,
  accountId: string,
  options: BalanceOptions = {}
): Promise<AccountBalance | undefined> {
  const balances = await getAccountBalances(userId, { ...options, includeArchived: true })
  return balances.find(balance => balance.accountId === accountId)
}

/**
 * Total money the user actually has across non-archived accounts — the `liquid`
 * term in the affordability formula.
 *
 * Throws on mixed currencies rather than summing them. GHS-only is an MVP
 * constraint, and a wrong total is worse than a missing one: adding GHS to USD
 * would produce a number that looks authoritative and means nothing.
 */
export async function getLiquidBalance(
  userId: string,
  options: BalanceOptions = {}
): Promise<{ liquidPesewas: number, currency: string, accounts: AccountBalance[] }> {
  const accounts = await getAccountBalances(userId, { ...options, includeArchived: false })
  const currencies = new Set(accounts.map(account => account.currency))

  if (currencies.size > 1) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Mixed currencies cannot be totalled',
      data: { currencies: [...currencies] }
    })
  }

  return {
    liquidPesewas: sumPesewas(accounts.map(account => account.balancePesewas)),
    currency: currencies.values().next().value ?? 'GHS',
    accounts
  }
}
