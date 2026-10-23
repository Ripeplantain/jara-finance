import { upsertBudgetSchema } from '#shared/schemas/budgets'
import { getBudgetStatus, upsertBudget } from '../../services/budgets'

/**
 * PUT rather than POST: a month has at most one budget, so saving is idempotent
 * — sending the same body twice leaves the same single budget, not two.
 */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const input = await parseBody(event, upsertBudgetSchema)

  return withDomainErrors(async () => {
    await upsertBudget(user.id, input)
    // Return the recomputed status, so the client doesn't need a second request
    // to show progress against the limits it just set.
    return getBudgetStatus(user.id, profile.timezone, input.month)
  })
})
