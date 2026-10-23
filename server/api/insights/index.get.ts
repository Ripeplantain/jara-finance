import { refreshInsights } from '../../services/insights'

/**
 * Recomputes and returns this month's insights.
 *
 * Recomputing on read keeps them consistent with the ledger without a
 * background job; the upsert preserves dismissals. Cheap enough at MVP scale,
 * and the alternative — stale insights contradicting the dashboard beside them
 * — is worse than the query cost.
 */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  return withDomainErrors(async () => ({
    insights: await refreshInsights(user.id, profile.timezone)
  }))
})
