import { transactionQuerySchema } from '#shared/schemas/transactions'
import { listTransactions } from '../../services/transactions'

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const query = parseQuery(event, transactionQuerySchema)
  // The period resolves against the user's own timezone, not the server's.
  return withDomainErrors(() => listTransactions(user.id, profile.timezone, query))
})
