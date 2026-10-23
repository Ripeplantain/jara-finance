import { onboardingSchema } from '#shared/schemas/profile'
import { completeOnboarding } from '../services/profile'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, onboardingSchema)
  const profile = await completeOnboarding(user.id, input)

  return {
    displayName: profile!.displayName,
    timezone: profile!.timezone,
    onboardingCompleted: true
  }
})
