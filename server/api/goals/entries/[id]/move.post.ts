import { z } from 'zod'
import { moveGoalEntrySchema } from '#shared/schemas/goals'
import { uuidSchema } from '#shared/schemas/common'
import { moveTrackedEntryIntoTransfer } from '../../../../services/transactions'

/** Makes a tracked contribution real by moving the money into the goal's account. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  const { fromAccountId } = await parseBody(event, moveGoalEntrySchema)
  return withDomainErrors(() => moveTrackedEntryIntoTransfer(user.id, id, fromAccountId))
})
