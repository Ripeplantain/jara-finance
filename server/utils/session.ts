import type { H3Event } from 'h3'
import { eq } from 'drizzle-orm'
import { profiles } from '../database/schema'

export interface SaloUser {
  id: string
  email: string
  name: string
}

export interface SaloProfile {
  userId: string
  displayName: string
  currency: string
  timezone: string
  incomeFrequency: typeof profiles.$inferSelect['incomeFrequency']
  expectedIncomePesewas: number | null
  onboardingCompletedAt: Date | null
}

/**
 * The request's headers as web-standard `Headers`, which is what Better Auth
 * expects — it reads the session cookie off them.
 *
 * Built by copying `getRequestHeaders`, **not** via `toWebRequest(event)`.
 * `toWebRequest` constructs a `Request` around the same underlying body stream,
 * and once that exists a later `readBody(event)` in the same handler never
 * resolves. Since practically every POST route calls a guard here and then
 * reads its body, using it would hang every write in the app.
 */
function requestHeaders(event: H3Event): Headers {
  const headers = new Headers()
  for (const [name, value] of Object.entries(getRequestHeaders(event))) {
    if (value !== undefined) headers.set(name, value)
  }
  return headers
}

/**
 * The session, or null. Use when a route serves both signed-in and anonymous
 * callers; everything that touches user data uses `requireUser` instead.
 */
export async function getUser(event: H3Event): Promise<SaloUser | null> {
  const session = await useAuth().api.getSession({ headers: requestHeaders(event) })
  if (!session?.user) return null
  return { id: session.user.id, email: session.user.email, name: session.user.name }
}

/**
 * The signed-in user, or a 401.
 *
 * Every route handler that reads or writes user data starts here. The returned
 * `id` is the only acceptable source of a `userId` for a query — a `userId`
 * taken from a request body or query string would let any caller name someone
 * else's rows.
 */
export async function requireUser(event: H3Event): Promise<SaloUser> {
  const user = await getUser(event)
  if (!user) {
    throw createError({ statusCode: 401, statusMessage: 'Sign in to continue' })
  }
  return user
}

/**
 * The user plus their profile, or a 401/409.
 *
 * Most routes need this rather than `requireUser`, because the profile carries
 * the `timezone` that decides what "this month" means. Resolving a period
 * against the server's clock instead would silently report the wrong window for
 * any user not sitting in the server's timezone.
 *
 * A signed-in user without a profile has not finished onboarding; that is a 409
 * with a pointer rather than a 404, because the row is expected to exist and
 * the client's correct response is to send them to `/onboarding`.
 */
export async function requireProfile(
  event: H3Event
): Promise<{ user: SaloUser, profile: SaloProfile }> {
  const user = await requireUser(event)
  const [profile] = await useDb()
    .select()
    .from(profiles)
    .where(eq(profiles.userId, user.id))
    .limit(1)

  if (!profile) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Finish setting up your account',
      data: { redirect: '/onboarding' }
    })
  }

  return { user, profile }
}
