import { APICallError } from 'ai'

/**
 * Turns a provider failure into something the user can act on.
 *
 * The AI SDK masks stream errors as "An error occurred." by default, which is
 * the right default — provider errors carry request details that should not
 * reach a browser. But it is useless to the person reading it, and the two most
 * likely failures here are both things they can actually fix: a bad key and an
 * empty balance.
 *
 * So this maps the status code to a safe sentence and deliberately returns
 * nothing from the provider's own message.
 */
export function describeModelError(error: unknown): string {
  if (APICallError.isInstance(error)) {
    switch (error.statusCode) {
      case 401:
      case 403:
        return 'Salo could not sign in to the AI provider. Check the API key in your environment.'
      case 402:
        return 'The AI provider has no credit left on this key. Top it up and try again.'
      case 404:
        return 'The configured AI model was not found. Check AI_MODEL.'
      case 429:
        return 'The AI provider is rate limiting this key. Wait a moment and try again.'
      default:
        if (error.statusCode && error.statusCode >= 500) {
          return 'The AI provider is having trouble right now. Try again shortly.'
        }
        return 'Salo could not get an answer from the model. Try again.'
    }
  }

  // A tool threw. The tools only read, so this is a real server fault rather
  // than anything the user can fix.
  return 'Salo could not read your figures just now. Try again.'
}
