import { accountIdSchema } from '#shared/schemas/accounts'
import { deleteAccount } from '../../services/accounts'

/** Permanently removes only an account with no transactions or linked savings goal. */
export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, accountIdSchema)
  return withDomainErrors(() => deleteAccount(user.id, id))
})
