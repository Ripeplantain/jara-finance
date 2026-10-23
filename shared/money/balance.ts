import { addPesewas, assertSafePesewas, subtractPesewas } from './pesewas'

/**
 * The raw ledger totals for one account over a window, as returned by SQL.
 * All four transaction totals are positive magnitudes; direction is carried by
 * which field they land in.
 */
export interface BalanceComponents {
  openingBalancePesewas: number
  incomePesewas: number
  expensePesewas: number
  transferInPesewas: number
  transferOutPesewas: number
}

/**
 * The balance formula, in one place.
 *
 *     balance = opening + income − expense + transfersIn − transfersOut
 *
 * Kept pure and free of any database or Nuxt coupling so it can be unit-tested
 * directly, and so `server/services/balances.ts` — the only place that queries
 * for these components — has nothing left to get wrong. Nothing anywhere else
 * recomputes a balance inline.
 *
 * Transfers appear on both sides and cancel out across accounts, which is the
 * property that makes moving your own money a non-event for net worth while
 * still moving each individual account.
 */
export function deriveBalance(components: BalanceComponents): number {
  const credits = addPesewas(
    assertSafePesewas(components.openingBalancePesewas, 'openingBalancePesewas'),
    assertSafePesewas(components.incomePesewas, 'incomePesewas'),
    assertSafePesewas(components.transferInPesewas, 'transferInPesewas')
  )
  const debits = addPesewas(
    assertSafePesewas(components.expensePesewas, 'expensePesewas'),
    assertSafePesewas(components.transferOutPesewas, 'transferOutPesewas')
  )
  return subtractPesewas(credits, debits)
}

/**
 * Net change over the window, excluding the opening balance and excluding
 * transfers. This is "did I earn more than I spent", which is a different
 * question from "how much is in the account" — shuffling money between your own
 * accounts must not read as income or as spending.
 */
export function deriveNetFlow(components: BalanceComponents): number {
  return subtractPesewas(
    assertSafePesewas(components.incomePesewas, 'incomePesewas'),
    assertSafePesewas(components.expensePesewas, 'expensePesewas')
  )
}
