<script setup lang="ts">
import { ArrowLeft, ChevronRight, Pencil, Plus, Trash2 } from 'lucide-vue-next'
import { formatPesewas } from '#shared/money/format'
import { toApiError } from '~/lib/errors'

const route = useRoute()
const goalId = computed(() => String(route.params.id))

const {
  data: detail,
  refresh,
  status,
  error: loadError
} = await useFetch(() => `/api/goals/${goalId.value}`)
const { data: accountData } = await useFetch('/api/accounts')
const accounts = computed(() => accountData.value?.accounts ?? [])

const goal = computed(() => detail.value?.goal ?? null)
const entries = computed(() => detail.value?.entries ?? [])
const notFound = computed(() => (loadError.value as { statusCode?: number } | null)?.statusCode === 404)

useHead({ title: computed(() => `${goal.value?.name ?? 'Goal'} — Jara`) })

const money = (value: number) => formatPesewas(value, { hideZeroDecimals: true })
const isActive = computed(() => goal.value?.status === 'active')

const statusLabel = computed(() => {
  if (!goal.value) return ''
  if (goal.value.status === 'achieved') return 'Achieved'
  if (goal.value.status === 'archived') return 'Archived'
  return 'Savings goal'
})

const dueLine = computed(() => {
  const g = goal.value
  if (!g) return ''
  if (!g.targetDate) return 'No target date'
  const months = g.monthsRemaining === null || !isActive.value
    ? ''
    : ` · ${g.monthsRemaining} month${g.monthsRemaining === 1 ? '' : 's'} left`
  return `By ${formatDayWithYear(g.targetDate)}${months}`
})

/** One honest sentence about where the goal stands, from figures the server worked out. */
const standing = computed(() => {
  const g = goal.value
  if (!g) return ''
  if (g.status === 'achieved') return 'You reached this goal.'
  if (g.remainingPesewas <= 0) return 'Fully funded. You can mark it achieved.'
  if (g.isBehind) return `Past its date with ${money(g.remainingPesewas)} still to find.`
  if (g.suggestedMonthlyPesewas && g.targetDate) {
    return `Put aside about ${money(g.suggestedMonthlyPesewas)} a month to finish by ${formatDayWithYear(g.targetDate)}.`
  }
  if (!g.targetDate) return `${money(g.remainingPesewas)} to go. Add a target date for a monthly figure.`
  return `${money(g.remainingPesewas)} to go before the end of the month.`
})

/** Contributions under their month, in the order the server sent them (newest first). */
const groups = computed(() => {
  const out: Array<{ month: string, rows: typeof entries.value }> = []
  for (const entry of entries.value) {
    const month = entry.occurredOn.slice(0, 7)
    const last = out[out.length - 1]
    if (last && last.month === month) last.rows.push(entry)
    else out.push({ month, rows: [entry] })
  }
  return out
})

// --- Sheets ----------------------------------------------------------------
const editingGoal = ref(false)
const addingMoney = ref(false)
const editingEntry = ref<(typeof entries.value)[number] | null>(null)

async function onGoalSaved() {
  editingGoal.value = false
  await refresh()
}

async function onContributionSaved() {
  addingMoney.value = false
  editingEntry.value = null
  // The list of goals and the Budgets page both show these totals.
  await refreshNuxtData()
}

const { confirm } = useConfirm()
async function markAchieved() {
  const g = goal.value
  if (!g) return
  if (!await confirm({
    title: `Mark ${g.name} as achieved?`,
    description: 'It will move out of your active goals and stop taking contributions.',
    confirmLabel: 'Mark achieved',
    icon: 'check'
  })) return
  await $fetch(`/api/goals/${g.id}`, { method: 'PATCH', body: { status: 'achieved' } })
  await refresh()
}

// A goal can only be deleted while nothing has gone into it. The server enforces
// this; the button is hidden here so the user is never offered a dead end.
const canDelete = computed(() => entries.value.length === 0)
const deleting = ref(false)
const deleteError = ref('')

async function deleteGoal() {
  const g = goal.value
  if (!g || deleting.value) return
  if (!await confirm({
    title: `Delete ${g.name}?`,
    description: 'Nothing has gone into it, so no money is affected. This cannot be undone.',
    confirmLabel: 'Delete goal',
    tone: 'danger',
    icon: 'trash'
  })) return
  deleting.value = true
  deleteError.value = ''
  try {
    await $fetch(`/api/goals/${g.id}`, { method: 'DELETE' })
  } catch (caught) {
    // 409 means a contribution arrived since this page loaded.
    deleteError.value = toApiError(caught, 'Could not delete this goal. Try again.').message
    await refresh()
    return
  } finally {
    deleting.value = false
  }
  await refreshNuxtData()
  await navigateTo('/goals')
}
</script>

<template>
  <div class="j-gd">
    <NuxtLink to="/goals" class="j-gd-back">
      <ArrowLeft :size="16" aria-hidden="true" /> All goals
    </NuxtLink>

    <div v-if="status === 'pending' && !detail" aria-label="Loading goal" style="margin-top: 32px">
      <div class="skeleton-line h-4 w-32" />
      <div class="skeleton-line mt-4 h-12 w-80 max-w-full" />
      <div class="skeleton-line mt-10 h-48 w-full" />
    </div>

    <div v-else-if="notFound" class="j-empty" style="margin-top: 32px">
      <p>This goal does not exist.</p>
      <p class="j-small">It may have been removed, or the link is wrong.</p>
      <NuxtLink to="/goals" class="j-pill" style="margin-top: 24px">Back to your goals</NuxtLink>
    </div>

    <p v-else-if="loadError || !goal" class="status-strip status-strip-error" role="alert" style="margin-top: 32px">
      Could not load this goal. Try refreshing the page.
    </p>

    <template v-else>
      <header class="j-gd-head">
        <div>
          <p class="j-eyebrow">{{ statusLabel }} · {{ dueLine }}</p>
          <h1 class="j-h1" style="margin-top: 8px">{{ goal.name }}</h1>
        </div>
        <div class="j-gd-actions">
          <button type="button" class="j-pill is-quiet" @click="editingGoal = true">
            <Pencil :size="15" aria-hidden="true" /> Edit goal
          </button>
          <button v-if="canDelete" type="button" class="j-pill is-quiet" :disabled="deleting" @click="deleteGoal">
            <Trash2 :size="15" aria-hidden="true" /> Delete goal
          </button>
          <button v-if="isActive" type="button" class="j-pill" @click="addingMoney = true">
            <Plus :size="16" aria-hidden="true" /> Add money
          </button>
        </div>
      </header>

      <p v-if="deleteError" class="status-strip status-strip-error" role="alert" style="margin-top: 16px">
        {{ deleteError }}
      </p>

      <section class="j-gd-hero" aria-label="Progress">
        <div
          class="j-ring j-gd-ring"
          role="img"
          :aria-label="`${goal.name}: ${Math.round(goal.percentForBar)} percent saved`"
        >
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

        <div class="j-gd-figures">
          <p class="j-eyebrow">Saved so far</p>
          <p class="j-gd-saved j-num"><MoneyAmount :pesewas="goal.actualPesewas" size="plain" /></p>
          <p class="j-lede" style="margin-top: 6px">
            of <MoneyAmount :pesewas="goal.targetPesewas" hide-zero-decimals /> you are aiming for
          </p>
          <p class="j-gd-standing">{{ standing }}</p>

          <!--
            Kept apart on purpose: money that really moved and money merely
            planned are different facts, and one total would blur them.
          -->
          <dl class="j-goal-facts">
            <div>
              <dt>Moved to savings{{ goal.accountName ? ` · ${goal.accountName}` : '' }}</dt>
              <dd class="j-num"><MoneyAmount :pesewas="goal.backedPesewas" /></dd>
            </div>
            <div>
              <dt>Planned, not moved</dt>
              <dd class="j-num"><MoneyAmount :pesewas="goal.trackedPesewas" /></dd>
            </div>
          </dl>

          <button
            v-if="isActive && goal.remainingPesewas <= 0"
            type="button"
            class="j-link"
            style="margin-top: 18px"
            @click="markAchieved"
          >
            Mark achieved
          </button>
        </div>
      </section>

      <section class="j-section" aria-labelledby="gd-history">
        <div class="j-section-head">
          <h2 id="gd-history" class="j-h2">What has gone in</h2>
          <p v-if="entries.length" class="j-small">Select a row to change or remove it.</p>
        </div>

        <div v-if="entries.length === 0" class="j-empty">
          <p>Nothing has gone into this goal yet.</p>
          <p class="j-small">
            Already have some saved? Add it as a contribution and it counts from today.
          </p>
          <button v-if="isActive" type="button" class="j-pill" style="margin-top: 24px" @click="addingMoney = true">
            Add money
          </button>
        </div>

        <template v-else>
          <div v-for="group in groups" :key="group.month" class="j-gd-month">
            <h3 class="j-eyebrow">{{ formatMonthHeading(group.month) }}</h3>
            <ul class="j-gd-entries">
              <li v-for="entry in group.rows" :key="entry.id">
                <button type="button" class="j-gd-entry" aria-haspopup="dialog" @click="editingEntry = entry">
                  <span class="when">{{ formatDayShort(entry.occurredOn) }}</span>
                  <span class="what">
                    <span class="kind" :class="entry.linkedTransactionId ? 'is-moved' : 'is-planned'">
                      {{ entry.linkedTransactionId ? 'Moved to savings' : 'Planned, not moved' }}
                    </span>
                    <span v-if="entry.note" class="note">{{ entry.note }}</span>
                  </span>
                  <MoneyAmount class="amt" size="plain" :pesewas="entry.amountPesewas" />
                  <ChevronRight :size="16" aria-hidden="true" class="go" />
                </button>
              </li>
            </ul>
          </div>
        </template>
      </section>
    </template>

    <GoalFormSheet
      :open="editingGoal"
      :goal="goal ?? undefined"
      :accounts="accounts"
      @close="editingGoal = false"
      @saved="onGoalSaved"
    />

    <GoalContributionSheet
      :open="addingMoney || editingEntry !== null"
      :goal="goal"
      :accounts="accounts"
      :entry="editingEntry"
      @close="addingMoney = false; editingEntry = null"
      @saved="onContributionSaved"
    />
  </div>
</template>
