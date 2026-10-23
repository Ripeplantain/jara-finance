import { sql } from 'drizzle-orm'

export default defineEventHandler(async () => {
  const startedAt = Date.now()

  try {
    await useDb().execute(sql`select 1`)
  } catch (error) {
    throw createError({
      statusCode: 503,
      statusMessage: 'Database unavailable',
      data: { reason: error instanceof Error ? error.message : 'unknown' }
    })
  }

  return {
    status: 'ok',
    database: 'connected',
    latencyMs: Date.now() - startedAt
  }
})
