import { bigint, timestamp } from 'drizzle-orm/pg-core'

/**
 * Money. Always integer pesewas (1 GHS = 100 pesewas), never a float, never
 * numeric/decimal. `bigint({ mode: 'number' })` maps to a JS number, which is
 * exact up to 2^53 — about GH₵ 90 trillion. `assertSafePesewas` in
 * `shared/money/pesewas.ts` guards the ceiling on every arithmetic path.
 *
 * Postgres bigint rather than integer because integer caps at GH₵ 21.4m, which
 * a business account could plausibly exceed.
 */
export const pesewas = () => bigint({ mode: 'number' })

/** `created_at` / `updated_at`. Instants, so timestamptz. */
export const createdAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
export const updatedAt = () => timestamp({ withTimezone: true }).notNull().defaultNow()
