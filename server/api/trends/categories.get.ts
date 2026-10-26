import { queryCategoryComparison } from '../../services/trends'

/** Category spending this month beside last month. */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return withDomainErrors(() => queryCategoryComparison(useDb(), user.id, profile.timezone))
})
