import { and, asc, desc, eq, isNull } from 'drizzle-orm'
import type { UIMessage } from 'ai'
import { aiConversations, aiMessages } from '../database/schema'

/**
 * Conversation persistence.
 *
 * `parts` stores the AI SDK's `UIMessage.parts` verbatim, so a reloaded
 * conversation renders identically to the live one — including which tools Salo
 * consulted, which is the user's only way to see where a figure came from.
 * `text` holds the flattened content for cheap context rebuilding and search.
 */

export async function listConversations(userId: string) {
  return useDb()
    .select({
      id: aiConversations.id,
      title: aiConversations.title,
      updatedAt: aiConversations.updatedAt
    })
    .from(aiConversations)
    .where(and(eq(aiConversations.userId, userId), isNull(aiConversations.archivedAt)))
    .orderBy(desc(aiConversations.updatedAt))
    .limit(30)
}

/** Resolves an existing conversation or starts one, always scoped to the user. */
export async function resolveConversation(userId: string, conversationId?: string) {
  const db = useDb()

  if (conversationId) {
    const [existing] = await db
      .select({ id: aiConversations.id })
      .from(aiConversations)
      .where(
        and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId))
      )
      .limit(1)

    if (!existing) {
      throw createError({ statusCode: 404, statusMessage: 'Conversation not found' })
    }
    return existing.id
  }

  const [created] = await db.insert(aiConversations).values({ userId }).returning({
    id: aiConversations.id
  })
  return created!.id
}

export async function getMessages(userId: string, conversationId: string) {
  const db = useDb()

  const rows = await db
    .select({
      id: aiMessages.id,
      role: aiMessages.role,
      text: aiMessages.text,
      parts: aiMessages.parts,
      createdAt: aiMessages.createdAt
    })
    .from(aiMessages)
    .where(
      and(eq(aiMessages.conversationId, conversationId), eq(aiMessages.userId, userId))
    )
    .orderBy(asc(aiMessages.createdAt))

  return rows.map(row => ({
    id: row.id,
    role: row.role,
    // Fall back to a text part for any row written before `parts` existed, so
    // an old conversation still renders.
    parts: (row.parts as UIMessage['parts']) ?? [{ type: 'text' as const, text: row.text }]
  }))
}

export async function saveMessage(
  userId: string,
  conversationId: string,
  message: { role: 'user' | 'assistant', text: string, parts?: unknown }
) {
  const db = useDb()

  await db.insert(aiMessages).values({
    conversationId,
    userId,
    role: message.role,
    text: message.text,
    parts: message.parts ?? null
  })

  // Title the conversation from its first user message, so the history list is
  // scannable without asking the model for a summary.
  const [conversation] = await db
    .select({ title: aiConversations.title })
    .from(aiConversations)
    .where(eq(aiConversations.id, conversationId))
    .limit(1)

  await db
    .update(aiConversations)
    .set({
      updatedAt: new Date(),
      ...(conversation?.title === null && message.role === 'user'
        ? { title: message.text.slice(0, 70) }
        : {})
    })
    .where(and(eq(aiConversations.id, conversationId), eq(aiConversations.userId, userId)))
}

/** The flattened text of a `UIMessage`, for the `text` column. */
export function flattenText(message: UIMessage): string {
  return message.parts
    .filter((part): part is { type: 'text', text: string } => part.type === 'text')
    .map(part => part.text)
    .join('\n')
    .trim()
}
