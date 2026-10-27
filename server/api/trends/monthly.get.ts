import { monthAnchorQuerySchema } from '#shared/schemas/reports'
import { queryMonthlySeries } from '../../services/trends'

/**
 * Income, spending and money moved into goals for six months, ending with the
 * current one or, with `?month=`, with that one.
 */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const { month } = parseQuery(event, monthAnchorQuerySchema)
  return withDomainErrors(() =>
    queryMonthlySeries(useDb(), user.id, profile.timezone, 6, new Date(), month)
  )
})
