import { z } from 'zod'
import { uuidSchema } from '#shared/schemas/common'
import { deleteGoal } from '../../services/goals'

/** Deletes a goal that has no contributions. A goal with money in it is refused with a 409. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  return withDomainErrors(() => deleteGoal(user.id, id))
})
