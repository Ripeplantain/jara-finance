import { eq } from 'drizzle-orm'
import type { OnboardingInput, UpdateProfileInput } from '#shared/schemas/profile'
import { profiles } from '../database/schema'
import type { Database } from '../types/database'

/**
 * The profile carries the two settings every other calculation depends on:
 * `timezone` (which decides what "this month" is) and `expectedIncomePesewas`
 * (which the affordability maths uses when there isn't enough history to infer
 * income). It is created once, at onboarding.
 */

export async function getProfile(userId: string) {
  return queryProfile(useDb(), userId)
}

export async function queryProfile(db: Database, userId: string) {
  const [profile] = await db.select().from(profiles).where(eq(profiles.userId, userId)).limit(1)
  return profile
}

/**
 * Completes onboarding.
 *
 * Upserts rather than inserts so that a user who abandons onboarding halfway
 * and comes back doesn't hit a primary-key violation on a row they already
 * created. `onboardingCompletedAt` is stamped here and nowhere else — it is the
 * flag the route middleware reads to decide whether to let someone into the app.
 */
export async function completeOnboarding(userId: string, input: OnboardingInput) {
  const values = {
    userId,
    displayName: input.displayName,
    timezone: input.timezone,
    incomeFrequency: input.incomeFrequency,
    expectedIncomePesewas: input.expectedIncome,
    onboardingCompletedAt: new Date(),
    updatedAt: new Date()
  }

  const [profile] = await useDb()
    .insert(profiles)
    .values(values)
    .onConflictDoUpdate({ target: profiles.userId, set: values })
    .returning()

  return profile
}

export async function updateProfile(userId: string, input: UpdateProfileInput) {
  const [profile] = await useDb()
    .update(profiles)
    .set({
      ...(input.displayName !== undefined && { displayName: input.displayName }),
      ...(input.timezone !== undefined && { timezone: input.timezone }),
      ...(input.incomeFrequency !== undefined && { incomeFrequency: input.incomeFrequency }),
      ...(input.expectedIncome !== undefined && {
        expectedIncomePesewas: input.expectedIncome
      }),
      updatedAt: new Date()
    })
    .where(eq(profiles.userId, userId))
    .returning()

  if (!profile) {
    throw createError({ statusCode: 404, statusMessage: 'Profile not found' })
  }

  return profile
}
