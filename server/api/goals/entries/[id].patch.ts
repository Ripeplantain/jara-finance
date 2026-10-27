import { z } from 'zod'
import { updateGoalEntrySchema } from '#shared/schemas/goals'
import { uuidSchema } from '#shared/schemas/common'
import { updateGoalEntry } from '../../../services/goals'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  const input = await parseBody(event, updateGoalEntrySchema)
  return withDomainErrors(async () => ({ entry: await updateGoalEntry(user.id, id, input) }))
})
