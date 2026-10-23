import { createEntrySchema } from '#shared/schemas/transactions'
import { createEntry } from '../../services/transactions'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, createEntrySchema)
  setResponseStatus(event, 201)
  return withDomainErrors(async () => ({ transaction: await createEntry(user.id, input) }))
})
