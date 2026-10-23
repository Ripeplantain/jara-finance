<script setup lang="ts">
import { Chat } from '@ai-sdk/vue'
import { DefaultChatTransport } from 'ai'
import { Send, Wrench } from 'lucide-vue-next'
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
  <div class="flex min-h-[calc(100dvh-9rem)] flex-col">
    <PageHeader title="Salo" description="Ask about your money. Salo reads your real figures.">
      <template #actions>
        <span v-if="usage" class="text-xs text-muted-foreground tabular-nums">
          {{ usage.remaining }} of {{ usage.limit }} messages left today
        </span>
      </template>
    </PageHeader>

    <p v-if="usageError" class="status-strip status-strip-error mb-4" role="alert">
      Message allowance could not be checked. You can still try asking Salo.
    </p>

    <!-- Conversation -->
    <div class="app-panel flex min-h-[32rem] flex-1 flex-col">
      <div v-if="messages.length === 0" class="flex flex-1 flex-col items-center justify-center gap-5 px-5 py-12 text-center">
        <SaloMark class="size-12 text-foreground" />
        <div>
          <h2 class="text-base font-semibold">What would you like to know?</h2>
          <p class="mx-auto mt-1 max-w-sm text-sm text-muted-foreground">
            Salo only answers from figures it reads out of your ledger. If it does not have a
            number, it will say so rather than guess.
          </p>
        </div>
        <div class="grid w-full max-w-2xl gap-2 sm:grid-cols-2">
          <Button
            v-for="suggestion in SUGGESTIONS"
            :key="suggestion"
            variant="outline"
            size="sm"
            class="min-h-11 justify-start text-left"
            :disabled="outOfMessages"
            @click="ask(suggestion)"
          >
            {{ suggestion }}
          </Button>
        </div>
      </div>

      <ul
        v-else
        class="flex flex-1 flex-col gap-6 p-4 sm:p-6"
        role="log"
        aria-label="Conversation with Salo"
        aria-live="polite"
        aria-relevant="additions text"
        :aria-busy="isStreaming"
      >
        <li
          v-for="message in messages"
          :key="message.id"
          class="flex flex-col gap-1.5"
          :class="message.role === 'user' ? 'items-end' : 'items-start'"
        >
          <template v-for="(part, index) in message.parts" :key="index">
            <div
              v-if="part.type === 'text'"
              class="max-w-[92%] whitespace-pre-wrap px-4 py-3 text-sm leading-relaxed sm:max-w-[76%]"
              :class="message.role === 'user'
                ? 'bg-primary text-primary-foreground'
                : 'border-l-2 border-primary bg-muted/45'"
            >
              {{ part.text }}
            </div>

            <!--
              Tool calls are surfaced rather than hidden: the user's only way to
              see where a figure came from is to see which tool produced it.
            -->
            <p
              v-else-if="part.type.startsWith('tool-')"
              class="flex items-center gap-1.5 text-xs text-muted-foreground"
            >
              <Wrench class="size-3" aria-hidden="true" />
              Checked {{ toolLabel(part.type) }}
            </p>
          </template>
        </li>

        <li v-if="isStreaming" class="flex items-center gap-2 text-sm text-muted-foreground">
          <!-- Cells stamping, one after another — the app's own waiting mark. -->
          <span class="flex gap-1" aria-hidden="true">
            <span class="size-2 animate-pulse bg-current [animation-delay:-0.3s]" />
            <span class="size-2 animate-pulse bg-current [animation-delay:-0.15s]" />
            <span class="size-2 animate-pulse bg-current" />
          </span>
          Salo is thinking
        </li>
      </ul>
      <!-- Composer -->
      <div class="sticky bottom-20 mt-auto border-t border-border bg-card p-2 md:bottom-0 sm:p-3">
      <p v-if="error" class="mb-2 text-sm text-destructive" role="alert">{{ error }}</p>
      <p v-else-if="outOfMessages" class="mb-2 text-sm text-muted-foreground">
        You have used today's messages. The allowance resets at midnight.
      </p>

      <form class="flex items-end gap-2" @submit.prevent="send">
        <label for="ask" class="sr-only">Ask Salo</label>
        <Input
          id="ask"
          v-model="input"
          :disabled="outOfMessages"
          placeholder="Ask about your money…"
          class="min-h-11 border-0 bg-muted/55 shadow-none focus-visible:ring-0"
          autocomplete="off"
        />
        <Button type="submit" size="icon" :disabled="isStreaming || outOfMessages || input.trim() === ''">
          <Send />
          <span class="sr-only">Send</span>
        </Button>
      </form>
      </div>
    </div>
  </div>
</template>
