import { pgEnum, pgTable, text, timestamp } from 'drizzle-orm/pg-core'
import { createdAt, pesewas, updatedAt } from './columns'
import { user } from './auth'

export const incomeFrequency = pgEnum('income_frequency', [
  'weekly',
  'biweekly',
  'monthly',
  'irregular'
])

/**
 * One row per user, created during onboarding. Separate from Better Auth's
 * `user` table so auth upgrades never collide with product fields.
 *
 * `timezone` is the authority for every period boundary in the app. Nothing
 * computes "this month" from the server's clock — see `shared/period/month.ts`.
 */
export const profiles = pgTable('profiles', {
  userId: text()
    .primaryKey()
    .references(() => user.id, { onDelete: 'cascade' }),
  displayName: text().notNull(),
  currency: text().notNull().default('GHS'),
  timezone: text().notNull().default('Africa/Accra'),
  incomeFrequency: incomeFrequency().notNull().default('monthly'),
  // Nullable: onboarding lets the user skip this, and "I don't know" is a real
  // answer for irregular earners. Absence degrades AI confidence rather than
  // being faked as zero.
  expectedIncomePesewas: pesewas(),
  onboardingCompletedAt: timestamp({ withTimezone: true }),
  createdAt: createdAt(),
  updatedAt: updatedAt()
})
