import { listAccounts } from '../../services/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const includeArchived = getQuery(event).includeArchived === 'true'
  return { accounts: await listAccounts(user.id, includeArchived) }
})
