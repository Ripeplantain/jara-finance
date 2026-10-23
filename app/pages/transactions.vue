<script setup lang="ts">
import { ArrowDownRight, ArrowLeftRight, ArrowUpRight, Trash2, Wallet } from 'lucide-vue-next'
import { PERIOD_KINDS } from '#shared/period/month'

useHead({ title: 'Transactions — Jara' })

// `?amount=` arrives from the Afford screen. Read once rather than watched: it
// seeds the form, it does not own it.
const amountQuery = useRoute().query.amount
const initialAmount = typeof amountQuery === 'string' ? amountQuery : undefined
const recording = ref(Boolean(initialAmount))

const period = ref<(typeof PERIOD_KINDS)[number]>('this_month')
const accountFilter = ref('')
const typeFilter = ref('')
const search = ref('')

const { data: accountData, error: accountsError } = await useFetch('/api/accounts')
const { data: categoryData } = await useFetch('/api/categories')

/**
 * Page one of the list, refetched whenever a filter changes.
 *
 * Later pages are appended to `extraRows` by `loadMore`. The accumulated rows
 * and the cursor are reset together whenever page one changes, so switching a
 * filter can never leave rows from the previous result set on screen or page
 * into a list that no longer matches.
 */
const listQuery = computed(() => ({
  period: period.value,
  accountId: accountFilter.value || undefined,
  type: typeFilter.value || undefined,
  search: search.value || undefined
}))

const {
  data: listData,
  refresh: refreshList,
  status: listStatus,
  error: listError
} = await useFetch('/api/transactions', {
  query: listQuery
})

type TransactionRow = NonNullable<typeof listData.value>['transactions'][number]

const extraRows = ref<TransactionRow[]>([])
const cursor = ref<string | null>(listData.value?.nextCursor ?? null)
const loadingMore = ref(false)

watch(listData, (page) => {
  extraRows.value = []
  cursor.value = page?.nextCursor ?? null
})

const rows = computed<TransactionRow[]>(() => [
  ...(listData.value?.transactions ?? []),
  ...extraRows.value
])

async function loadMore() {
  if (!cursor.value) return
  loadingMore.value = true
  try {
    const page = await $fetch('/api/transactions', {
      query: { ...listQuery.value, cursor: cursor.value }
    })
    extraRows.value.push(...page.transactions)
    cursor.value = page.nextCursor
  } finally {
    loadingMore.value = false
  }
}

async function remove(id: string, isTransfer: boolean) {
  const message = isTransfer
    ? 'Delete this transfer? Both sides of it will be removed.'
    : 'Delete this transaction?'
  if (!confirm(message)) return
  await $fetch(`/api/transactions/${id}`, { method: 'DELETE' })
  await refreshList()
}

async function onSaved() {
  recording.value = false
  await refreshList()
}

const accounts = computed(() => accountData.value?.accounts ?? [])
const categories = computed(() => categoryData.value?.categories ?? [])
// The period's own end date is today for every period containing today, and
// the server resolved it in the user's timezone — so it beats a browser clock.
const today = computed(() => listData.value?.period.end ?? new Date().toISOString().slice(0, 10))

const typeIcons = {
  income: ArrowUpRight,
  expense: ArrowDownRight,
  transfer: ArrowLeftRight
} as const

const PERIOD_LABELS: Record<string, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_30_days: 'Last 30 days',
  this_year: 'This year',
  all_time: 'All time',
  custom: 'Custom'
}

const selectClass = 'field-select !w-auto'
</script>

<template>
  <div>
    <PageHeader title="Transactions" description="A searchable ledger of everything that happened to your money.">
      <template #actions>
        <Button v-if="accounts.length" size="sm" @click="recording = true">Record transaction</Button>
      </template>
    </PageHeader>

    <p v-if="accountsError" class="status-strip status-strip-error mb-5" role="alert">
      Could not load your accounts.
    </p>

    <div v-if="!accountData && !accountsError" class="app-panel p-5" aria-label="Loading accounts">
      <div class="skeleton-line h-4 w-40" />
      <div class="skeleton-line mt-4 h-10 w-full" />
    </div>

    <EmptyState
      v-else-if="accounts.length === 0"
      :icon="Wallet"
      title="You need an account first"
      description="Transactions belong to an account — cash, Mobile Money or a bank. Add one and come back."
    >
      <Button as-child>
        <NuxtLink to="/settings">Add an account</NuxtLink>
      </Button>
    </EmptyState>

    <div v-else class="flex flex-col gap-4">
      <div class="app-toolbar">
        <div class="flex min-w-0 flex-1 flex-wrap gap-2">
          <select v-model="period" :class="selectClass" aria-label="Period">
            <option v-for="kind in PERIOD_KINDS.filter(k => k !== 'custom')" :key="kind" :value="kind">
              {{ PERIOD_LABELS[kind] }}
            </option>
          </select>

          <select v-model="accountFilter" :class="selectClass" aria-label="Account">
            <option value="">All accounts</option>
            <option v-for="account in accounts" :key="account.accountId" :value="account.accountId">
              {{ account.name }}
            </option>
          </select>

          <select v-model="typeFilter" :class="selectClass" aria-label="Type">
            <option value="">All types</option>
            <option value="income">Income</option>
            <option value="expense">Expenses</option>
            <option value="transfer">Transfers</option>
          </select>

          <Input
            v-model="search"
            aria-label="Search notes"
            placeholder="Search notes…"
            class="h-11 w-full sm:ml-auto sm:w-52 md:h-9"
          />
        </div>
      </div>

      <div class="flex items-center justify-between gap-3">
        <p v-if="listData" class="text-xs text-muted-foreground">
          {{ listData.period.label }} · {{ rows.length }} shown
        </p>
        <p class="text-xs text-muted-foreground">Newest first</p>
      </div>

      <div v-if="listStatus === 'pending'" class="app-panel" aria-label="Loading transactions">
        <div v-for="index in 5" :key="index" class="ledger-row flex items-center gap-4">
          <div class="skeleton-line size-10 shrink-0" />
          <div class="min-w-0 flex-1">
            <div class="skeleton-line h-3 w-36" />
            <div class="skeleton-line mt-2 h-2.5 w-52 max-w-full" />
          </div>
          <div class="skeleton-line h-4 w-20" />
        </div>
      </div>

      <p v-else-if="listError" class="status-strip status-strip-error" role="alert">
        Could not load these transactions. Try changing the filters or refreshing.
      </p>

        <div v-else-if="rows.length === 0" class="app-panel px-6 py-12 text-center">
          <p class="text-sm font-medium">Nothing here</p>
          <p class="mt-1 text-sm text-muted-foreground">
            No transactions match these filters in {{ listData?.period.label }}.
          </p>
        </div>

        <ul v-else class="app-panel flex flex-col divide-y divide-border overflow-hidden">
          <li
            v-for="row in rows"
            :key="row.id"
            class="group flex min-h-16 items-center gap-3 px-3 py-3 transition-colors hover:bg-muted/45 sm:px-4"
          >
            <span
              class="grid size-10 shrink-0 place-items-center rounded-xl"
              :class="row.type === 'income'
                ? 'bg-income/12 text-income'
                : row.type === 'expense'
                  ? 'bg-expense/12 text-expense'
                  : 'bg-saving/12 text-saving'"
              aria-hidden="true"
            >
              <component :is="typeIcons[row.type]" class="size-4.5" />
            </span>

            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium">
                {{ row.merchant || row.categoryName || (row.type === 'transfer' ? 'Transfer' : 'Uncategorised') }}
              </p>
              <p class="truncate text-xs text-muted-foreground">
                {{ row.occurredOn }} · {{ row.accountName }}
                <template v-if="row.type === 'transfer'">
                  · {{ row.transferDirection === 'in' ? 'received' : 'sent' }}
                </template>
                <template v-else-if="row.categoryName && row.merchant">· {{ row.categoryName }}</template>
              </p>
            </div>

            <MoneyAmount
              :pesewas="row.type === 'expense' ? -row.amountPesewas : row.amountPesewas"
              :signed="row.type !== 'transfer'"
              :tone="row.type === 'transfer' ? 'neutral' : 'auto'"
              size="sm"
            />

            <Button
              variant="ghost"
              size="icon-sm"
              class="shrink-0 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100 md:focus-visible:opacity-100"
              :aria-label="`Delete transaction of ${row.amountPesewas} pesewas`"
              @click="remove(row.id, row.type === 'transfer')"
            >
              <Trash2 />
            </Button>
          </li>
        </ul>

        <Button
          v-if="cursor"
          variant="outline"
          :disabled="loadingMore"
          @click="loadMore"
        >
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </Button>
    </div>

    <Dialog v-model:open="recording">
      <DialogContent class="max-h-[calc(100dvh-2rem)] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Record something</DialogTitle>
          <DialogDescription>Income, an expense, or money moved between your accounts.</DialogDescription>
        </DialogHeader>
        <TransactionForm
          :accounts="accounts"
          :categories="categories"
          :today="today"
          :initial-amount="initialAmount"
          @saved="onSaved"
        />
      </DialogContent>
    </Dialog>
  </div>
</template>
