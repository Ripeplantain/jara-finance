interface MeResponse {
  user: { id: string, email: string, name: string } | null
  profile: {
    displayName: string
    currency: string
    timezone: string
    incomeFrequency: string
    expectedIncomePesewas: number | null
    onboardingCompleted: boolean
  } | null
}

/**
 * The app's single source of auth state, hydrated from `/api/me`.
 *
 * It reads our own endpoint rather than Better Auth's session route for two
 * reasons:
 *
 * 1. "Signed in" is not the same as "ready to use the app" — the latter needs a
 *    completed profile, and one request should answer both.
 * 2. It must work during SSR. `useRequestFetch` forwards the incoming cookies
 *    to the internal call, so the first render already knows who the user is
 *    and the page doesn't flash a signed-out state before hydrating.
 *
 * The result is cached in `useState`, so the many components that need the
 * user's currency or timezone share one fetch per navigation.
 */
export function useCurrentUser() {
  const state = useState<MeResponse>('salo-me', () => ({ user: null, profile: null }))

  async function refresh() {
    state.value = await useRequestFetch()('/api/me') as MeResponse
    return state.value
  }

  const user = computed(() => state.value.user)
  const profile = computed(() => state.value.profile)
  const isSignedIn = computed(() => state.value.user !== null)
  const needsOnboarding = computed(
    () => state.value.user !== null && state.value.profile?.onboardingCompleted !== true
  )
  const currency = computed(() => state.value.profile?.currency ?? 'GHS')
  const timezone = computed(() => state.value.profile?.timezone ?? 'Africa/Accra')

  return { state, user, profile, isSignedIn, needsOnboarding, currency, timezone, refresh }
}
