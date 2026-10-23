import { z } from 'zod'
import { updateEntrySchema } from '#shared/schemas/transactions'
import { uuidSchema } from '#shared/schemas/common'
import { updateEntry } from '../../services/transactions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  const input = await parseBody(event, updateEntrySchema)
  return withDomainErrors(async () => ({ transaction: await updateEntry(user.id, id, input) }))
})
