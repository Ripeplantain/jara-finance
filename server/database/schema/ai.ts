import { sql } from 'drizzle-orm'
import {
  check,
  date,
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  primaryKey,
  text,
  timestamp,
  uuid
} from 'drizzle-orm/pg-core'
import { createdAt, updatedAt } from './columns'
import { user } from './auth'

export const aiRole = pgEnum('ai_role', ['user', 'assistant'])

export const aiConversations = pgTable(
  'ai_conversations',
  {
    id: uuid().primaryKey().defaultRandom(),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    // Derived from the first user message; null until then.
    title: text(),
    archivedAt: timestamp({ withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [index('ai_conversations_user_updated_idx').on(table.userId, table.updatedAt.desc())]
)

/**
 * `parts` stores the AI SDK `UIMessage.parts` array verbatim — text, tool calls
 * and tool results — so a reloaded conversation renders identically to the live
 * one, including which tools Salo consulted.
 *
 * `text` is the flattened text content, kept separately for search and for
 * cheaply rebuilding model context without walking the parts tree.
 */
export const aiMessages = pgTable(
  'ai_messages',
  {
    id: uuid().primaryKey().defaultRandom(),
    conversationId: uuid()
      .notNull()
      .references(() => aiConversations.id, { onDelete: 'cascade' }),
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    role: aiRole().notNull(),
    text: text().notNull(),
    parts: jsonb(),
    createdAt: createdAt()
  },
  table => [index('ai_messages_conversation_idx').on(table.conversationId, table.createdAt)]
)

/**
 * Per-user daily message counter. The free tier caps AI messages per day
 * (PRD §12) and uncapped model spend is a named project risk (§14), so the
 * limit is enforced server-side against this table rather than trusted to the UI.
 *
 * `day` is a calendar date in the user's own timezone, so the allowance resets
 * at their midnight, not UTC's.
 */
export const aiUsageDaily = pgTable(
  'ai_usage_daily',
  {
    userId: text()
      .notNull()
      .references(() => user.id, { onDelete: 'cascade' }),
    day: date({ mode: 'string' }).notNull(),
    messageCount: integer().notNull().default(0),
    updatedAt: updatedAt()
  },
  table => [
    primaryKey({ columns: [table.userId, table.day] }),
    check('ai_usage_daily_count_non_negative', sql`${table.messageCount} >= 0`)
  ]
)
