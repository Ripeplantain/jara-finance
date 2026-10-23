import { getUsage } from '../../services/ai-usage'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return getUsage(user.id, profile.timezone)
})
