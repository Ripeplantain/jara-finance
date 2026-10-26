import { monthTotalsQuerySchema } from '#shared/schemas/reports'
import { queryTransactionMonthTotals } from '../../services/trends'

/** In and out per calendar month, for the headings on the ledger list. */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const query = parseQuery(event, monthTotalsQuerySchema)
  return withDomainErrors(() => queryTransactionMonthTotals(useDb(), user.id, profile.timezone, query))
})
