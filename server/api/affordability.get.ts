import { z } from 'zod'
import { positiveAmountSchema } from '#shared/schemas/common'
import { checkAffordability, getHeadroom } from '../services/affordability'

/**
 * "Can I afford GH₵X?" — the same endpoint the UI and the AI's tool both use,
 * so the number on screen and the number Salo quotes cannot diverge.
 *
 * `price` is optional. Without one the route answers the half of the formula
 * that needs no price: what is in hand, what is already promised, and what that
 * leaves. The affordability screen opens on that breakdown and asks for a price
 * second, so the verdict is always read against figures the user has already
 * seen.
 */
export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const { price } = parseQuery(event, z.object({ price: positiveAmountSchema.optional() }))

  return withDomainErrors(async () => {
    if (price === undefined) {
      const headroom = await getHeadroom(user.id, profile.timezone)
      return {
        ...headroom,
        pricePesewas: null,
        afterPurchasePesewas: null,
        percentOfAvailable: null,
        verdict: null
      }
    }

    return checkAffordability(user.id, profile.timezone, price)
  })
})
