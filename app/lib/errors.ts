/**
 * Turns a failed `$fetch` into something a form can render.
 *
 * Nitro's `createError` puts `statusMessage` and our `{ fields }` payload inside
 * `error.data`, two levels deep. Every form would otherwise repeat this
 * unwrapping, and most would get it slightly wrong and show "Internal Server
 * Error" where a field message was available.
 */
export interface ApiError {
  message: string
  fields: Record<string, string>
  statusCode: number
}

export function toApiError(error: unknown, fallback = 'Something went wrong'): ApiError {
  const candidate = error as {
    statusCode?: number
    statusMessage?: string
    data?: { statusMessage?: string, message?: string, data?: { fields?: Record<string, string> } }
  }

  const payload = candidate?.data
  return {
    message: payload?.statusMessage ?? candidate?.statusMessage ?? payload?.message ?? fallback,
    fields: payload?.data?.fields ?? {},
    statusCode: candidate?.statusCode ?? 500
  }
}
