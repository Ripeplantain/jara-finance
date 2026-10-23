import { convertToModelMessages, stepCountIs, streamText, type UIMessage } from 'ai'
import { z } from 'zod'
import { todayInTimezone } from '#shared/period/dates'
import { uuidSchema } from '#shared/schemas/common'
import { describeModelError } from '../../ai/errors'
import { buildSystemPrompt } from '../../ai/prompt'
import { resolveModel } from '../../ai/provider'
import { buildTools } from '../../ai/tools'
import { requireMessageAllowance } from '../../services/ai-usage'
import {
  flattenText,
  resolveConversation,
  saveMessage
} from '../../services/conversations'

/**
 * The AI coach's streaming endpoint.
 *
 * Order of operations matters here:
 *
 * 1. Authenticate and load the profile (the timezone the tools will use).
 * 2. Resolve the model, which validates configuration without a network call.
 *    This happens before the allowance is touched so a misconfigured server
 *    returns 503 without silently spending one of the user's daily messages.
 * 3. Consume the daily allowance **before** calling the model, so a request
 *    that is over the cap costs nothing, and persist the user's message so it
 *    survives a dropped connection mid-response.
 * 4. Stream, letting the model take several steps — it needs at least two
 *    (call a tool, then explain the result) and often three.
 * 5. Persist the assistant's message in `onFinish`, with its `parts` intact.
 */

const chatRequestSchema = z.object({
  // `UIMessage` is the AI SDK's own shape; validating its internals here would
  // mean duplicating a type the SDK already owns and re-breaking on every
  // upgrade. The messages are replayed to the model, not trusted as commands.
  messages: z.array(z.any()).min(1),
  conversationId: uuidSchema.optional()
})

export default defineEventHandler(async (event) => {
  const { user, profile } = await requireProfile(event)
  const body = await parseBody(event, chatRequestSchema)
  const messages = body.messages as UIMessage[]

  // Validated first: it reads config only, so an unconfigured provider fails
  // here rather than after charging the user a message.
  const { model } = resolveModel()

  const usage = await requireMessageAllowance(user.id, profile.timezone)
  const conversationId = await resolveConversation(user.id, body.conversationId)

  const lastMessage = messages[messages.length - 1]
  if (lastMessage?.role === 'user') {
    await saveMessage(user.id, conversationId, {
      role: 'user',
      text: flattenText(lastMessage),
      parts: lastMessage.parts
    })
  }

  const result = streamText({
    model,
    system: buildSystemPrompt(profile, todayInTimezone(profile.timezone)),
    messages: await convertToModelMessages(messages),
    tools: buildTools(user.id, profile),
    // A tool call plus an explanation is two steps; a follow-up check makes
    // three. The cap stops a loop from running up unbounded model spend.
    stopWhen: stepCountIs(6),
    onFinish: async ({ text }) => {
      await saveMessage(user.id, conversationId, { role: 'assistant', text })
    }
  })

  // The client reads these to show the remaining allowance without a second
  // request, and to attach follow-up messages to the right conversation.
  setResponseHeaders(event, {
    'x-salo-conversation-id': conversationId,
    'x-salo-messages-remaining': String(usage.remaining)
  })

  // Without `onError` the SDK sends a bare "An error occurred." Mapping it gives
  // the user something they can act on — a dead key and an empty balance are
  // both fixable, and both look identical otherwise.
  return result.toUIMessageStreamResponse({
    onError: error => describeModelError(error)
  })
})
