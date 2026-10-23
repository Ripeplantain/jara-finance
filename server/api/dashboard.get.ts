import { getDashboard } from '../services/summary'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return withDomainErrors(() => getDashboard(user.id, profile.timezone))
})
