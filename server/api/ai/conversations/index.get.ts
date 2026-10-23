import { listConversations } from '../../../services/conversations'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  return { conversations: await listConversations(user.id) }
})
