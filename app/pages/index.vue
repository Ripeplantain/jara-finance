<script setup lang="ts">
import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  Info,
  OctagonAlert,
  PlusCircle,
  TriangleAlert,
  Wallet,
  X
} from 'lucide-vue-next'

useHead({ title: 'Dashboard — Jara' })

const { profile } = useCurrentUser()

const {
  data: dashboard,
  refresh,
  status: dashboardStatus,
  error: dashboardError
} = await useFetch('/api/dashboard')
const { data: insightData, refresh: refreshInsights } = await useFetch('/api/insights')
// The headroom figure, from the same endpoint the Afford screen and the AI
// coach both use — so the number here cannot disagree with either of them.
const {
  data: headroom,
  refresh: refreshHeadroom,
  error: headroomError
} = await useFetch('/api/affordability')

const hasAccounts = computed(() => (dashboard.value?.accounts.length ?? 0) > 0)

/**
 * Whether to show the first-run guidance instead of figures.
 *
 * Deliberately *not* `transactionCount > 0`: that count excludes transfers, so
 * a user who has only moved money between their own accounts would be told to
 * record their first transaction while their real balance sat hidden behind the
 * empty state. The guidance is about having nothing to show, and a balance is
 * something to show.
 */
const hasEarnedOrSpent = computed(() => (dashboard.value?.totals.transactionCount ?? 0) > 0)

/*
  Three severities, three different *shapes* as well as three colours — an
  octagon, a triangle and a circle. The previous pair used two lucide aliases
  for the same triangle, so critical and warning were told apart by hue alone.
*/
const severityStyles = {
  critical: { icon: OctagonAlert, class: 'text-expense' },
  warning: { icon: TriangleAlert, class: 'text-warning' },
  info: { icon: Info, class: 'text-muted-foreground' }
} as const

async function dismiss(id: string) {
  await $fetch(`/api/insights/${id}/dismiss`, { method: 'POST' })
  await refreshInsights()
}

// Re-read all three when the user comes back after recording something elsewhere.
onActivated(() => {
  refresh()
  refreshInsights()
  refreshHeadroom()
})
</script>

<template>
  <div>
    <PageHeader
      :title="profile ? `Hello, ${profile.displayName}` : 'Dashboard'"
      :description="dashboard ? `Your money in ${dashboard.totals.period.label}.` : 'Your money at a glance.'"
    >
      <template #actions>
        <Button as-child size="sm">
          <NuxtLink to="/transactions">
            <PlusCircle />
            Record something
          </NuxtLink>
        </Button>
      </template>
    </PageHeader>

    <div v-if="dashboardStatus === 'pending'" class="grid gap-4 lg:grid-cols-3" aria-label="Loading dashboard">
      <div v-for="index in 3" :key="index" class="app-panel p-5">
        <div class="skeleton-line h-3 w-24" />
        <div class="skeleton-line mt-6 h-8 w-36" />
      </div>
    </div>

    <p v-else-if="dashboardError" class="status-strip status-strip-error" role="alert">
      Could not load your money overview. Try refreshing the page.
    </p>

    <EmptyState
      v-else-if="!hasAccounts"
      :icon="Wallet"
      title="Add an account to start tracking your money"
      description="Cash, Mobile Money or a bank account — whichever you actually use. You can add more later."
    >
      <Button as-child>
        <NuxtLink to="/settings">Add an account</NuxtLink>
      </Button>
    </EmptyState>

    <div v-else-if="dashboard" class="flex flex-col gap-9">
      <div
        v-if="!hasEarnedOrSpent"
        class="flex flex-wrap items-center justify-between gap-3 border border-dashed border-input bg-card px-4 py-3.5"
      >
        <div>
          <p class="text-sm font-medium">Record some income and expenses</p>
          <p class="mt-0.5 text-sm text-muted-foreground">
            Your balances are below. Log what you earn and spend and Jara can show where your
            money goes, how your budget is holding up, and what you can afford.
          </p>
        </div>
        <Button as-child size="sm">
          <NuxtLink to="/transactions">Add a transaction</NuxtLink>
        </Button>
      </div>

      <!--
        The headroom answer leads, ahead of the balance — the balance is the
        figure that misleads and available is the figure that decides. Drawn in
        the app's own grammar, as the same field of cells the Afford screen
        uses, so the landing screen speaks the language the product is built in.
      -->
      <p v-if="headroomError" class="status-strip status-strip-error" role="alert">
        Your affordability figure is temporarily unavailable.
      </p>

      <section v-if="headroom" class="app-panel p-4 sm:p-6">
        <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b-2 border-foreground pb-2">
          <h2 class="text-sm font-semibold">Yours to spend right now</h2>
          <NuxtLink
            to="/afford"
            class="group flex items-center gap-1.5 text-sm font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          >
            Can I afford something?
            <ArrowRight
              class="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none"
              aria-hidden="true"
            />
          </NuxtLink>
        </div>

        <div class="mt-5 grid gap-7 lg:grid-cols-5 lg:gap-10">
          <div class="lg:col-span-2">
            <MoneyAmount :pesewas="headroom.availablePesewas" size="xl" />
            <p class="mt-2 max-w-xs text-xs leading-relaxed text-muted-foreground">
              After money promised to goals, and money budgeted for this month but
              not yet spent.
            </p>

            <!-- What the cells beside this mean. Reading the field is the whole
                 point of showing it. -->
            <dl class="mt-5 flex flex-col gap-2 text-xs">
              <div class="flex items-center gap-2.5">
                <span class="size-3 shrink-0 border border-expense bg-expense" aria-hidden="true" />
                <dt class="text-muted-foreground">Promised to goals</dt>
                <dd class="ml-auto">
                  <MoneyAmount :pesewas="headroom.committedSavingsPesewas" size="sm" />
                </dd>
              </div>
              <div class="flex items-center gap-2.5">
                <span class="cell-hatched size-3 shrink-0 border border-primary" aria-hidden="true" />
                <dt class="text-muted-foreground">Budgeted, not yet spent</dt>
                <dd class="ml-auto">
                  <MoneyAmount :pesewas="headroom.remainingBudgetedPesewas" size="sm" />
                </dd>
              </div>
              <div class="flex items-center gap-2.5">
                <span
                  class="size-3 shrink-0 border border-input bg-card dark:bg-background"
                  aria-hidden="true"
                />
                <dt class="text-muted-foreground">Yours</dt>
                <dd class="ml-auto">
                  <MoneyAmount :pesewas="headroom.availablePesewas" size="sm" />
                </dd>
              </div>
            </dl>
          </div>
          <TallyField
            class="lg:col-span-3"
            :liquid-pesewas="headroom.liquidPesewas"
            :committed-savings-pesewas="headroom.committedSavingsPesewas"
            :remaining-budgeted-pesewas="headroom.remainingBudgetedPesewas"
          />
        </div>
      </section>

      <!-- The period's figures, as one ledger that adds up -->
      <section>
        <SectionHeader title="Monthly position" :meta="dashboard.totals.period.label" />
        <div class="app-panel mt-3 grid sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Total balance" :icon="Wallet" hint="Across all your accounts">
            <MoneyAmount :pesewas="dashboard.liquidPesewas" size="lg" />
          </StatTile>

          <StatTile label="Money in" :icon="ArrowUpRight">
            <MoneyAmount :pesewas="dashboard.totals.incomePesewas" size="lg" tone="income" />
          </StatTile>

          <StatTile label="Money out" :icon="ArrowDownRight">
            <MoneyAmount :pesewas="dashboard.totals.expensePesewas" size="lg" tone="expense" />
          </StatTile>

          <StatTile
            label="Kept this month"
            :hint="dashboard.totals.incomePesewas > 0
              ? `${Math.round(dashboard.totals.savingsRatePercent)}% of what you earned`
              : 'No income recorded yet'"
          >
            <MoneyAmount :pesewas="dashboard.totals.netPesewas" size="lg" signed tone="auto" />
          </StatTile>
        </div>
      </section>

      <!-- Insights: deterministic, never model-authored -->
      <section v-if="insightData?.insights.length">
        <SectionHeader title="What stands out" description="Signals from your recent money activity." />
        <div class="app-panel mt-3">
        <div
          v-for="insight in insightData.insights"
          :key="insight.id"
          class="ledger-row flex items-start gap-3"
        >
          <component
            :is="severityStyles[insight.severity].icon"
            class="mt-0.5 size-4 shrink-0"
            :class="severityStyles[insight.severity].class"
            aria-hidden="true"
          />
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium">{{ insight.title }}</p>
            <p class="mt-0.5 text-sm leading-relaxed text-muted-foreground">{{ insight.body }}</p>
          </div>
          <Button
            variant="ghost"
            size="icon-sm"
            :aria-label="`Dismiss: ${insight.title}`"
            @click="dismiss(insight.id)"
          >
            <X />
          </Button>
        </div>
        </div>
      </section>

      <div class="grid gap-9 lg:grid-cols-5 lg:gap-10">
        <!-- Spending breakdown -->
        <section class="app-panel p-4 sm:p-5 lg:col-span-3">
          <div class="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <h2 class="text-sm font-semibold">Where your money went</h2>
            <span class="shrink-0 text-xs text-muted-foreground">{{ dashboard.spending.period.label }}</span>
          </div>

          <p
            v-if="dashboard.spending.categories.length === 0"
            class="py-10 text-center text-sm text-muted-foreground"
          >
            No spending recorded in {{ dashboard.spending.period.label }}.
          </p>
          <template v-else>
            <SpendingDonut
              :categories="dashboard.spending.categories"
              :currency="dashboard.currency"
            />
            <ul class="flex flex-col">
              <li
                v-for="category in dashboard.spending.categories.slice(0, 6)"
                :key="category.categoryId ?? 'uncategorised'"
                class="flex items-center justify-between gap-3 border-b border-border py-2.5"
              >
                <span class="flex min-w-0 items-center gap-2.5">
                  <span
                    class="size-2.5 shrink-0"
                    :style="{ background: `var(--chart-${((category.colorIndex - 1) % 6) + 1})` }"
                    aria-hidden="true"
                  />
                  <span class="truncate text-sm">{{ category.name }}</span>
                </span>
                <span class="flex shrink-0 items-center gap-3">
                  <span class="text-xs text-muted-foreground tabular-nums">
                    {{ Math.round(category.percentOfTotal) }}%
                  </span>
                  <MoneyAmount :pesewas="category.amountPesewas" size="sm" />
                </span>
              </li>
            </ul>
          </template>
        </section>

        <!-- Accounts -->
        <section class="app-panel p-4 sm:p-5 lg:col-span-2">
          <div class="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <h2 class="text-sm font-semibold">Accounts</h2>
            <span class="shrink-0 text-xs text-muted-foreground">From your ledger</span>
          </div>
          <ul class="flex flex-col">
            <li
              v-for="account in dashboard.accounts"
              :key="account.accountId"
              class="flex items-center justify-between gap-3 border-b border-border py-2.5"
            >
              <div class="min-w-0">
                <p class="truncate text-sm font-medium">{{ account.name }}</p>
                <p v-if="account.institution" class="truncate text-xs text-muted-foreground">
                  {{ account.institution }}
                </p>
              </div>
              <MoneyAmount
                :pesewas="account.balancePesewas"
                size="sm"
                :tone="account.balancePesewas < 0 ? 'expense' : 'neutral'"
              />
            </li>
          </ul>
        </section>
      </div>
    </div>
  </div>
</template>
