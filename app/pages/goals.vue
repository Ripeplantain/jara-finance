<script setup lang="ts">
import { Target } from 'lucide-vue-next'
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

const selectClass = 'field-select'
</script>

<template>
  <div>
    <PageHeader title="Goals" description="What you are saving towards.">
      <template #actions>
        <Button size="sm" @click="creating = !creating">
          {{ creating ? 'Cancel' : 'New goal' }}
        </Button>
      </template>
    </PageHeader>

    <!-- New goal -->
    <Card v-if="creating" class="mb-6 overflow-hidden">
      <CardHeader>
        <CardTitle>New goal</CardTitle>
        <CardDescription>A target, and optionally a date to hit it by.</CardDescription>
      </CardHeader>
      <CardContent>
        <form class="flex flex-col gap-4" @submit.prevent="createGoal">
          <div class="flex flex-col gap-2">
            <Label for="goal-name">What for?</Label>
            <Input id="goal-name" v-model="name" required placeholder="e.g. Laptop, Rent, Emergency fund" />
            <p v-if="createFields.name" class="text-xs text-destructive">{{ createFields.name }}</p>
          </div>

          <div class="grid gap-4 sm:grid-cols-2">
            <div class="flex flex-col gap-2">
              <Label for="goal-target">Target amount</Label>
              <Input id="goal-target" v-model="target" inputmode="decimal" required placeholder="5000" />
              <p v-if="createFields.target" class="text-xs text-destructive">{{ createFields.target }}</p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="goal-date">By when? <span class="text-muted-foreground">(optional)</span></Label>
              <Input id="goal-date" v-model="targetDate" type="date" />
            </div>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="goal-account">Savings account <span class="text-muted-foreground">(optional)</span></Label>
            <select id="goal-account" v-model="accountId" :class="selectClass">
              <option value="">Track only — no account</option>
              <option v-for="account in accounts" :key="account.accountId" :value="account.accountId">
                {{ account.name }}
              </option>
            </select>
            <p class="text-xs text-muted-foreground">
              Pick an account if you want to move real money into this goal. Without one, Jara
              tracks your intent but no balance changes.
            </p>
          </div>

          <p v-if="createError" class="status-strip status-strip-error" role="alert">{{ createError }}</p>

          <Button type="submit" :disabled="creatingPending">
            {{ creatingPending ? 'Creating…' : 'Create goal' }}
          </Button>
        </form>
      </CardContent>
    </Card>

    <div v-if="goalsStatus === 'pending' && !creating" class="app-panel" aria-label="Loading goals">
      <div v-for="index in 3" :key="index" class="ledger-row p-5">
        <div class="flex justify-between gap-4">
          <div class="skeleton-line h-4 w-40" />
          <div class="skeleton-line h-4 w-16" />
        </div>
        <div class="skeleton-line mt-5 h-3 w-full" />
      </div>
    </div>

    <p v-else-if="goalsLoadError && !creating" class="status-strip status-strip-error" role="alert">
      Could not load your savings goals. Try refreshing the page.
    </p>

    <EmptyState
      v-else-if="goals.length === 0 && !creating"
      :icon="Target"
      title="No savings goals yet"
      description="A goal gives your spare money a job. Jara works out what you would need to put aside each month, and tells you if you fall behind."
    >
      <Button @click="creating = true">Create a goal</Button>
    </EmptyState>

    <div v-else-if="goals.length" class="app-panel">
      <article v-for="goal in goals" :key="goal.id" class="border-b border-border last:border-b-0">
        <div class="p-4 pb-3 sm:p-5 sm:pb-3">
          <div class="flex items-start justify-between gap-3">
            <div class="min-w-0">
              <h2 class="truncate text-base font-semibold tracking-tight">{{ goal.name }}</h2>
              <p class="mt-1 text-sm text-muted-foreground">
                <template v-if="goal.status !== 'active'">
                  {{ goal.status === 'achieved' ? 'Achieved' : 'Archived' }}
                </template>
                <template v-else-if="goal.targetDate">
                  By {{ goal.targetDate }}
                  <template v-if="goal.monthsRemaining !== null">
                    · {{ goal.monthsRemaining }} month{{ goal.monthsRemaining === 1 ? '' : 's' }} left
                  </template>
                </template>
                <template v-else>No target date</template>
              </p>
            </div>
            <Badge v-if="goal.isBehind" variant="destructive">Behind</Badge>
            <Badge v-else-if="goal.isOver || goal.isExactlyMet" variant="secondary">Funded</Badge>
          </div>
        </div>

        <div class="grid gap-4 px-4 pb-4 sm:grid-cols-[minmax(0,1fr)_minmax(14rem,0.7fr)] sm:px-5 sm:pb-5">
          <div class="flex flex-col gap-3">
          <div class="flex items-end justify-between gap-3">
            <div>
              <MoneyAmount :pesewas="goal.actualPesewas" size="lg" />
              <p class="mt-0.5 text-sm text-muted-foreground">
                of <MoneyAmount :pesewas="goal.targetPesewas" size="sm" hide-zero-decimals />
              </p>
            </div>
            <p class="text-sm font-medium tabular-nums text-muted-foreground">
              {{ Math.round(goal.percentUsed) }}%
            </p>
          </div>

          <ProgressBar
            :percent="goal.percentForBar"
            tone="saving"
            :label="`${goal.name} progress`"
          />

          <!--
            The two kinds are shown separately on purpose: money that has
            actually moved and money merely earmarked are different facts, and
            collapsing them would overstate what the user has put aside.
          -->
          <dl v-if="goal.backedPesewas > 0 || goal.trackedPesewas > 0" class="flex gap-4 text-xs">
            <div>
              <dt class="text-muted-foreground">Moved to savings</dt>
              <dd><MoneyAmount :pesewas="goal.backedPesewas" size="sm" /></dd>
            </div>
            <div>
              <dt class="text-muted-foreground">Planned, not moved</dt>
              <dd><MoneyAmount :pesewas="goal.trackedPesewas" size="sm" /></dd>
            </div>
          </dl>

          </div>

          <div class="flex flex-col justify-between gap-4 border-t border-border pt-3 sm:border-l sm:border-t-0 sm:pl-5 sm:pt-0">
          <p v-if="goal.suggestedMonthlyPesewas" class="text-sm text-muted-foreground">
            Put aside about
            <MoneyAmount :pesewas="goal.suggestedMonthlyPesewas" size="sm" class="font-medium text-foreground" />
            a month to finish on time.
          </p>
          <p v-else-if="goal.remainingPesewas > 0 && !goal.targetDate" class="text-sm text-muted-foreground">
            <MoneyAmount :pesewas="goal.remainingPesewas" size="sm" /> to go. Add a target date for a monthly figure.
          </p>

        <div class="flex flex-wrap gap-2">
          <Button
            v-if="goal.status === 'active'"
            size="sm"
            variant="outline"
            @click="openContribution(goal.id, goal.accountId)"
          >
            Add money
          </Button>
          <Button
            v-if="goal.status === 'active' && goal.remainingPesewas <= 0"
            size="sm"
            variant="ghost"
            @click="markAchieved(goal.id)"
          >
            Mark achieved
          </Button>
        </div>
        </div>
        </div>
      </article>
    </div>

    <!-- Contribution dialog -->
    <Dialog :open="contributingTo !== null" @update:open="value => !value && (contributingTo = null)">
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add money to this goal</DialogTitle>
          <DialogDescription>
            <template v-if="canBackContribution">
              Either move real money into the goal's savings account, or record that you intend to.
            </template>
            <template v-else>
              A transfer needs a goal account and a different active source account. This contribution will only record your plan.
            </template>
          </DialogDescription>
        </DialogHeader>

        <form class="flex flex-col gap-4" @submit.prevent="contribute">
          <div class="flex flex-col gap-2">
            <Label for="contribution-kind">How?</Label>
            <select id="contribution-kind" v-model="contributionKind" :class="selectClass">
              <option v-if="canBackContribution" value="backed">Move the money now — a real transfer</option>
              <option value="tracked">Just track it — nothing moves yet</option>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="contribution-amount">Amount</Label>
            <Input
              id="contribution-amount"
              v-model="contributionAmount"
              inputmode="decimal"
              required
              placeholder="0.00"
            />
          </div>

          <div v-if="contributionKind === 'backed'" class="flex flex-col gap-2">
            <Label for="contribution-from">From which account?</Label>
            <select id="contribution-from" v-model="contributionFrom" :class="selectClass" required>
              <option
                v-for="account in validContributionSources"
                :key="account.accountId"
                :value="account.accountId"
              >
                {{ account.name }}
              </option>
            </select>
          </div>

          <div class="flex flex-col gap-2">
            <Label for="contribution-date">Date</Label>
            <Input id="contribution-date" v-model="contributionDate" type="date" required />
          </div>

          <p v-if="contributeError" class="status-strip status-strip-error" role="alert">
            {{ contributeError }}
          </p>

          <DialogFooter>
            <Button type="submit" :disabled="contributePending">
              {{ contributePending ? 'Saving…' : 'Add money' }}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  </div>
</template>
