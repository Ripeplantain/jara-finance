import { createAccountSchema } from '#shared/schemas/accounts'
import { createAccount } from '../../services/accounts'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, createAccountSchema)
  setResponseStatus(event, 201)
  return { account: await createAccount(user.id, input) }
})
