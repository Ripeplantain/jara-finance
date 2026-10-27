<script setup lang="ts">
import { Plus, Search, Wallet } from 'lucide-vue-next'
import { formatPesewas } from '#shared/money/format'
import { PERIOD_KINDS, todayInTimezone } from '#shared/period/month'

useHead({ title: 'Transactions — Jara' })

const { open: openAdd } = useAddTransaction()

// `?amount=` arrives from the Afford screen. Read once rather than watched: it
// seeds the add sheet, it does not own it.
const amountQuery = useRoute().query.amount
const initialAmount = typeof amountQuery === 'string' ? amountQuery : undefined
onMounted(() => {
  if (initialAmount) openAdd({ amount: initialAmount })
})

const period = ref<(typeof PERIOD_KINDS)[number]>('all_time')
const accountFilter = ref('')
const categoryFilter = ref('')
const typeFilter = ref<'' | 'income' | 'expense' | 'transfer'>('')
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
  categoryId: categoryFilter.value || undefined,
  type: typeFilter.value || undefined,
  search: search.value.trim() || undefined
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

/**
 * Rows grouped under their month, in the order the server sent them. Grouping
 * is layout only: each month's In and Out come from the server (below), over the
 * whole month and never from the rows that happen to be loaded.
 */
const groups = computed(() => {
  const out: Array<{ month: string, entries: TransactionRow[] }> = []
  for (const row of rows.value) {
    const month = row.occurredOn.slice(0, 7)
    const last = out[out.length - 1]
    if (last && last.month === month) last.entries.push(row)
    else out.push({ month, entries: [row] })
  }
  return out
})

// In and out per month, for the same period and account as the list. Only
// shown while no search, type or category narrows the rows, because the totals
// would then disagree with what is listed under the heading.
const { data: monthTotals, refresh: refreshMonthTotals } = await useFetch('/api/transactions/month-totals', {
  query: computed(() => ({ period: period.value, accountId: accountFilter.value || undefined }))
})
const totalsByMonth = computed(() => new Map((monthTotals.value?.months ?? []).map(row => [row.month, row])))
const narrowed = computed(() => Boolean(categoryFilter.value || typeFilter.value || search.value.trim()))
const money = (value: number) => formatPesewas(value, { hideZeroDecimals: true })

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

const selected = ref<TransactionRow | null>(null)
const heading = ref<HTMLElement | null>(null)
const deleting = ref(false)
const deleteError = ref('')

const editing = ref(false)

watch(selected, () => {
  deleteError.value = ''
  editing.value = false
})

const { timezone } = useCurrentUser()
const today = computed(() => todayInTimezone(timezone.value))

/**
 * The selected row in the shape the edit form takes, or null when it cannot be
 * edited: a transfer is two linked rows, so it is deleted and re-recorded.
 */
const editable = computed(() => {
  const row = selected.value
  if (!row || row.type === 'transfer') return null
  return {
    id: row.id,
    type: row.type,
    accountId: row.accountId,
    categoryId: row.categoryId,
    amountPesewas: row.amountPesewas,
    occurredOn: row.occurredOn,
    merchant: row.merchant,
    note: row.note
  }
})

async function onEdited() {
  editing.value = false
  selected.value = null
  // The change can move the row to another month, and shifts totals, budgets
  // and balances on other pages, so re-read everything on screen.
  await refreshNuxtData()
  await nextTick()
  heading.value?.focus()
}

const { confirm } = useConfirm()

async function remove(row: TransactionRow) {
  const isTransfer = row.type === 'transfer'
  if (!await confirm({
    title: isTransfer ? 'Delete this transfer?' : 'Delete this transaction?',
    description: isTransfer
      ? 'Both sides of it will be removed, and the balances of both accounts will change.'
      : 'It will be removed from your ledger and your totals. This cannot be undone.',
    confirmLabel: 'Delete',
    tone: 'danger',
    icon: 'trash'
  })) return
  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/transactions/${row.id}`, { method: 'DELETE' })
  } catch {
    deleteError.value = 'Could not delete this transaction. Try again.'
    return
  } finally {
    deleting.value = false
  }
  selected.value = null
  await Promise.all([refreshList(), refreshMonthTotals()])
  // The row that opened the sheet is gone; hand focus back to the page.
  await nextTick()
  heading.value?.focus()
}

const accounts = computed(() => accountData.value?.accounts ?? [])
const categories = computed(() => categoryData.value?.categories ?? [])

const TYPE_FILTERS = [
  { key: '', label: 'All' },
  { key: 'income', label: 'Income' },
  { key: 'expense', label: 'Expenses' },
  { key: 'transfer', label: 'Transfers' }
] as const

const PERIOD_LABELS: Record<string, string> = {
  this_month: 'This month',
  last_month: 'Last month',
  last_30_days: 'Last 30 days',
  this_year: 'This year',
  all_time: 'All time',
  custom: 'Custom'
}

const filtering = computed(() =>
  Boolean(accountFilter.value || categoryFilter.value || typeFilter.value || search.value.trim())
)

function clearFilters() {
  accountFilter.value = ''
  categoryFilter.value = ''
  typeFilter.value = ''
  search.value = ''
}

const facts = computed(() => {
  const row = selected.value
  if (!row) return []
  const out: Array<[string, string]> = [
    ['Type', entryTypeLabel(row)],
    ['Date', formatDayLong(row.occurredOn)]
  ]
  if (row.type === 'transfer') {
    out.push([row.transferDirection === 'in' ? 'Received into' : 'Sent from', row.accountName])
  } else {
    if (row.categoryName) out.push(['Category', row.categoryName])
    out.push(['Account', row.accountName])
    if (row.merchant) out.push(['Who / where', row.merchant])
  }
  out.push(['Note', row.note || 'No note'])
  return out
})
</script>

<template>
  <div>
    <header style="display: flex; justify-content: space-between; align-items: end; gap: 24px; flex-wrap: wrap">
      <div>
        <p class="j-eyebrow">Ledger</p>
        <h1 ref="heading" tabindex="-1" class="j-h1" style="margin-top: 8px; outline: none">Transactions</h1>
      </div>
      <button v-if="accounts.length" type="button" class="j-pill is-quiet" @click="openAdd({ amount: initialAmount })">
        <Plus :size="16" aria-hidden="true" /> Add transaction
      </button>
    </header>

    <p v-if="accountsError" class="status-strip status-strip-error mt-8" role="alert">
      Could not load your accounts.
    </p>

    <div v-if="!accountData && !accountsError" class="mt-10" aria-label="Loading accounts">
      <div class="skeleton-line h-4 w-40" />
      <div class="skeleton-line mt-4 h-10 w-full max-w-md" />
    </div>

    <EmptyState
      v-else-if="accounts.length === 0"
      class="mt-10"
      :icon="Wallet"
      title="You need an account first"
      description="Transactions belong to an account — cash, Mobile Money or a bank. Add one and come back."
    >
      <Button as-child>
        <NuxtLink to="/settings">Add an account</NuxtLink>
      </Button>
    </EmptyState>

    <div v-else>
      <div style="margin-top: 44px">
        <label class="j-search">
          <Search :size="18" aria-hidden="true" />
          <span class="j-sr">Search transactions</span>
          <input v-model="search" type="search" placeholder="Search by name, category or note" autocomplete="off">
        </label>
        <div class="j-filters">
          <div class="j-toggles" role="group" aria-label="Type">
            <button
              v-for="item in TYPE_FILTERS"
              :key="item.key"
              type="button"
              class="j-toggle"
              :aria-pressed="typeFilter === item.key"
              @click="typeFilter = item.key"
            >
              {{ item.label }}
            </button>
          </div>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 0 24px">
            <label>
              <span class="j-sr">Period</span>
              <select v-model="period" class="j-select">
                <option v-for="kind in PERIOD_KINDS.filter(k => k !== 'custom')" :key="kind" :value="kind">
                  {{ PERIOD_LABELS[kind] }}
                </option>
              </select>
            </label>
            <label>
              <span class="j-sr">Account</span>
              <select v-model="accountFilter" class="j-select">
                <option value="">All accounts</option>
                <option v-for="account in accounts" :key="account.accountId" :value="account.accountId">
                  {{ account.name }}
                </option>
              </select>
            </label>
            <label>
              <span class="j-sr">Category</span>
              <select v-model="categoryFilter" class="j-select">
                <option value="">All categories</option>
                <option v-for="category in categories" :key="category.id" :value="category.id">
                  {{ category.name }}
                </option>
              </select>
            </label>
          </div>
        </div>
        <p class="j-sr" aria-live="polite">{{ rows.length }} transactions shown</p>
      </div>

      <div v-if="listStatus === 'pending' && rows.length === 0" class="mt-12" aria-label="Loading transactions">
        <div v-for="index in 5" :key="index" class="flex items-center gap-4 border-t border-border py-4">
          <div class="skeleton-line size-9 shrink-0 !rounded-full" />
          <div class="min-w-0 flex-1">
            <div class="skeleton-line h-3 w-36" />
            <div class="skeleton-line mt-2 h-2.5 w-52 max-w-full" />
          </div>
          <div class="skeleton-line h-4 w-20" />
        </div>
      </div>

      <p v-else-if="listError" class="status-strip status-strip-error mt-10" role="alert">
        Could not load these transactions. Try changing the filters or refreshing.
      </p>

      <div v-else-if="rows.length === 0" class="j-empty">
        <p>{{ filtering ? 'Nothing matches that.' : 'Nothing here yet.' }}</p>
        <p class="j-lede">
          {{ filtering
            ? `Try a different word, or clear the filters. Nothing matches them in ${listData?.period.label}.`
            : `No transactions recorded in ${listData?.period.label}.` }}
        </p>
        <button v-if="filtering" type="button" class="j-link" style="margin-top: 16px" @click="clearFilters">
          Clear search and filters
        </button>
      </div>

      <template v-else>
        <section
          v-for="group in groups"
          :key="group.month"
          class="j-month"
          :aria-labelledby="`tx-month-${group.month}`"
        >
          <div class="j-month-head">
            <h2 :id="`tx-month-${group.month}`" class="j-h2">{{ formatMonthHeading(group.month) }}</h2>
            <p v-if="narrowed" class="j-month-totals">
              {{ group.entries.length }} {{ group.entries.length === 1 ? 'entry' : 'entries' }}
            </p>
            <p v-else-if="totalsByMonth.get(group.month)" class="j-month-totals j-num">
              <span>In <b>+{{ money(totalsByMonth.get(group.month)!.incomePesewas) }}</b></span>
              <span>Out <b>−{{ money(totalsByMonth.get(group.month)!.expensePesewas) }}</b></span>
            </p>
          </div>
          <ul class="j-rows">
            <li v-for="entry in group.entries" :key="entry.id">
              <LedgerRow
                :entry="entry"
                interactive
                :aria-label="entryAriaLabel(entry)"
                @click="selected = entry"
              />
            </li>
          </ul>
        </section>

        <button v-if="cursor" type="button" class="j-link" style="margin-top: 28px" :disabled="loadingMore" @click="loadMore">
          {{ loadingMore ? 'Loading…' : 'Load more' }}
        </button>
      </template>
    </div>

    <SideSheet :open="selected !== null" label="Transaction detail" @close="selected = null">
      <template v-if="selected">
        <p class="j-eyebrow">{{ entryTypeLabel(selected) }}</p>
        <h2 class="j-h2" style="margin-top: 8px; padding-right: 40px">{{ entryTitle(selected) }}</h2>
        <p class="j-sheet-fig j-num" :style="selected.type === 'income' ? 'color: var(--primary)' : ''">
          <MoneyAmount
            size="plain"
            :pesewas="selected.type === 'expense' ? -selected.amountPesewas : selected.amountPesewas"
            :signed="selected.type !== 'transfer'"
          />
        </p>
        <div v-if="editing && editable" style="margin-top: 28px">
          <TransactionForm
            :accounts="accounts"
            :categories="categories"
            :today="today"
            :entry="editable"
            @saved="onEdited"
          />
          <button type="button" class="j-link" style="margin-top: 20px" @click="editing = false">
            Cancel
          </button>
        </div>
        <template v-else>
          <dl class="j-facts">
            <div v-for="fact in facts" :key="fact[0]">
              <dt>{{ fact[0] }}</dt>
              <dd>{{ fact[1] }}</dd>
            </div>
          </dl>
          <p v-if="selected.type === 'transfer'" class="j-small" style="margin-top: 20px">
            Transfers move money you already have. They are never counted as income or spending.
            To change one, delete it and record it again.
          </p>
          <p v-if="deleteError" class="status-strip status-strip-error mt-5" role="alert">{{ deleteError }}</p>
          <div style="display: flex; flex-wrap: wrap; align-items: center; gap: 12px 28px; margin-top: 28px">
            <button v-if="editable" type="button" class="j-pill is-quiet" @click="editing = true">
              Edit
            </button>
            <button
              type="button"
              class="j-link"
              style="color: var(--clay)"
              :disabled="deleting"
              @click="remove(selected)"
            >
              {{ selected.type === 'transfer' ? 'Delete this transfer' : 'Delete this transaction' }}
            </button>
          </div>
        </template>
      </template>
    </SideSheet>
  </div>
</template>
