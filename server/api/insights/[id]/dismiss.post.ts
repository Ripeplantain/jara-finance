import { z } from 'zod'
import { uuidSchema } from '#shared/schemas/common'
import { dismissInsight } from '../../../services/insights'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const { id } = parseParams(event, z.object({ id: uuidSchema }))
  return dismissInsight(user.id, id)
})
