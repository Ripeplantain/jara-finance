<script setup lang="ts">
import { ArrowLeftRight, Minus, Plus } from 'lucide-vue-next'
import { pesewasToAmountString } from '#shared/money/pesewas'
import { ACCOUNT_TYPE_LABELS } from '#shared/schemas/accounts'
import { toApiError } from '~/lib/errors'

/**
 * Records income, an expense or a transfer.
 *
 * The three modes are one form because the user thinks of them as one action
 * ("record something that happened to my money"), but they post to different
 * endpoints with different shapes — a transfer has two accounts and no
 * category, which the server also enforces.
 */
const props = defineProps<{
  accounts: Array<{ accountId: string, name: string, type: string, currency: string }>
  categories: Array<{ id: string, name: string, kind: string }>
  /** Today in the user's timezone, resolved server-side. */
  today: string
  /**
   * Prefills the amount. Set when the user arrives from the Afford screen
   * having just been told a purchase fits, so "yes" leads somewhere instead of
   * asking them to retype the figure they were just looking at.
   */
  initialAmount?: string
  /**
   * Edits this saved income or expense instead of recording a new one. The
   * type is fixed (a different type means a different kind of record, so that
   * is delete and re-add) and transfers are not editable at all.
   */
  entry?: {
    id: string
    type: 'income' | 'expense'
    accountId: string
    categoryId: string | null
    amountPesewas: number
    occurredOn: string
    merchant: string | null
    note: string | null
  }
}>()

const emit = defineEmits<{ saved: [] }>()

type Mode = 'expense' | 'income' | 'transfer'

const editing = computed(() => props.entry !== undefined)

const mode = ref<Mode>(props.entry?.type ?? 'expense')
const amount = ref(props.entry ? pesewasToAmountString(props.entry.amountPesewas) : (props.initialAmount ?? ''))
const accountId = ref(props.entry?.accountId ?? props.accounts[0]?.accountId ?? '')
const toAccountId = ref(props.accounts[1]?.accountId ?? '')
const categoryId = ref(props.entry?.categoryId ?? '')
const occurredOn = ref(props.entry?.occurredOn ?? props.today)
const merchant = ref(props.entry?.merchant ?? '')
const note = ref(props.entry?.note ?? '')

// Changing the date can change the month, which changes every total it was in.
const movesMonth = computed(() =>
  props.entry !== undefined
  && /^\d{4}-\d{2}-\d{2}$/.test(occurredOn.value)
  && occurredOn.value.slice(0, 7) !== props.entry.occurredOn.slice(0, 7)
)

const pending = ref(false)
const error = ref('')
const fields = ref<Record<string, string>>({})

const relevantCategories = computed(() =>
  props.categories.filter(category => category.kind === mode.value)
)

// Switching mode invalidates a category chosen for the other kind — the server
// rejects an expense filed under an income category, so clear it rather than
// let the user submit into a 400.
watch(mode, () => {
  categoryId.value = ''
  fields.value = {}
  error.value = ''
})

const modes: Array<{ value: Mode, label: string, icon: typeof Plus }> = [
  { value: 'expense', label: 'Expense', icon: Minus },
  { value: 'income', label: 'Income', icon: Plus },
  { value: 'transfer', label: 'Transfer', icon: ArrowLeftRight }
]

function reset() {
  amount.value = ''
  merchant.value = ''
  note.value = ''
  categoryId.value = ''
  occurredOn.value = props.today
}

async function submit() {
  error.value = ''
  fields.value = {}
  pending.value = true

  try {
    if (props.entry) {
      await $fetch(`/api/transactions/${props.entry.id}`, {
        method: 'PATCH',
        body: {
          accountId: accountId.value,
          categoryId: categoryId.value || null,
          amount: amount.value,
          occurredOn: occurredOn.value,
          merchant: merchant.value || null,
          note: note.value || null
        }
      })
      emit('saved')
      return
    }

    if (mode.value === 'transfer') {
      await $fetch('/api/transactions/transfer', {
        method: 'POST',
        body: {
          fromAccountId: accountId.value,
          toAccountId: toAccountId.value,
          amount: amount.value,
          occurredOn: occurredOn.value,
          note: note.value || null
        }
      })
    } else {
      await $fetch('/api/transactions', {
        method: 'POST',
        body: {
          type: mode.value,
          accountId: accountId.value,
          categoryId: categoryId.value || null,
          amount: amount.value,
          occurredOn: occurredOn.value,
          merchant: merchant.value || null,
          note: note.value || null
        }
      })
    }

    reset()
    emit('saved')
  } catch (caught) {
    const apiError = toApiError(caught, 'Could not save that')
    error.value = apiError.message
    fields.value = apiError.fields
  } finally {
    pending.value = false
  }
}

const selectClass = 'field-select'
</script>

<template>
  <form class="flex flex-col gap-4" @submit.prevent="submit">
    <!-- Mode -->
    <div v-if="!editing" class="grid grid-cols-3 gap-1 border border-border bg-muted p-1" role="group" aria-label="Transaction type">
      <button
        v-for="option in modes"
        :key="option.value"
        type="button"
        class="flex min-h-10 items-center justify-center gap-1.5 px-2 py-1.5 text-sm font-medium transition-colors"
        :class="mode === option.value
          ? 'bg-background text-foreground'
          : 'text-muted-foreground hover:text-foreground'"
        :aria-pressed="mode === option.value"
        @click="mode = option.value"
      >
        <component :is="option.icon" class="size-4" aria-hidden="true" />
        {{ option.label }}
      </button>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="amount">Amount</Label>
      <Input
        id="amount"
        v-model="amount"
        inputmode="decimal"
        required
        placeholder="0.00"
        class="text-lg tabular-nums"
      />
      <p v-if="fields.amount" class="text-xs text-destructive">{{ fields.amount }}</p>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="accountId">{{ mode === 'transfer' ? 'From account' : 'Account' }}</Label>
      <select id="accountId" v-model="accountId" :class="selectClass" required>
        <option v-for="account in accounts" :key="account.accountId" :value="account.accountId">
          {{ account.name }} · {{ ACCOUNT_TYPE_LABELS[account.type as keyof typeof ACCOUNT_TYPE_LABELS] }}
        </option>
      </select>
    </div>

    <div v-if="mode === 'transfer'" class="flex flex-col gap-2">
      <Label for="toAccountId">To account</Label>
      <select id="toAccountId" v-model="toAccountId" :class="selectClass" required>
        <option v-for="account in accounts" :key="account.accountId" :value="account.accountId">
          {{ account.name }}
        </option>
      </select>
      <p v-if="fields.toAccountId" class="text-xs text-destructive">{{ fields.toAccountId }}</p>
    </div>

    <!-- Transfers carry no category: moving your own money is not spending. -->
    <div v-else class="flex flex-col gap-2">
      <Label for="categoryId">Category</Label>
      <select id="categoryId" v-model="categoryId" :class="selectClass">
        <option value="">Uncategorised</option>
        <option v-for="category in relevantCategories" :key="category.id" :value="category.id">
          {{ category.name }}
        </option>
      </select>
    </div>

    <div class="flex flex-col gap-2">
      <Label for="occurredOn">Date</Label>
      <Input id="occurredOn" v-model="occurredOn" type="date" required />
      <p v-if="fields.occurredOn" class="text-xs text-destructive">{{ fields.occurredOn }}</p>
      <p v-else-if="movesMonth" class="text-xs text-muted-foreground">
        This moves it to {{ formatMonthHeading(occurredOn) }}, and out of
        {{ formatMonthHeading(entry!.occurredOn) }}'s totals and budget.
      </p>
    </div>

    <div v-if="mode !== 'transfer'" class="flex flex-col gap-2">
      <Label for="merchant">Who / where <span class="text-muted-foreground">(optional)</span></Label>
      <Input id="merchant" v-model="merchant" placeholder="e.g. Melcom, Bolt" />
    </div>

    <div class="flex flex-col gap-2">
      <Label for="note">Note <span class="text-muted-foreground">(optional)</span></Label>
      <Input id="note" v-model="note" placeholder="Anything worth remembering" />
    </div>

    <p v-if="error" class="status-strip status-strip-error" role="alert">{{ error }}</p>

    <Button type="submit" :disabled="pending || accounts.length === 0">
      {{ pending ? 'Saving…' : editing ? 'Save changes' : 'Save' }}
    </Button>
  </form>
</template>
