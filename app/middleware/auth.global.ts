/**
 * Route gate.
 *
 * Runs on the server for the first request and on the client for every
 * navigation after it. The `/api/me` call is made once per page load and cached
 * in `useState`, so this costs nothing on subsequent navigations.
 *
 * This is a redirect, not a security boundary. Every API route independently
 * calls `requireUser`, because a client-side guard protects the UI and nothing
 * else.
 */
const PUBLIC_ROUTES = new Set(['/login', '/signup'])

export default defineNuxtRouteMiddleware(async (to) => {
  const { state, isSignedIn, needsOnboarding, refresh } = useCurrentUser()

  // Hydrated already on a client-side navigation; fetch on first load.
  if (state.value.user === null) {
    await refresh()
  }

  const isPublic = PUBLIC_ROUTES.has(to.path)

  if (!isSignedIn.value) {
    if (isPublic) return
    // `redirect` lets the user land where they were headed once signed in.
    return navigateTo({
      path: '/login',
      query: to.fullPath === '/' ? undefined : { redirect: to.fullPath }
    })
  }

  // Signed in but no profile yet — onboarding is the only reachable page.
  if (needsOnboarding.value && to.path !== '/onboarding') {
    return navigateTo('/onboarding')
  }

  // Signed in and set up: the auth pages have nothing left to offer.
  if (isPublic || (to.path === '/onboarding' && !needsOnboarding.value)) {
    return navigateTo('/')
  }
})
