import { queryDailySpend } from '../../services/trends'

/** Spending by day, with a running total, for the current month up to today. */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return withDomainErrors(() => queryDailySpend(useDb(), user.id, profile.timezone))
})
