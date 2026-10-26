import { dashboardQuerySchema } from '#shared/schemas/reports'
import { getDashboard } from '../services/summary'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  // `range` is optional and defaults to this month, so existing callers are unchanged.
  const { range } = parseQuery(event, dashboardQuerySchema)
  return withDomainErrors(() => getDashboard(user.id, profile.timezone, range))
})
