<script setup lang="ts">
import { Plus } from 'lucide-vue-next'

useHead({ title: 'Goals — Jara' })

const {
  data: goalData,
  refresh,
  status: goalsStatus,
  error: goalsLoadError
} = await useFetch('/api/goals')
const { data: accountData } = await useFetch('/api/accounts')

const accounts = computed(() => accountData.value?.accounts ?? [])
const goals = computed(() => goalData.value?.goals ?? [])

// --- Creating a goal -------------------------------------------------------
const creating = ref(false)

// `/goals?new=1` is how Home and Budgets send someone straight to the new-goal
// sheet. Opened after mount (the sheet needs the browser) and then dropped from
// the URL so a refresh or the back button does not reopen it.
const route = useRoute()
const router = useRouter()
onMounted(() => {
  if (route.query.new === '1') {
    creating.value = true
    router.replace({ query: { ...route.query, new: undefined } })
  }
})

async function onCreated() {
  creating.value = false
  await refresh()
}

// --- Contributing ----------------------------------------------------------
const contributingTo = ref<string | null>(null)
const contributingGoal = computed(() =>
  goals.value.find(goal => goal.id === contributingTo.value) ?? null
)

async function onContributed() {
  contributingTo.value = null
  await refresh()
}

const { confirm } = useConfirm()

async function markAchieved(goalId: string, name: string) {
  if (!await confirm({
    title: `Mark ${name} as achieved?`,
    description: 'It will move out of your active goals and stop taking contributions.',
    confirmLabel: 'Mark achieved',
    icon: 'check'
  })) return
  await $fetch(`/api/goals/${goalId}`, { method: 'PATCH', body: { status: 'achieved' } })
  await refresh()
}

function dueLine(goal: { status: string, targetDate: string | null, monthsRemaining: number | null }) {
  if (goal.status !== 'active') return goal.status === 'achieved' ? 'Achieved' : 'Archived'
  if (!goal.targetDate) return 'No target date'
  const months = goal.monthsRemaining === null
    ? ''
    : ` · ${goal.monthsRemaining} month${goal.monthsRemaining === 1 ? '' : 's'} left`
  return `By ${formatDayWithYear(goal.targetDate)}${months}`
}
</script>

<template>
  <div>
    <header class="j-page-head">
      <div>
        <p class="j-eyebrow">Savings</p>
        <h1 class="j-h1" style="margin-top: 8px">Goals</h1>
        <p class="j-lede" style="margin-top: 14px">What you are saving towards, and what is still to find.</p>
      </div>
      <button type="button" class="j-pill is-quiet" @click="creating = true">
        <Plus :size="16" aria-hidden="true" /> New goal
      </button>
    </header>

    <section class="j-section" aria-labelledby="goals-list" style="margin-top: 56px">
      <h2 id="goals-list" class="j-sr">Your goals</h2>

      <div v-if="goalsStatus === 'pending'" aria-label="Loading goals" class="j-goal-list">
        <div v-for="index in 3" :key="index" class="j-goal-row">
          <div class="skeleton-line" style="width: 120px; height: 120px; border-radius: 50%" />
          <div><div class="skeleton-line h-5 w-48" /><div class="skeleton-line mt-4 h-4 w-64" /></div>
        </div>
      </div>

      <p v-else-if="goalsLoadError" class="j-small" role="alert">
        Could not load your savings goals. Try refreshing the page.
      </p>

      <div v-else-if="goals.length === 0" class="j-empty">
        <p>No savings goals yet.</p>
        <p class="j-small">
          A goal gives your spare money a job. Jara works out what you would need to put aside each
          month, and tells you if you fall behind.
        </p>
        <button type="button" class="j-pill" style="margin-top: 24px" @click="creating = true">Create a goal</button>
      </div>

      <ul v-else class="j-goal-list">
        <li v-for="goal in goals" :key="goal.id">
          <article class="j-goal-row">
            <div class="j-ring" role="img" :aria-label="`${goal.name}: ${Math.round(goal.percentForBar)} percent saved`">
              <svg viewBox="0 0 100 100" aria-hidden="true">
                <circle class="bg" cx="50" cy="50" r="44" />
                <circle
                  v-if="goal.percentForBar > 0"
                  class="fg"
                  cx="50"
                  cy="50"
                  r="44"
                  pathLength="100"
                  :stroke-dasharray="`${goal.percentForBar} 100`"
                />
              </svg>
              <span class="pct" aria-hidden="true"><span>{{ Math.round(goal.percentUsed) }}<small>%</small></span></span>
            </div>

            <div class="j-goal-body">
              <div class="j-bud-line">
                <h3 class="j-serif" style="font-size: 1.5rem; font-weight: 450">
                  <NuxtLink :to="`/goals/${goal.id}`" class="j-goal-title">{{ goal.name }}</NuxtLink>
                </h3>
                <span v-if="goal.isBehind" class="j-status is-over">Behind its date</span>
                <span v-else-if="goal.isOver || goal.isExactlyMet" class="j-status is-ok">Funded</span>
              </div>
              <p class="j-small">{{ dueLine(goal) }}</p>

              <p class="j-num" style="margin-top: 14px">
                <MoneyAmount :pesewas="goal.actualPesewas" size="md" class="j-fig-md" style="display: inline" />
                <span class="j-small"> of <MoneyAmount :pesewas="goal.targetPesewas" hide-zero-decimals /></span>
              </p>

              <!--
                The two kinds are shown separately on purpose: money that has
                actually moved and money merely earmarked are different facts, and
                collapsing them would overstate what the user has put aside.
              -->
              <dl v-if="goal.backedPesewas > 0 || goal.trackedPesewas > 0" class="j-goal-facts">
                <div>
                  <dt>Moved to savings</dt>
                  <dd class="j-num"><MoneyAmount :pesewas="goal.backedPesewas" /></dd>
                </div>
                <div>
                  <dt>Planned, not moved</dt>
                  <dd class="j-num"><MoneyAmount :pesewas="goal.trackedPesewas" /></dd>
                </div>
              </dl>

              <p v-if="goal.suggestedMonthlyPesewas" class="j-small" style="margin-top: 14px">
                Put aside about
                <MoneyAmount :pesewas="goal.suggestedMonthlyPesewas" class="text-foreground" />
                a month to finish on time.
              </p>
              <p v-else-if="goal.remainingPesewas > 0 && !goal.targetDate" class="j-small" style="margin-top: 14px">
                <MoneyAmount :pesewas="goal.remainingPesewas" /> to go. Add a target date for a monthly figure.
              </p>

              <div class="j-goal-actions">
                <button
                  v-if="goal.status === 'active'"
                  type="button"
                  class="j-pill is-quiet"
                  @click="contributingTo = goal.id"
                >
                  Add money
                </button>
                <NuxtLink :to="`/goals/${goal.id}`" class="j-link">Details and edit</NuxtLink>
                <button
                  v-if="goal.status === 'active' && goal.remainingPesewas <= 0"
                  type="button"
                  class="j-link"
                  @click="markAchieved(goal.id, goal.name)"
                >
                  Mark achieved
                </button>
              </div>
            </div>
          </article>
        </li>
      </ul>

      <p style="margin-top: 32px">
        <NuxtLink to="/budgets" class="j-link">Back to budgets</NuxtLink>
      </p>
    </section>

    <GoalFormSheet :open="creating" :accounts="accounts" @close="creating = false" @saved="onCreated" />

    <GoalContributionSheet
      :open="contributingTo !== null"
      :goal="contributingGoal"
      :accounts="accounts"
      @close="contributingTo = null"
      @saved="onContributed"
    />
  </div>
</template>
