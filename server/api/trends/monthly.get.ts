import { queryMonthlySeries } from '../../services/trends'

/** Income, spending and money moved into goals for each of the last six months. */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return withDomainErrors(() => queryMonthlySeries(useDb(), user.id, profile.timezone))
})
