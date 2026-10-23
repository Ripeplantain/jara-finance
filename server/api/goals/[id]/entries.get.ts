import { z } from 'zod'
import { uuidSchema } from '#shared/schemas/common'
import { listGoalEntries } from '../../../services/goals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  return { entries: await listGoalEntries(user.id, id) }
})
