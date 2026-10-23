import { z } from 'zod'
import { contributeToGoalSchema } from '#shared/schemas/goals'
import { uuidSchema } from '#shared/schemas/common'
import { contributeToGoal } from '../../../services/goals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  const input = await parseBody(event, contributeToGoalSchema)
  setResponseStatus(event, 201)
  return withDomainErrors(() => contributeToGoal(user.id, id, input))
})
