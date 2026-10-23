import { z } from 'zod'
import { uuidSchema } from '#shared/schemas/common'
import { deleteTransaction } from '../../services/transactions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  return deleteTransaction(user.id, id)
})
