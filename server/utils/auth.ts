import { betterAuth } from 'better-auth'
import { drizzleAdapter } from '@better-auth/drizzle-adapter'
import * as schema from '../database/schema'

/**
 * Email and password only. Social providers are a deliberate non-goal for the
 * MVP: every OAuth provider is a separate callback URL, consent screen and
 * support burden, and none of them are how the target user signs into things.
 *
 * `requireEmailVerification` stays off because there is no mail transport wired
 * up yet — turning it on without one would lock every new account out
 * permanently.
 */
function createAuth() {
  const config = useRuntimeConfig()

  if (!config.betterAuthSecret) {
    throw new Error(
      'BETTER_AUTH_SECRET is not set. Generate one with `openssl rand -base64 32`.'
    )
  }

  return betterAuth({
    secret: config.betterAuthSecret,
    baseURL: config.betterAuthUrl,
    // The adapter addresses tables by the property names in our schema barrel —
    // `user`, `session`, `account`, `verification` — which match Better Auth's
    // own singular naming, so no mapping is needed.
    //
    // Id generation is left at its default: Better Auth populates the `text`
    // primary keys itself. The schema defines no database default for them, so
    // delegating that to the database would insert nulls.
    database: drizzleAdapter(useDb(), {
      provider: 'pg',
      schema,
      transaction: true
    }),
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: false,
      minPasswordLength: 8
    },
    session: {
      expiresIn: 60 * 60 * 24 * 30,
      updateAge: 60 * 60 * 24,
      // Short-lived signed cookie copy of the session, so the common "who is
      // this?" check on every request doesn't hit Postgres.
      cookieCache: { enabled: true, maxAge: 60 * 5 }
    }
  })
}

/**
 * The Better Auth instance, created lazily so importing this module never reads
 * runtime config (or opens a connection) at build time.
 *
 * The type comes from `createAuth` rather than from `betterAuth` itself:
 * `betterAuth` infers a type parameter from the exact options it was given, so
 * annotating this as the generic `Auth<BetterAuthOptions>` would not match.
 */
let instance: ReturnType<typeof createAuth> | undefined

export function useAuth() {
  instance ??= createAuth()
  return instance
}
