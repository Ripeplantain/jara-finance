import { budgetMonthSchema } from '#shared/schemas/budgets'
import { getBudgetStatus } from '../../services/budgets'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const { month } = parseQuery(event, budgetMonthSchema)
  // No month means the current one, in the user's timezone.
  return withDomainErrors(() => getBudgetStatus(user.id, profile.timezone, month))
})
