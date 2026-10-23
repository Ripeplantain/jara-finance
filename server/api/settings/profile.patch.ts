import { updateProfileSchema } from '#shared/schemas/profile'
import { updateProfile } from '../../services/profile'

export default defineEventHandler(async (event) => {
  const user = await requireUser(event)
  const input = await parseBody(event, updateProfileSchema)
  const profile = await updateProfile(user.id, input)
  return {
    displayName: profile.displayName,
    timezone: profile.timezone,
    incomeFrequency: profile.incomeFrequency,
    expectedIncomePesewas: profile.expectedIncomePesewas
  }
})
