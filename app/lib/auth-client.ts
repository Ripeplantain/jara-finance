import { createAuthClient } from 'better-auth/vue'

/**
 * Browser-side auth client, used only for the mutations: sign up, sign in,
 * sign out.
 *
 * Session *reading* deliberately does not go through here. It goes through
 * `useCurrentUser`, which calls our own `/api/me` — see that composable for
 * why.
 */
export const authClient = createAuthClient({
  // Same origin, so a relative base keeps dev, preview and production working
  // without a per-environment URL.
  baseURL: ''
})
