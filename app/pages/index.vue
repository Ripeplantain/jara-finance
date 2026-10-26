<script setup lang="ts">
import type { TrendLine } from '~/components/TrendChart.vue'
import { Plus, Wallet } from 'lucide-vue-next'
import { formatPercentage, formatPesewas } from '#shared/money/format'
import { percentageOfPesewas } from '#shared/money/pesewas'
import type { DashboardRange } from '#shared/schemas/reports'
import { todayInTimezone } from '#shared/period/dates'

useHead({ title: 'Dashboard — Jara' })

const { profile, timezone } = useCurrentUser()
const { open: openAdd } = useAddTransaction()

const ranges: Array<{ key: DashboardRange, label: string }> = [
  { key: 'this_month', label: 'This month' },
  { key: 'last_month', label: 'Last month' },
  { key: 'last_6_months', label: 'Last 6 months' }
]
const range = ref<DashboardRange>('this_month')

const {
  data: dashboard,
  refresh,
  status: dashboardStatus,
  error: dashboardError
} = await useFetch('/api/dashboard', { query: { range } })
const { data: insightData, refresh: refreshInsights } = await useFetch('/api/insights')
// The headroom figure, from the same endpoint the Afford screen and the AI
// coach both use, so the number here cannot disagree with either of them.
const {
  data: headroom,
  refresh: refreshHeadroom,
  error: headroomError
} = await useFetch('/api/affordability')
const { data: monthly, refresh: refreshMonthly } = await useFetch('/api/trends/monthly')
const { data: budget, refresh: refreshBudget } = await useFetch('/api/budgets')
const { data: goalData, refresh: refreshGoals } = await useFetch('/api/goals')
// The newest few rows from the ordinary ledger endpoint, across all time so a
// quiet month still shows what happened last.
const { data: recentData, refresh: refreshRecent } = await useFetch('/api/transactions', {
  query: { period: 'all_time', limit: 6 }
})

const money = (value: number) => formatPesewas(value, { hideZeroDecimals: true })
const today = computed(() => todayInTimezone(timezone.value))

const hasAccounts = computed(() => (dashboard.value?.accounts.length ?? 0) > 0)
/**
 * Whether to show the first-run guidance instead of figures.
 *
 * Deliberately *not* `transactionCount > 0` alone: that count excludes
 * transfers, so a user who has only moved money between their own accounts would
 * be told to record their first transaction while their real balance sat hidden
 * behind the empty state. The guidance is about having nothing to show, and a
 * balance is something to show.
 */
const hasEarnedOrSpent = computed(() => (dashboard.value?.totals.transactionCount ?? 0) > 0)

const recent = computed(() => recentData.value?.transactions ?? [])
const categories = computed(() => {
  const rows = dashboard.value?.spending.categories ?? []
  const top = rows[0]?.amountPesewas || 1
  // Bars are drawn relative to the largest category, not to the total.
  return rows.map(row => ({ ...row, width: `${percentageOfPesewas(row.amountPesewas, top)}%` }))
})

const series = computed(() => monthly.value?.months ?? [])
const active = ref<number | null>(null)
watch([range, series], () => {
  const last = series.value.length - 1
  active.value = range.value === 'this_month' ? last : range.value === 'last_month' ? last - 1 : null
}, { immediate: true })

const chartLabels = computed(() => series.value.map(point => point.label))
const chartLines = computed<TrendLine[]>(() => [
  { key: 'income', label: 'Income', tone: 'accent', fill: true, values: series.value.map(point => point.incomePesewas) },
  { key: 'spend', label: 'Spending', tone: 'champagne', values: series.value.map(point => point.expensePesewas) }
])
const pointLabel = (index: number) => {
  const month = series.value[index]?.month ?? ''
  return `${series.value[index]?.label ?? ''} ${month.slice(0, 4)}`
}
const chartSummary = computed(() => {
  const first = series.value[0]
  const last = series.value[series.value.length - 1]
  if (!first || !last) return 'Income and spending by month.'
  return `Income and spending by month, ${first.label} to ${last.label} ${last.month.slice(0, 4)}. In ${formatMonthName(last.month)} income was ${formatPesewas(last.incomePesewas)} and spending was ${formatPesewas(last.expensePesewas)}. Transfers into goals are not counted as spending.`
})

// The month the figures and the breakdown speak about, named from the server's period.
const monthWord = computed(() => formatMonthName(dashboard.value?.spending.period.start ?? today.value))
const rangeWord = computed(() => range.value === 'last_6_months' ? 'over six months' : `in ${monthWord.value}`)

/** The most severe undismissed insight; the server already orders them. */
const topInsight = computed(() => insightData.value?.insights[0] ?? null)
const INSIGHT_LINKS: Record<string, { to: string, label: string }> = {
  budget_overrun: { to: '/budgets', label: 'Open your budget' },
  goal_off_track: { to: '/budgets', label: 'See your goals' },
  savings_rate: { to: '/budgets', label: 'Open your budget' },
  top_category: { to: '/transactions', label: 'See the transactions' },
  month_over_month: { to: '/transactions', label: 'See the transactions' },
  unusual_expense: { to: '/transactions', label: 'See the transactions' }
}
const insightLink = computed(() =>
  topInsight.value ? (INSIGHT_LINKS[topInsight.value.kind] ?? INSIGHT_LINKS.top_category!) : null
)

const goalCount = computed(() => goalData.value?.goals.filter(goal => goal.status === 'active').length ?? 0)
const budgetMonth = computed(() => formatMonthName(budget.value?.month ?? today.value))
const budgetFill = computed(() => ({
  over: 'is-over', watch: 'is-watch', 'on-track': '', unbudgeted: ''
}[budget.value?.overallStatus ?? 'on-track']))
const goalsPercent = computed(() => {
  const totals = goalData.value?.totals
  return totals ? Math.min(100, percentageOfPesewas(totals.savedPesewas, totals.targetPesewas)) : 0
})

// Re-read everything when the user comes back after recording something elsewhere.
onActivated(() => {
  refresh()
  refreshInsights()
  refreshHeadroom()
  refreshMonthly()
  refreshBudget()
  refreshGoals()
  refreshRecent()
})
</script>

<template>
  <div>
    <section aria-labelledby="home-hero">
      <div class="j-section-head" style="margin-bottom: 8px">
        <p class="j-eyebrow">{{ profile?.displayName }} · {{ formatWeekdayDate(today) }}</p>
        <div class="j-toggles" role="group" aria-label="Date range">
          <button
            v-for="item in ranges"
            :key="item.key"
            type="button"
            class="j-toggle"
            :aria-pressed="range === item.key"
            @click="range = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </div>

      <div v-if="dashboardStatus === 'pending' && !dashboard" aria-label="Loading dashboard">
        <h1 id="home-hero" class="j-eyebrow" style="color: var(--primary)">Available to spend</h1>
        <div class="skeleton-line mt-5 h-20 w-72 max-w-full" />
        <div class="skeleton-line mt-6 h-4 w-full max-w-md" />
      </div>

      <template v-else-if="dashboardError || !dashboard">
        <h1 id="home-hero" class="j-eyebrow" style="color: var(--primary)">Available to spend</h1>
        <p class="status-strip status-strip-error mt-10" role="alert">
          Could not load your money overview. Try refreshing the page.
        </p>
      </template>

      <template v-else-if="!hasAccounts">
        <h1 id="home-hero" class="j-eyebrow" style="color: var(--primary)">Available to spend</h1>
        <EmptyState
          class="mt-10"
          :icon="Wallet"
          title="Add an account to start tracking your money"
          description="Cash, Mobile Money or a bank account — whichever you actually use. You can add more later."
        >
          <Button as-child>
            <NuxtLink to="/settings">Add an account</NuxtLink>
          </Button>
        </EmptyState>
      </template>

      <template v-else>
        <h1 id="home-hero" class="j-eyebrow" style="color: var(--primary)">Available to spend</h1>
        <p v-if="headroomError" class="status-strip status-strip-error mt-8" role="alert">
          Your affordability figure is temporarily unavailable.
        </p>
        <template v-if="headroom">
          <MoneyAmount :pesewas="headroom.availablePesewas" size="display" aria-describedby="home-hero-note" />
          <p id="home-hero-note" class="j-lede">
            What you can spend without breaking a plan you already made:
            <MoneyAmount :pesewas="headroom.liquidPesewas" />
            across {{ dashboard.accounts.length }}
            {{ dashboard.accounts.length === 1 ? 'account' : 'accounts' }}, less what is set
            aside for goals and still budgeted for the month.
          </p>

          <div class="j-stack-gap">
            <FundsMap
              :liquid-pesewas="headroom.liquidPesewas"
              :committed-savings-pesewas="headroom.committedSavingsPesewas"
              :remaining-budgeted-pesewas="headroom.remainingBudgetedPesewas"
              :available-pesewas="headroom.availablePesewas"
            />
          </div>
        </template>
        <p v-if="!hasEarnedOrSpent" class="j-lede" style="margin-top: 32px">
          <strong style="font-weight: 500; color: var(--foreground)">Record some income and expenses.</strong>
          Log what you earn and spend and Jara can show where your money goes, how your
          budget is holding up, and what you can afford.
          <button type="button" class="j-link" @click="openAdd()">Add a transaction</button>
        </p>
      </template>
    </section>

    <template v-if="dashboard && hasAccounts">
      <!-- Deterministic, never model-authored -->
      <section v-if="topInsight" class="j-section" aria-label="What stands out">
        <figure class="j-quote">
          <span class="rule" />
          <blockquote style="margin: 0"><q>{{ topInsight.body }}</q></blockquote>
          <figcaption>
            <NuxtLink v-if="insightLink" :to="insightLink.to" class="j-link">{{ insightLink.label }}</NuxtLink>
          </figcaption>
        </figure>
      </section>

      <section class="j-section" aria-labelledby="home-flow">
        <div class="j-section-head">
          <h2 id="home-flow" class="j-h2">Income and spending</h2>
          <p class="j-small">Transfers into goals are neither.</p>
        </div>
        <dl class="j-figures j-num">
          <div>
            <dt>Income {{ rangeWord }}</dt>
            <dd>{{ money(dashboard.totals.incomePesewas) }}</dd>
          </div>
          <div>
            <dt>Spending {{ rangeWord }}</dt>
            <dd>{{ money(dashboard.totals.expensePesewas) }}</dd>
          </div>
          <div>
            <dt>Moved into goals {{ rangeWord }}</dt>
            <dd>{{ money(dashboard.savedPesewas) }}</dd>
          </div>
        </dl>
        <TrendChart
          v-if="series.length"
          v-model:active="active"
          :labels="chartLabels"
          :lines="chartLines"
          :format="money"
          :point-label="pointLabel"
          :summary="chartSummary"
        />
      </section>

      <section class="j-section" aria-labelledby="home-break">
        <div class="j-section-head">
          <h2 id="home-break" class="j-h2">Where it went in {{ monthWord }}</h2>
          <p v-if="range === 'last_6_months'" class="j-small">Category detail shows the latest month.</p>
        </div>
        <p v-if="categories.length === 0" class="j-small">No spending recorded in {{ monthWord }}.</p>
        <ul v-else class="j-break">
          <li v-for="row in categories" :key="row.categoryId ?? 'uncategorised'">
            <CategoryGlyph :icon="row.icon" :color-index="row.colorIndex" />
            <span style="font-weight: 500">{{ row.name }}</span>
            <span class="j-slim" :style="{ '--g': `var(--c${((row.colorIndex - 1) % 6) + 1})` }" aria-hidden="true">
              <i :style="{ width: row.width }" />
            </span>
            <span class="j-amt">{{ money(row.amountPesewas) }}</span>
          </li>
        </ul>
      </section>

      <section class="j-section" aria-labelledby="home-recent">
        <div class="j-section-head">
          <h2 id="home-recent" class="j-h2">Recent</h2>
          <div style="display: flex; gap: 24px; align-items: baseline; flex-wrap: wrap">
            <button type="button" class="j-link" @click="openAdd()"><Plus :size="14" /> Add transaction</button>
            <NuxtLink to="/transactions" class="j-link">All transactions</NuxtLink>
          </div>
        </div>
        <p v-if="recent.length === 0" class="j-small">Nothing recorded yet.</p>
        <ul v-else class="j-rows">
          <li v-for="entry in recent" :key="entry.id">
            <LedgerRow :entry="entry" />
          </li>
        </ul>
      </section>

      <section class="j-section" aria-labelledby="home-plans">
        <h2 id="home-plans" class="j-sr">Budget and goals</h2>
        <div class="j-plans">
          <div>
            <p class="j-eyebrow">Budget</p>
            <template v-if="budget?.exists">
              <p class="j-sentence">
                You have spent <em class="j-num">{{ money(budget.totalSpentPesewas) }}</em> of the
                <em class="j-num">{{ money(budget.totalLimitPesewas) }}</em> you planned for {{ budgetMonth }}.
              </p>
              <div
                class="j-track"
                role="img"
                :aria-label="`${formatPercentage(budget.overall.percentUsed)} of the budget used, ${formatPercentage(budget.periodElapsedPercent)} of the month gone`"
              >
                <div class="fill" :class="budgetFill" :style="{ width: `${budget.overall.percentForBar}%` }" />
                <div class="tick" :style="{ left: `${budget.periodElapsedPercent}%` }" />
              </div>
              <p class="j-track-cap j-num">
                <span>{{ formatPercentage(budget.overall.percentUsed) }} used</span>
                <span>Month {{ formatPercentage(budget.periodElapsedPercent) }} gone (marker)</span>
              </p>
              <NuxtLink to="/budgets" class="j-link" style="margin-top: 14px">Open budgets</NuxtLink>
            </template>
            <template v-else>
              <p class="j-sentence">You have not planned a budget for {{ budgetMonth }} yet.</p>
              <NuxtLink to="/budgets" class="j-link">Plan a budget</NuxtLink>
            </template>
          </div>
          <div>
            <p class="j-eyebrow">Goals</p>
            <template v-if="goalCount > 0 && goalData">
              <p class="j-sentence">
                {{ countWord(goalCount) }} {{ goalCount === 1 ? 'goal holds' : 'goals hold' }}
                <em class="j-num">{{ money(goalData.totals.savedPesewas) }}</em> of the
                <em class="j-num">{{ money(goalData.totals.targetPesewas) }}</em> you are aiming for.
              </p>
              <div class="j-track" role="img" :aria-label="`${money(goalData.totals.savedPesewas)} saved of ${money(goalData.totals.targetPesewas)}`">
                <div class="fill" :style="{ width: `${goalsPercent}%` }" />
              </div>
              <p class="j-track-cap j-num">
                <span>Saved</span><span>Target {{ money(goalData.totals.targetPesewas) }}</span>
              </p>
              <NuxtLink to="/budgets" class="j-link" style="margin-top: 14px">See each goal</NuxtLink>
            </template>
            <template v-else>
              <p class="j-sentence">You have not set a savings goal yet.</p>
              <NuxtLink to="/budgets" class="j-link">Set a goal</NuxtLink>
            </template>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
