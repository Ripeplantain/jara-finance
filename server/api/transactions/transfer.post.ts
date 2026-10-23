import { createTransferSchema } from '#shared/schemas/transactions'
import { createTransfer } from '../../services/transactions'

/**
 * Transfers get their own route rather than sharing the entry route.
 *
 * They have a genuinely different shape — two accounts, no category — and a
 * different write path (a pair of rows in one DB transaction). Folding both
 * into one endpoint would mean a body that is half-ignored depending on a
 * `type` discriminator.
 */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, createTransferSchema)
  setResponseStatus(event, 201)
  return withDomainErrors(() => createTransfer(user.id, input))
})
