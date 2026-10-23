import { accountIdSchema, updateAccountSchema } from '#shared/schemas/accounts'
import { updateAccount } from '../../services/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, accountIdSchema)
  const input = await parseBody(event, updateAccountSchema)
  return { account: await updateAccount(user.id, id, input) }
})
