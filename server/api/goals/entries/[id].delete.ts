import { z } from 'zod'
import { uuidSchema } from '#shared/schemas/common'
import { deleteGoalEntry } from '../../../services/goals'

/** Deletes a tracked contribution. A real transfer is deleted from the ledger instead. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  return withDomainErrors(() => deleteGoalEntry(user.id, id))
})
