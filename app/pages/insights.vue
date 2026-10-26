<script setup lang="ts">
import type { TrendLine } from '~/components/TrendChart.vue'
import { formatPesewas } from '#shared/money/format'
import { percentageOfPesewas } from '#shared/money/pesewas'

useHead({ title: 'Insights — Jara' })

const { data: monthly, refresh: refreshMonthly } = await useFetch('/api/trends/monthly')
const { data: daily, refresh: refreshDaily } = await useFetch('/api/trends/daily')
const { data: comparison, refresh: refreshComparison } = await useFetch('/api/trends/categories')
const { data: insightData, refresh: refreshInsights } = await useFetch('/api/insights')

type View = 'month' | 'flow' | 'saved'
const views: Array<{ key: View, label: string, blurb: string }> = [
  { key: 'month', label: 'This month', blurb: 'Spending adds up through the month, day by day.' },
  { key: 'flow', label: 'Income and spending', blurb: 'Six months of what came in and what went out.' },
  { key: 'saved', label: 'Saved', blurb: 'What moved into your goals each month.' }
]
const view = ref<View>('month')
const money = (value: number) => formatPesewas(value, { hideZeroDecimals: true })

const months = computed(() => monthly.value?.months ?? [])
const days = computed(() => daily.value?.days ?? [])
const monthName = computed(() => formatMonthName(comparison.value?.current.start ?? daily.value?.month ?? ''))
const previousMonthName = computed(() => formatMonthName(comparison.value?.previous.start ?? ''))

const labels = computed(() => view.value === 'month' ? days.value.map(point => String(point.day)) : months.value.map(point => point.label))
const lines = computed<TrendLine[]>(() => {
  if (view.value === 'month') {
    return [{ key: 'run', label: 'Spent so far', tone: 'accent', fill: true, values: days.value.map(point => point.cumulativePesewas) }]
  }
  if (view.value === 'saved') {
    return [{ key: 'saved', label: 'Moved to goals', tone: 'accent', fill: true, values: months.value.map(point => point.savedPesewas) }]
  }
  return [
    { key: 'income', label: 'Income', tone: 'accent', fill: true, values: months.value.map(point => point.incomePesewas) },
    { key: 'spend', label: 'Spending', tone: 'champagne', values: months.value.map(point => point.expensePesewas) }
  ]
})
const pointCount = computed(() => labels.value.length)
const active = ref<number | null>(null)
watch([view, pointCount], () => { active.value = pointCount.value - 1 }, { immediate: true })

const summary = computed(() => {
  const first = lines.value[0]
  const last = first?.values[first.values.length - 1] ?? 0
  return `${views.find(item => item.key === view.value)!.label} trend chart. The latest value for ${first?.label ?? ''} is ${formatPesewas(last)}.`
})
const pointLabel = (index: number) => view.value === 'month'
  ? `${index + 1} ${monthName.value}`
  : `${months.value[index]?.label ?? ''} ${months.value[index]?.month.slice(0, 4) ?? ''}`

const compare = computed(() => {
  const rows = comparison.value?.rows ?? []
  const top = Math.max(1, ...rows.flatMap(row => [row.currentPesewas, row.previousPesewas]))
  const word = { more: `More than ${previousMonthName.value}`, less: `Less than ${previousMonthName.value}`, same: `Same as ${previousMonthName.value}` }
  return rows.map(row => ({
    row,
    now: `${percentageOfPesewas(row.currentPesewas, top)}%`,
    before: `${percentageOfPesewas(row.previousPesewas, top)}%`,
    words: word[row.direction]
  }))
})

// Severity is the server's; the words are only how it is read aloud on the page.
const toneWord = (severity: string) => severity === 'info' ? 'Noticed' : 'Worth a look'
const destination = (kind: string) =>
  ['goal_off_track', 'budget_overrun', 'savings_rate'].includes(kind) ? '/budgets' : '/transactions'
const actionLabel = (kind: string) =>
  ({ goal_off_track: 'See your goals', budget_overrun: 'Open your budget', savings_rate: 'Open your budget' }[kind] ?? 'See the transactions')

async function dismiss(id: string) {
  await $fetch(`/api/insights/${id}/dismiss`, { method: 'POST' })
  await refreshInsights()
}

onActivated(() => {
  refreshMonthly()
  refreshDaily()
  refreshComparison()
  refreshInsights()
})
</script>

<template>
  <div>
    <header>
      <p class="j-eyebrow">{{ comparison?.current.label }}</p>
      <h1 class="j-h1" style="margin-top: 8px">Insights</h1>
      <p class="j-lede" style="margin-top: 18px">
        A few plain observations from your ledger. They describe what happened. They do not predict what will.
      </p>
    </header>

    <section class="j-section" aria-labelledby="ins-trend">
      <div class="j-section-head">
        <h2 id="ins-trend" class="j-h2">The shape of it</h2>
        <div class="j-toggles" role="group" aria-label="Trend view">
          <button
            v-for="item in views"
            :key="item.key"
            type="button"
            class="j-toggle"
            :aria-pressed="view === item.key"
            @click="view = item.key"
          >
            {{ item.label }}
          </button>
        </div>
      </div>
      <p class="j-small" style="margin: -12px 0 28px">{{ view === 'month' && monthName ? `Spending adds up through ${monthName}, day by day.` : views.find(item => item.key === view)!.blurb }}</p>
      <TrendChart
        v-if="pointCount > 0"
        v-model:active="active"
        :labels="labels"
        :lines="lines"
        :format="money"
        :summary="summary"
        :label-every="view === 'month' ? 5 : 1"
        :point-label="pointLabel"
      />
    </section>

    <section class="j-section" aria-labelledby="ins-compare">
      <div class="j-section-head">
        <h2 id="ins-compare" class="j-h2">{{ monthName }} beside {{ previousMonthName }}</h2>
        <p class="j-small">Lighter bar: {{ previousMonthName }}. Darker bar: {{ monthName }}.</p>
      </div>
      <p v-if="compare.length === 0" class="j-small">No spending recorded in either month yet.</p>
      <ul v-else class="j-compare">
        <li v-for="item in compare" :key="item.row.categoryId ?? 'uncategorised'">
          <CategoryGlyph :icon="item.row.icon" :color-index="item.row.colorIndex" />
          <span style="font-weight: 500">{{ item.row.name }}</span>
          <span class="j-duo" :style="{ '--g': `var(--c${((item.row.colorIndex - 1) % 6) + 1})` }" aria-hidden="true">
            <span class="j-slim slim-prev"><i :style="{ width: item.before }" /></span>
            <span class="j-slim"><i :style="{ width: item.now }" /></span>
          </span>
          <span class="words j-num">
            <span style="display: block; color: var(--foreground); font-weight: 500">{{ money(item.row.currentPesewas) }}</span>
            <span style="display: block">{{ item.words }} ({{ money(item.row.previousPesewas) }})</span>
          </span>
        </li>
      </ul>
    </section>

    <section class="j-section" aria-labelledby="ins-notes">
      <div class="j-section-head">
        <h2 id="ins-notes" class="j-h2">Notes for you</h2>
      </div>
      <p v-if="!insightData?.insights.length" class="j-small">Nothing stands out yet. Notes appear as your ledger fills in.</p>
      <div v-else class="j-notes">
        <article
          v-for="insight in insightData.insights"
          :key="insight.id"
          class="j-note"
          :class="insight.severity === 'info' ? '' : 'is-watch'"
        >
          <p class="j-eyebrow">{{ toneWord(insight.severity) }}</p>
          <h3>{{ insight.title }}</h3>
          <p>{{ insight.body }}</p>
          <div style="display: flex; gap: 24px; flex-wrap: wrap; align-items: baseline">
            <NuxtLink :to="destination(insight.kind)" class="j-link">{{ actionLabel(insight.kind) }} →</NuxtLink>
            <button type="button" class="j-link" style="color: var(--muted-foreground)" :aria-label="`Dismiss: ${insight.title}`" @click="dismiss(insight.id)">Dismiss</button>
          </div>
        </article>
      </div>
    </section>
  </div>
</template>
