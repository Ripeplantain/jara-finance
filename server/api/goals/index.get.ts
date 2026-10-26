import { listGoals, summariseActiveGoals } from '../../services/goals'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return withDomainErrors(async () => {
    const goals = await listGoals(user.id, profile.timezone)
    // `totals` is additive: the Goals page reads only `goals`.
    return { goals, totals: summariseActiveGoals(goals) }
  })
})
