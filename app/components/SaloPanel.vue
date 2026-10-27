<script setup lang="ts">
import { ArrowUp, Wrench, X } from 'lucide-vue-next'

/**
 * The conversation itself. Mounted by `SaloLauncher` only while the panel is
 * open; the thread outlives it in `useSalo`.
 */
const emit = defineEmits<{ close: [] }>()

const { error, usage, usageError, pendingPrompt, refreshUsage, getChat } = useSalo()
const chat = getChat()

const input = ref('')
const inputEl = ref<HTMLInputElement | null>(null)
const log = ref<HTMLElement | null>(null)

const messages = computed(() => chat.messages)
const isStreaming = computed(() => chat.status === 'streaming' || chat.status === 'submitted')
const outOfMessages = computed(() => (usage.value?.remaining ?? 1) <= 0)

async function send(text = input.value) {
  const value = text.trim()
  if (value === '' || isStreaming.value) return
  error.value = ''
  input.value = ''
  await chat.sendMessage({ text: value })
}

// Static, per page: nothing is fetched to produce these, and Salo still
// answers from its tools, never from the wording of the question.
const SUGGESTIONS: Array<{ prefix: string, items: string[] }> = [
  { prefix: '/budgets', items: ['Am I on track with my budget?', 'Which budget is closest to its limit?', 'How are my savings goals doing?'] },
  { prefix: '/goals', items: ['How are my savings goals doing?', 'Am I on track with my budget?'] },
  { prefix: '/afford', items: ['Can I afford GH₵500 right now?', 'What would that leave me for the month?'] },
  { prefix: '/insights', items: ['Where is my money going?', 'How much did I spend this month?'] },
  { prefix: '/transactions', items: ['What did I spend most on recently?', 'How much did I spend this month?'] }
]
const DEFAULT_SUGGESTIONS = [
  'How much did I spend this month?',
  'Where is my money going?',
  'Can I afford GH₵500 right now?',
  'Am I on track with my budget?'
]

const route = useRoute()
const suggestions = computed(
  () => SUGGESTIONS.find(entry => route.path.startsWith(entry.prefix))?.items ?? DEFAULT_SUGGESTIONS
)

/** Readable names for the tools, so "checked X" means something to the user. */
const TOOL_LABELS: Record<string, string> = {
  getBalances: 'your account balances',
  getPeriodSummary: 'your income and spending totals',
  getSpendingByCategory: 'your spending by category',
  getBudgetStatus: 'your budget',
  getGoals: 'your savings goals',
  getRecentTransactions: 'your recent transactions',
  checkAffordability: 'what you can afford',
  getToday: "today's date"
}

function toolLabel(type: string): string {
  const name = type.replace(/^tool-/, '')
  return TOOL_LABELS[name] ?? name
}

// Keep the newest line in view as the answer streams in.
watch(
  () => [messages.value.length, isStreaming.value, messages.value.at(-1)?.parts.length],
  () => nextTick(() => log.value?.scrollTo({ top: log.value.scrollHeight })),
  { flush: 'post' }
)

// A prompt handed over by `open('…')` while the panel was closed or already open.
watch(pendingPrompt, (prompt) => {
  if (!prompt) return
  pendingPrompt.value = undefined
  send(prompt)
})

onMounted(() => {
  refreshUsage()
  if (pendingPrompt.value) {
    const prompt = pendingPrompt.value
    pendingPrompt.value = undefined
    send(prompt)
  } else {
    inputEl.value?.focus()
  }
})
</script>

<template>
  <section id="salo-panel" class="j-salo-panel" role="dialog" aria-label="Salo, your money coach">
    <header class="j-salo-head">
      <SaloAvatar class="j-salo-mark" />
      <div class="j-salo-title">
        <strong>Salo</strong>
        <span>Reads your real figures</span>
      </div>
      <button type="button" class="j-icon-link j-salo-close" aria-label="Close Salo" @click="emit('close')">
        <X :size="18" aria-hidden="true" />
      </button>
    </header>

    <div ref="log" class="j-salo-scroll">
      <p v-if="usageError" class="j-small" role="alert" style="margin-bottom: 16px">
        Message allowance could not be checked. You can still try asking Salo.
      </p>

      <div v-if="messages.length === 0" class="j-salo-start">
        <h2 class="j-salo-ask">What would you like to know?</h2>
        <p class="j-small" style="margin-top: 8px">
          Salo only answers from figures it reads out of your ledger. If it does not have a number,
          it will say so rather than guess.
        </p>
        <ul class="j-salo-suggestions">
          <li v-for="suggestion in suggestions" :key="suggestion">
            <button type="button" :disabled="outOfMessages" @click="send(suggestion)">
              {{ suggestion }}
            </button>
          </li>
        </ul>
      </div>

      <ul
        v-else
        class="j-salo-log"
        role="log"
        aria-label="Conversation with Salo"
        aria-live="polite"
        aria-relevant="additions text"
        :aria-busy="isStreaming"
      >
        <li
          v-for="message in messages"
          :key="message.id"
          :class="message.role === 'user' ? 'is-user' : 'is-salo'"
        >
          <p v-if="message.role !== 'user'" class="j-eyebrow who">Salo</p>
          <template v-for="(part, index) in message.parts" :key="index">
            <p v-if="part.type === 'text'" class="said">{{ part.text }}</p>

            <!-- Tool calls are surfaced so the user can see where a figure came from. -->
            <p v-else-if="part.type.startsWith('tool-')" class="j-small checked">
              <Wrench :size="12" aria-hidden="true" />
              Checked {{ toolLabel(part.type) }}
            </p>
          </template>
        </li>

        <li v-if="isStreaming" class="is-salo j-small">
          <span class="j-salo-dots" aria-hidden="true"><i /><i /><i /></span>
          Salo is thinking
        </li>
      </ul>
    </div>

    <footer class="j-salo-foot">
      <p v-if="error" class="j-field-error" role="alert">{{ error }}</p>
      <p v-else-if="outOfMessages" class="j-small">
        You have used today's messages. The allowance resets at midnight.
      </p>

      <form class="j-search" @submit.prevent="send()">
        <label for="salo-ask" class="j-sr">Ask Salo</label>
        <input
          id="salo-ask"
          ref="inputEl"
          v-model="input"
          :disabled="outOfMessages"
          placeholder="Ask about your money…"
          autocomplete="off"
        >
        <button
          type="submit"
          class="j-salo-send"
          :disabled="isStreaming || outOfMessages || input.trim() === ''"
        >
          <ArrowUp :size="18" aria-hidden="true" />
          <span class="j-sr">Send</span>
        </button>
      </form>

      <p v-if="usage" class="j-small j-num j-salo-left">
        {{ usage.remaining }} of {{ usage.limit }} messages left today
      </p>
    </footer>
  </section>
</template>
