import {
  deriveAffordability,
  deriveAvailable,
  type Affordability,
  type AvailableInput
} from '#shared/money/affordability'
import { addPesewas } from '#shared/money/pesewas'
import { getLiquidBalance } from './balances'
import { queryBudgetStatus } from './budgets'
import { getCommittedSavings } from './goals'

export interface Headroom extends AvailableInput {
  /** What is spendable without breaking an existing commitment. */
  availablePesewas: number
  currency: string
}

/**
 * The three figures the affordability formula subtracts, plus the result.
 *
 * Gathered once here so the screen that asks "what can I spend?" and the one
 * that asks "can I afford this?" cannot disagree about the answer.
 */
export async function getHeadroom(userId: string, timezone: string): Promise<Headroom> {
  const db = useDb()

  const [liquid, budget, committedSavingsPesewas] = await Promise.all([
    getLiquidBalance(userId),
    queryBudgetStatus(db, userId, timezone),
    getCommittedSavings(db, userId)
  ])

  // Only the *unspent* part of each budget line is still committed. Summing the
  // full limits would double-count everything already spent this month, making
  // the user look far poorer than they are.
  const remainingBudgetedPesewas = budget.lines.reduce(
    (total, line) => addPesewas(total, Math.max(0, line.remainingPesewas)),
    0
  )

  const inputs: AvailableInput = {
    liquidPesewas: liquid.liquidPesewas,
    committedSavingsPesewas,
    remainingBudgetedPesewas
  }

  return {
    ...inputs,
    availablePesewas: deriveAvailable(inputs),
    currency: liquid.currency
  }
}

/**
 * Gathers the figures the affordability formula needs and hands them to
 * `deriveAffordability`. The arithmetic itself stays in `shared/`.
 */
export async function checkAffordability(
  userId: string,
  timezone: string,
  pricePesewas: number
): Promise<Affordability & { currency: string }> {
  const { currency, liquidPesewas, committedSavingsPesewas, remainingBudgetedPesewas }
    = await getHeadroom(userId, timezone)

  return {
    ...deriveAffordability({
      pricePesewas,
      liquidPesewas,
      committedSavingsPesewas,
      remainingBudgetedPesewas
    }),
    currency
  }
}
