import { createOpenRouter } from '@openrouter/ai-sdk-provider'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModel } from 'ai'

/**
 * The AI provider, swappable with `AI_PROVIDER` and no code changes.
 *
 * All three paths return the same `LanguageModel` interface, so the rest of the
 * AI layer never learns which one it got. That is the point: the provider is a
 * deployment decision, not an architectural one.
 *
 * **OpenRouter is the default.** One key reaches every model worth using here,
 * which matters because Salo's model is a commodity in this design — it calls a
 * tool and explains the result, it does not reason about money. Being able to
 * change model with an env var, without a new vendor account, is worth more
 * than a direct connection to any one provider.
 */

export const AI_PROVIDERS = ['openrouter', 'anthropic', 'openai'] as const
export type AiProviderName = (typeof AI_PROVIDERS)[number]

/**
 * Defaults, overridable per deployment with `AI_MODEL`.
 *
 * A mid-tier model is the right default: the hard part of this feature is the
 * tools, and the model's only jobs are choosing one and explaining what it
 * returned. Paying for a frontier model to read back figures it was handed
 * would be spending on the wrong thing — and uncapped model spend is a named
 * project risk.
 *
 * The OpenRouter default is a **latest alias** (`~author/family-latest`) rather
 * than a pinned slug. Pinned slugs are retired as new versions ship, so a
 * hardcoded one is a deployment that breaks on someone else's release
 * schedule. The alias always resolves to the current model in that family.
 */
const DEFAULT_MODELS: Record<AiProviderName, string> = {
  openrouter: '~anthropic/claude-sonnet-latest',
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-6-astra'
}

export interface ResolvedModel {
  model: LanguageModel
  provider: AiProviderName
  modelId: string
}

export function resolveModel(): ResolvedModel {
  const config = useRuntimeConfig()
  const provider = (config.aiProvider || 'openrouter') as AiProviderName

  if (!AI_PROVIDERS.includes(provider)) {
    throw createError({
      statusCode: 500,
      statusMessage: `AI_PROVIDER must be one of ${AI_PROVIDERS.join(', ')} — got "${provider}"`
    })
  }

  const modelId = config.aiModel || DEFAULT_MODELS[provider]

  switch (provider) {
    case 'openrouter': {
      const openrouter = createOpenRouter({
        apiKey: requireKey(config.openrouterApiKey, 'OPENROUTER_API_KEY'),
        // Attribution in the OpenRouter dashboard, so spend from this app is
        // distinguishable from anything else on the same key.
        appName: config.public.appName,
        appUrl: config.betterAuthUrl,
        // 'strict' is correct for OpenRouter's own API: it sends
        // `stream_options: { include_usage: true }`, so usage is reported on
        // streamed responses. 'compatible' exists for third-party proxies.
        compatibility: 'strict'
      })
      return { model: openrouter(modelId), provider, modelId }
    }

    case 'anthropic': {
      const anthropic = createAnthropic({
        apiKey: requireKey(config.anthropicApiKey, 'ANTHROPIC_API_KEY')
      })
      return { model: anthropic(modelId), provider, modelId }
    }

    case 'openai': {
      const openai = createOpenAI({
        apiKey: requireKey(config.openaiApiKey, 'OPENAI_API_KEY')
      })
      return { model: openai(modelId), provider, modelId }
    }
  }
}

/**
 * A missing key is a 503, not a 500: the server is working, the assistant is
 * not configured. The variable name is in the message because the person who
 * sees this is the one deploying it.
 */
function requireKey(value: string | undefined, variable: string): string {
  if (!value) {
    throw createError({
      statusCode: 503,
      statusMessage: `The assistant is not configured — ${variable} is missing`
    })
  }
  return value
}
