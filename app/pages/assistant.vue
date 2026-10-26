<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { ArrowUp, Wrench } from 'lucide-vue-next'
import { toApiError } from '~/lib/errors'

useHead({ title: 'Ask Salo — Jara' })

const {
  data: usage,
  refresh: refreshUsage,
  error: usageError
} = await useFetch('/api/ai/usage')

const input = ref('')
const error = ref('')

/**
 * The chat transport posts to our own route, which enforces the daily cap and
 * owns the tools. Nothing about the model or its tools is reachable from here.
 */
const chat = new Chat({
  transport: new DefaultChatTransport({ api: '/api/ai/chat' }),
  onError: (caught) => {
    error.value = toApiError(caught, 'Salo could not answer just now').message
  },
  onFinish: () => {
    // The cap is enforced server-side; this just keeps the displayed count honest.
    refreshUsage()
  }
})

const messages = computed(() => chat.messages)
const isStreaming = computed(() => chat.status === 'streaming' || chat.status === 'submitted')
const outOfMessages = computed(() => (usage.value?.remaining ?? 1) <= 0)

async function send() {
  const text = input.value.trim()
  if (text === '' || isStreaming.value) return
  error.value = ''
  input.value = ''
  await chat.sendMessage({ text })
}

const SUGGESTIONS = [
  'How much did I spend this month?',
  'Where is my money going?',
  'Can I afford GH₵500 right now?',
  'Am I on track with my budget?'
]

function ask(suggestion: string) {
  input.value = suggestion
  send()
}

/** Readable names for the tools, so "consulted X" means something to the user. */
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
  // Tool parts arrive typed as `tool-<name>`.
  const name = type.replace(/^tool-/, '')
  return TOOL_LABELS[name] ?? name
}
</script>

<template>
  <div class="j-salo">
    <header class="j-page-head">
      <div>
        <p class="j-eyebrow">Your coach</p>
        <h1 class="j-h1" style="margin-top: 8px">Salo</h1>
        <p class="j-lede" style="margin-top: 14px">Ask about your money. Salo reads your real figures.</p>
      </div>
      <p v-if="usage" class="j-small j-num">
        {{ usage.remaining }} of {{ usage.limit }} messages left today
      </p>
    </header>

    <p v-if="usageError" class="j-small" role="alert" style="margin-top: 24px">
      Message allowance could not be checked. You can still try asking Salo.
    </p>

    <!-- Conversation -->
    <section class="j-section j-salo-body" aria-label="Conversation" style="margin-top: 56px">
      <div v-if="messages.length === 0" class="j-salo-start">
        <SaloAvatar class="j-salo-avatar" title="Salo" />
        <h2 class="j-h2">What would you like to know?</h2>
        <p class="j-small" style="max-width: 46ch; margin-top: 10px">
          Salo only answers from figures it reads out of your ledger. If it does not have a number,
          it will say so rather than guess.
        </p>
        <ul class="j-salo-suggestions">
          <li v-for="suggestion in SUGGESTIONS" :key="suggestion">
            <button type="button" :disabled="outOfMessages" @click="ask(suggestion)">
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

            <!--
              Tool calls are surfaced rather than hidden: the user's only way to
              see where a figure came from is to see which tool produced it.
            -->
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

      <!-- Composer -->
      <div class="j-salo-composer">
        <p v-if="error" class="j-field-error" style="margin: 0 0 10px" role="alert">{{ error }}</p>
        <p v-else-if="outOfMessages" class="j-small" style="margin-bottom: 10px">
          You have used today's messages. The allowance resets at midnight.
        </p>

        <form class="j-search" style="max-width: none" @submit.prevent="send">
          <label for="ask" class="j-sr">Ask Salo</label>
          <input
            id="ask"
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
      </div>
    </section>
  </div>
</template>
