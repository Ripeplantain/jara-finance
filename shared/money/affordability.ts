import { addPesewas, assertSafePesewas, subtractPesewas } from './pesewas'

/**
 * The affordability formula, in one pure place.
 *
 *     available = liquid − committedSavings − remainingBudgetedSpend
 *     verdict   = compare(price, available)
 *
 * It lives in `shared/` and does no I/O so that it can be unit-tested against
 * the edge cases that matter — a price exactly equal to what's available, a
 * negative balance, no budget at all — and so the AI layer has nothing to
 * recompute. The model calls a tool, gets this result, and explains it; the
 * README's rule is that the AI never does arithmetic.
 *
 * "Available" is deliberately conservative: money already committed to a goal
 * and money the user has budgeted but not yet spent are both subtracted, so the
 * answer is what they can spend *without breaking a plan they already made*,
 * not merely what is in their accounts.
 */

export type AffordabilityVerdict = 'yes' | 'tight' | 'no'

export interface AffordabilityInput {
  pricePesewas: number
  liquidPesewas: number
  /** Real transfers already made into active goals. */
  committedSavingsPesewas: number
  /** Budgeted but not yet spent for the rest of the period. */
  remainingBudgetedPesewas: number
}

export interface Affordability {
  pricePesewas: number
  liquidPesewas: number
  committedSavingsPesewas: number
  remainingBudgetedPesewas: number
  /** What is spendable without breaking an existing commitment. */
  availablePesewas: number
  /** `available − price`. Negative means the purchase doesn't fit. */
  afterPurchasePesewas: number
  verdict: AffordabilityVerdict
  /** Share of available the purchase would consume. */
  percentOfAvailable: number
}

/**
 * `tight` rather than a plain yes/no when the purchase fits but leaves little
 * behind.
 *
 * A binary answer is misleading at the margin: spending 95% of what's available
 * is technically affordable and usually a bad idea, and a coach that says only
 * "yes" there is not being helpful. The threshold is a judgement call, stated
 * once here rather than scattered across the UI and the prompt.
 */
export const TIGHT_THRESHOLD_PERCENT = 85

/** The inputs to `available`, which is the half of the formula that needs no price. */
export type AvailableInput = Omit<AffordabilityInput, 'pricePesewas'>

/**
 * `available = liquid − committedSavings − remainingBudgetedSpend`.
 *
 * Split out from `deriveAffordability` because the figure is meaningful on its
 * own: the affordability screen shows what is spendable before the user has
 * typed a price, and must not reach that number by any other route.
 */
export function deriveAvailable(input: AvailableInput): number {
  const liquidPesewas = assertSafePesewas(input.liquidPesewas, 'liquidPesewas')
  const committedSavingsPesewas = assertSafePesewas(
    input.committedSavingsPesewas,
    'committedSavingsPesewas'
  )
  const remainingBudgetedPesewas = assertSafePesewas(
    input.remainingBudgetedPesewas,
    'remainingBudgetedPesewas'
  )

  return subtractPesewas(
    liquidPesewas,
    addPesewas(committedSavingsPesewas, remainingBudgetedPesewas)
  )
}

export function deriveAffordability(input: AffordabilityInput): Affordability {
  const pricePesewas = assertSafePesewas(input.pricePesewas, 'pricePesewas')
  const { liquidPesewas, committedSavingsPesewas, remainingBudgetedPesewas } = input

  const availablePesewas = deriveAvailable(input)
  const afterPurchasePesewas = subtractPesewas(availablePesewas, pricePesewas)

  // A non-positive `available` makes every share meaningless, so the percentage
  // reports 100 (fully consumed) rather than a negative or Infinity.
  const percentOfAvailable =
    availablePesewas <= 0 ? 100 : (pricePesewas / availablePesewas) * 100

  let verdict: AffordabilityVerdict
  if (afterPurchasePesewas < 0) {
    verdict = 'no'
  } else if (percentOfAvailable >= TIGHT_THRESHOLD_PERCENT) {
    verdict = 'tight'
  } else {
    verdict = 'yes'
  }

  return {
    pricePesewas,
    liquidPesewas,
    committedSavingsPesewas,
    remainingBudgetedPesewas,
    availablePesewas,
    afterPurchasePesewas,
    verdict,
    percentOfAvailable
  }
}
