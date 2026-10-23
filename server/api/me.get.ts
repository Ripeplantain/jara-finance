import { getProfile } from '../services/profile'

/**
 * Who am I, and have I finished onboarding?
 *
 * The client hydrates its auth state from this one endpoint rather than calling
 * Better Auth's session route directly, because the app's notion of "ready to
 * use" includes having a profile — and the profile is where the timezone lives.
 *
 * Returns 200 with `user: null` for an anonymous caller rather than a 401: this
 * is the endpoint that *answers* the question, so "nobody is signed in" is a
 * successful answer, not an error. The global middleware depends on that.
 */
export default defineEventHandler(async (event) => {
  const user = await getUser(event)
  if (!user) {
    return { user: null, profile: null }
  }

  const profile = await getProfile(user.id)

  return {
    user,
    profile: profile
      ? {
          displayName: profile.displayName,
          currency: profile.currency,
          timezone: profile.timezone,
          incomeFrequency: profile.incomeFrequency,
          expectedIncomePesewas: profile.expectedIncomePesewas,
          onboardingCompleted: profile.onboardingCompletedAt !== null
        }
      : null
  }
})
