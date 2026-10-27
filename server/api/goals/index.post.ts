import { createGoalSchema } from '#shared/schemas/goals'
import { createGoal } from '../../services/goals'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const input = await parseBody(event, createGoalSchema)
  setResponseStatus(event, 201)
  return withDomainErrors(async () => ({ goal: await createGoal(user.id, profile.timezone, input) }))
})
