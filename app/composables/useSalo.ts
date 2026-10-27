import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport, type UIMessage } from 'ai'
import { toApiError } from '~/lib/errors'

interface Usage { remaining: number, limit: number }

/**
 * One conversation with Salo per signed-in user, shared by every page.
 *
 * The launcher and panel are mounted once in the default layout, which Nuxt
 * keeps alive across navigation, but the panel itself unmounts when closed. The
 * `Chat` therefore lives here, at module level, so closing the panel or moving
 * between pages never loses the thread. It is created on first use in the
 * browser; it is never touched during SSR.
 *
 * The transport posts to our own route, which enforces the daily cap and owns
 * the tools. Nothing about the model or its tools is reachable from here.
 */
let chat: Chat<UIMessage> | undefined

export function useSalo() {
  const isOpen = useState('salo-open', () => false)
  const pendingPrompt = useState<string | undefined>('salo-prompt', () => undefined)
  const error = useState('salo-error', () => '')
  const usage = useState<Usage | null>('salo-usage', () => null)
  const usageError = useState('salo-usage-error', () => false)

  async function refreshUsage() {
    try {
      usage.value = await $fetch<Usage>('/api/ai/usage')
      usageError.value = false
    } catch {
      usageError.value = true
    }
  }

  function getChat(): Chat<UIMessage> {
    chat ??= new Chat<UIMessage>({
      transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
      onError: (caught) => {
        error.value = toApiError(caught, 'Salo could not answer just now').message
      },
      // The cap is enforced server-side; this just keeps the displayed count honest.
      onFinish: () => { refreshUsage() }
    })
    return chat
  }

  /** Forget the conversation, so the next person to sign in on this tab starts clean. */
  function reset() {
    chat = undefined
    error.value = ''
    usage.value = null
    pendingPrompt.value = undefined
    isOpen.value = false
  }

  return {
    isOpen,
    pendingPrompt,
    error,
    usage,
    usageError,
    refreshUsage,
    getChat,
    reset,
    /** Open the panel, optionally asking something straight away. */
    open: (prompt?: string) => {
      pendingPrompt.value = prompt
      isOpen.value = true
    },
    close: () => { isOpen.value = false }
  }
}
