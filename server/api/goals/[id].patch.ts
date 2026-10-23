import { z } from 'zod'
import { updateGoalSchema } from '#shared/schemas/goals'
import { uuidSchema } from '#shared/schemas/common'
import { updateGoal } from '../../services/goals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  const input = await parseBody(event, updateGoalSchema)
  return withDomainErrors(async () => ({ goal: await updateGoal(user.id, id, input) }))
})
