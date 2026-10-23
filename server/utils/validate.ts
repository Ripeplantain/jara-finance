import type { H3Event } from 'h3'
import type { z } from 'zod'
import { MoneyError } from '#shared/money/pesewas'
import { DateRangeError } from '#shared/period/dates'

/**
 * Validation at the HTTP boundary.
 *
 * Everything here exists to make a bad request a 400 with a field-level message
 * instead of a 500 with a stack trace. A `ZodError` thrown from a route handler
 * would otherwise reach the client as "Internal Server Error", which tells the
 * user nothing about the amount they mistyped.
 */

export interface FieldErrors {
  [field: string]: string
}

/** Flattens Zod issues to one message per field — what a form needs to render. */
function toFieldErrors(error: z.ZodError): FieldErrors {
  const fields: FieldErrors = {}
  for (const issue of error.issues) {
    const path = issue.path.length > 0 ? issue.path.join('.') : '_'
    // First issue per field wins: later ones are usually knock-on effects of
    // the same bad value and showing three messages on one input is noise.
    fields[path] ??= issue.message
  }
  return fields
}

function badRequest(message: string, fields?: FieldErrors): never {
  throw createError({
    statusCode: 400,
    statusMessage: message,
    data: fields ? { fields } : undefined
  })
}

export async function parseBody<S extends z.ZodType>(
  event: H3Event,
  schema: S
): Promise<z.output<S>> {
  const body = await readBody(event).catch(() => undefined)
  const result = schema.safeParse(body ?? {})
  if (!result.success) {
    badRequest('Check the highlighted fields', toFieldErrors(result.error))
  }
  return result.data
}

export function parseQuery<S extends z.ZodType>(event: H3Event, schema: S): z.output<S> {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) {
    badRequest('Invalid query parameters', toFieldErrors(result.error))
  }
  return result.data
}

export function parseParams<S extends z.ZodType>(event: H3Event, schema: S): z.output<S> {
  const result = schema.safeParse(getRouterParams(event))
  if (!result.success) {
    badRequest('Not found', toFieldErrors(result.error))
  }
  return result.data
}

/**
 * Wraps a handler body so the domain layer's own errors become 400s.
 *
 * `MoneyError` and `DateRangeError` are thrown deep in `shared/` by the
 * assertions that keep floats and invalid dates out of the money path. They
 * signal bad input, not a server fault, and a route that let them escape would
 * report a user's typo as a crash.
 */
export async function withDomainErrors<T>(run: () => Promise<T>): Promise<T> {
  try {
    return await run()
  } catch (error) {
    if (error instanceof MoneyError || error instanceof DateRangeError) {
      badRequest(error.message)
    }
    throw error
  }
}
