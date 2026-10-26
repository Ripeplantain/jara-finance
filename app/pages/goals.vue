<script setup lang="ts">
import { Plus } from 'lucide-vue-next'
import { toApiError } from '~/lib/errors'

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
const name = ref('')
const target = ref('')
const targetDate = ref('')
const accountId = ref('')
const createError = ref('')
const createFields = ref<Record<string, string>>({})
const creatingPending = ref(false)

async function createGoal() {
  createError.value = ''
  createFields.value = {}
  creatingPending.value = true
  try {
    await $fetch('/api/goals', {
      method: 'POST',
      body: {
        name: name.value,
        target: target.value,
        targetDate: targetDate.value || null,
        accountId: accountId.value || null
      }
    })
    name.value = ''
    target.value = ''
    targetDate.value = ''
    accountId.value = ''
    creating.value = false
    await refresh()
  } catch (caught) {
    const apiError = toApiError(caught, 'Could not create that goal')
    createError.value = apiError.message
    createFields.value = apiError.fields
  } finally {
    creatingPending.value = false
  }
}

// --- Contributing ----------------------------------------------------------
const contributingTo = ref<string | null>(null)
const contributionKind = ref<'tracked' | 'backed'>('tracked')
const contributionAmount = ref('')
const contributionFrom = ref('')
const contributionDate = ref('')
const contributeError = ref('')
const contributePending = ref(false)

const contributingGoal = computed(() =>
  goals.value.find(goal => goal.id === contributingTo.value)
)
const validContributionSources = computed(() => {
  const destinationId = contributingGoal.value?.accountId
  if (!destinationId) return []
  return accounts.value.filter(account =>
    !account.isArchived && account.accountId !== destinationId
  )
})
const canBackContribution = computed(() => validContributionSources.value.length > 0)

function openContribution(goalId: string, goalAccountId: string | null) {
  contributingTo.value = goalId
  const source = goalAccountId
    ? accounts.value.find(account =>
        !account.isArchived && account.accountId !== goalAccountId
      )
    : undefined
  // A real transfer needs both the goal's destination account and a different,
  // active source account. Without that complete pair, keep the contribution
  // tracked so the form cannot offer a transfer the server must refuse.
  contributionKind.value = source ? 'backed' : 'tracked'
  contributionAmount.value = ''
  contributionFrom.value = source?.accountId ?? ''
  contributionDate.value = new Date().toISOString().slice(0, 10)
  contributeError.value = ''
}

async function contribute() {
  if (!contributingTo.value) return
  if (
    !canBackContribution.value
    || !validContributionSources.value.some(account => account.accountId === contributionFrom.value)
  ) {
    contributionKind.value = 'tracked'
    contributionFrom.value = ''
  }
  contributeError.value = ''
  contributePending.value = true
  try {
    await $fetch(`/api/goals/${contributingTo.value}/contribute`, {
      method: 'POST',
      body: {
        kind: contributionKind.value,
        amount: contributionAmount.value,
        occurredOn: contributionDate.value,
        fromAccountId: contributionKind.value === 'backed' ? contributionFrom.value : null
      }
    })
    contributingTo.value = null
    await refresh()
  } catch (caught) {
    contributeError.value = toApiError(caught, 'Could not record that').message
  } finally {
    contributePending.value = false
  }
}

async function markAchieved(goalId: string) {
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
                <h3 class="j-serif" style="font-size: 1.5rem; font-weight: 450">{{ goal.name }}</h3>
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
                  @click="openContribution(goal.id, goal.accountId)"
                >
                  Add money
                </button>
                <button
                  v-if="goal.status === 'active' && goal.remainingPesewas <= 0"
                  type="button"
                  class="j-link"
                  @click="markAchieved(goal.id)"
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

    <!-- New goal -->
    <SideSheet :open="creating" label="New goal" @close="creating = false">
      <p class="j-eyebrow">New goal</p>
      <h2 class="j-h2" style="margin: 8px 0 28px">What are you saving for?</h2>
      <form @submit.prevent="createGoal">
        <label class="j-field">
          <span>What for?</span>
          <input id="goal-name" v-model="name" required placeholder="Laptop, rent, emergency fund">
        </label>
        <p v-if="createFields.name" class="j-field-error">{{ createFields.name }}</p>

        <label class="j-field">
          <span>Target amount</span>
          <input id="goal-target" v-model="target" class="big" inputmode="decimal" required placeholder="5,000">
        </label>
        <p v-if="createFields.target" class="j-field-error">{{ createFields.target }}</p>

        <label class="j-field">
          <span>By when? (optional)</span>
          <input id="goal-date" v-model="targetDate" type="date">
        </label>

        <label class="j-field">
          <span>Savings account (optional)</span>
          <select id="goal-account" v-model="accountId">
            <option value="">Track only — no account</option>
            <option v-for="account in accounts" :key="account.accountId" :value="account.accountId">
              {{ account.name }}
            </option>
          </select>
        </label>
        <p class="j-small" style="margin: -8px 0 24px">
          Pick an account if you want to move real money into this goal. Without one, Jara tracks
          your intent but no balance changes.
        </p>

        <p v-if="createError" class="j-field-error" role="alert">{{ createError }}</p>

        <button type="submit" class="j-pill" style="width: 100%" :disabled="creatingPending">
          {{ creatingPending ? 'Creating…' : 'Create goal' }}
        </button>
      </form>
    </SideSheet>

    <!-- Contribution -->
    <SideSheet :open="contributingTo !== null" label="Add money to this goal" @close="contributingTo = null">
      <p class="j-eyebrow">{{ contributingGoal?.name }}</p>
      <h2 class="j-h2" style="margin: 8px 0 12px">Add money to this goal</h2>
      <p class="j-small" style="margin-bottom: 28px">
        <template v-if="canBackContribution">
          Either move real money into the goal's savings account, or record that you intend to.
        </template>
        <template v-else>
          A transfer needs a goal account and a different active source account. This contribution
          will only record your plan.
        </template>
      </p>

      <form @submit.prevent="contribute">
        <label class="j-field">
          <span>How?</span>
          <select id="contribution-kind" v-model="contributionKind">
            <option v-if="canBackContribution" value="backed">Move the money now — a real transfer</option>
            <option value="tracked">Just track it — nothing moves yet</option>
          </select>
        </label>

        <label class="j-field">
          <span>Amount</span>
          <input
            id="contribution-amount"
            v-model="contributionAmount"
            class="big"
            inputmode="decimal"
            required
            placeholder="0.00"
          >
        </label>

        <label v-if="contributionKind === 'backed'" class="j-field">
          <span>From which account?</span>
          <select id="contribution-from" v-model="contributionFrom" required>
            <option
              v-for="account in validContributionSources"
              :key="account.accountId"
              :value="account.accountId"
            >
              {{ account.name }}
            </option>
          </select>
        </label>

        <label class="j-field">
          <span>Date</span>
          <input id="contribution-date" v-model="contributionDate" type="date" required>
        </label>

        <p v-if="contributeError" class="j-field-error" role="alert">{{ contributeError }}</p>

        <button type="submit" class="j-pill" style="width: 100%" :disabled="contributePending">
          {{ contributePending ? 'Saving…' : 'Add money' }}
        </button>
      </form>
    </SideSheet>
  </div>
</template>
