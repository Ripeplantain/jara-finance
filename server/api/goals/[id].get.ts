import { z } from 'zod'
import { uuidSchema } from '#shared/schemas/common'
import { getGoalDetail } from '../../services/goals'

/** One goal with its progress and every contribution. */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  return withDomainErrors(() => getGoalDetail(user.id, profile.timezone, id))
})
