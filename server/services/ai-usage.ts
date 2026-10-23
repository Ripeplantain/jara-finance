import { and, eq, sql } from 'drizzle-orm'
import { todayInTimezone } from '#shared/period/dates'
import { aiUsageDaily } from '../database/schema'

/**
 * The free-tier daily message cap.
 *
 * Enforced server-side against `ai_usage_daily`, never trusted to the UI:
 * uncapped model spend is a named project risk, and the client is the one place
 * an attacker controls completely.
 *
 * The day is the user's own calendar day, so the allowance resets at their
 * midnight rather than UTC's — a user in Accra should not find their quota
 * resetting at 1am.
 */

export interface UsageStatus {
  day: string
  used: number
  limit: number
  remaining: number
}

export async function getUsage(userId: string, timezone: string): Promise<UsageStatus> {
  const limit = messageLimit()
  const day = todayInTimezone(timezone)

  const [row] = await useDb()
    .select({ messageCount: aiUsageDaily.messageCount })
    .from(aiUsageDaily)
    .where(and(eq(aiUsageDaily.userId, userId), eq(aiUsageDaily.day, day)))
    .limit(1)

  const used = row?.messageCount ?? 0
  return { day, used, limit, remaining: Math.max(0, limit - used) }
}

/**
 * Records one message against today's allowance and returns the new count.
 *
 * The increment is a single atomic upsert — `message_count + 1` computed by
 * Postgres, not read into JS and written back. Two concurrent requests doing
 * read-then-write would both see the same starting value and the user would get
 * a free message for every race they win.
 */
export async function consumeMessage(userId: string, timezone: string): Promise<UsageStatus> {
  const limit = messageLimit()
  const day = todayInTimezone(timezone)

  const [row] = await useDb()
    .insert(aiUsageDaily)
    .values({ userId, day, messageCount: 1 })
    .onConflictDoUpdate({
      target: [aiUsageDaily.userId, aiUsageDaily.day],
      set: {
        messageCount: sql`${aiUsageDaily.messageCount} + 1`,
        updatedAt: new Date()
      }
    })
    .returning({ messageCount: aiUsageDaily.messageCount })

  const used = row?.messageCount ?? 1
  return { day, used, limit, remaining: Math.max(0, limit - used) }
}

/**
 * Checks the cap and consumes one message, or throws 429.
 *
 * Check and consume are one step on purpose: a separate "is there room?" call
 * followed by a later increment is a race that lets a burst of parallel
 * requests all pass the check.
 */
export async function requireMessageAllowance(
  userId: string,
  timezone: string
): Promise<UsageStatus> {
  const usage = await consumeMessage(userId, timezone)

  if (usage.used > usage.limit) {
    throw createError({
      statusCode: 429,
      statusMessage: `You have used all ${usage.limit} messages for today. The allowance resets at midnight.`,
      data: { usage }
    })
  }

  return usage
}

function messageLimit(): number {
  const configured = Number(useRuntimeConfig().aiDailyMessageLimit)
  return Number.isFinite(configured) && configured > 0 ? Math.floor(configured) : 25
}
