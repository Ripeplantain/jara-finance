import { listGoals } from '../../services/goals'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return withDomainErrors(async () => ({ goals: await listGoals(user.id, profile.timezone) }))
})
