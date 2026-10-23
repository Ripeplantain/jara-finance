import { categoryQuerySchema } from '#shared/schemas/categories'
import { listCategories } from '../../services/categories'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const query = parseQuery(event, categoryQuerySchema)
  return {
    categories: await listCategories(user.id, {
      kind: query.kind,
      includeArchived: query.includeArchived
    })
  }
})
