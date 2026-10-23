import { createCategorySchema } from '#shared/schemas/categories'
import { createCategory } from '../../services/categories'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, createCategorySchema)
  setResponseStatus(event, 201)
  return { category: await createCategory(user.id, input) }
})
