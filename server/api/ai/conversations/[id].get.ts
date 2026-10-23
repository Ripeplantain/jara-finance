import { z } from 'zod'
import { uuidSchema } from '#shared/schemas/common'
import { getMessages } from '../../../services/conversations'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  return { conversationId: id, messages: await getMessages(user.id, id) }
})
