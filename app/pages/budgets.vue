<script setup lang="ts">
import { Wallet } from 'lucide-vue-next'
import { MoneyError, parseAmountToPesewas, pesewasToCedis } from '#shared/money/pesewas'
import { toApiError } from '~/lib/errors'

useHead({ title: 'Budgets — Jara' })

const {
  data: budget,
  refresh,
  status: budgetStatus,
  error: budgetLoadError
} = await useFetch('/api/budgets')
const { data: categoryData } = await useFetch('/api/categories', {
  query: { kind: 'expense' }
})

const editing = ref(false)
const pending = ref(false)
const error = ref('')
const limitFields = ref<Record<string, string>>({})

/**
 * Limits are edited as a map of `categoryId -> cedi string`, then sent as the
 * complete allocation list.
 *
 * The whole month is replaced on save rather than diffed, which is what makes
 * "remove this cap" just an empty field instead of a delete request.
 */
const draft = ref<Record<string, string>>({})
const note = ref('')

const expenseCategories = computed(() => categoryData.value?.categories ?? [])

function startEditing() {
  draft.value = {}
  error.value = ''
  limitFields.value = {}
  for (const line of budget.value?.lines ?? []) {
    // Rendered as cedis for editing; parsed back to pesewas by the server.
    draft.value[line.categoryId] = String(pesewasToCedis(line.targetPesewas))
  }
  note.value = budget.value?.note ?? ''
  editing.value = true
}

async function save() {
  error.value = ''
  limitFields.value = {}

  const allocations: Array<{ categoryId: string, limit: string }> = []
  const clientFields: Record<string, string> = {}

  for (const [categoryId, rawLimit] of Object.entries(draft.value)) {
    const limit = rawLimit.trim()
    if (limit === '') continue

    try {
      const pesewas = parseAmountToPesewas(limit)
      // Blank and zero both mean “remove this cap” in a complete replacement.
      if (pesewas === 0) continue
      if (pesewas < 0) {
        clientFields[categoryId] = 'Enter a positive limit, or zero to remove it'
        continue
      }
      allocations.push({ categoryId, limit })
    } catch (caught) {
      clientFields[categoryId]
        = caught instanceof MoneyError ? caught.message : 'Enter a valid amount'
    }
  }

  if (Object.keys(clientFields).length > 0) {
    limitFields.value = clientFields
    error.value = 'Check the highlighted limits before saving.'
    return
  }

  pending.value = true
  try {
    await $fetch('/api/budgets', {
      method: 'PUT',
      body: { month: budget.value?.month, note: note.value || null, allocations }
    })
    editing.value = false
    await refresh()
  } catch (caught) {
    const apiError = toApiError(caught, 'Could not save your budget')
    const serverFields: Record<string, string> = {}

    for (const [path, message] of Object.entries(apiError.fields)) {
      const match = /^allocations\.(\d+)\.limit$/.exec(path)
      const allocation = match ? allocations[Number(match[1])] : undefined
      if (allocation) serverFields[allocation.categoryId] = message
    }

    limitFields.value = serverFields
    error.value = apiError.message
  } finally {
    pending.value = false
  }
}

/**
 * A line is "warning" when it has used noticeably more of its budget than the
 * month has used of its days. Comparing against elapsed time is what stops the
 * UI crying wolf on day two.
 */
function isAheadOfPace(percentUsed: number): boolean {
  return percentUsed > (budget.value?.periodElapsedPercent ?? 0) + 20
}
</script>

<template>
  <div>
    <PageHeader
      title="Budgets"
      :description="budget ? `Your plan for ${budget.monthLabel}.` : 'Set monthly spending limits.'"
    >
      <template #actions>
        <Button v-if="!editing" size="sm" :disabled="!budget" @click="startEditing">
          {{ budget?.exists ? 'Edit limits' : 'Set limits' }}
        </Button>
        <template v-else>
          <Button variant="ghost" size="sm" @click="editing = false">Cancel</Button>
          <Button size="sm" :disabled="pending" @click="save">
            {{ pending ? 'Saving…' : 'Save budget' }}
          </Button>
        </template>
      </template>
    </PageHeader>

    <!-- Editor -->
    <Card v-if="editing" class="overflow-hidden">
      <CardHeader>
        <CardTitle>Limits for {{ budget?.monthLabel }}</CardTitle>
        <CardDescription>
          Leave a category blank if you do not want to cap it. Amounts are in cedis.
        </CardDescription>
      </CardHeader>
      <CardContent class="flex flex-col gap-3">
        <div
          v-for="category in expenseCategories"
          :key="category.id"
          class="flex flex-wrap items-center gap-3"
        >
          <Label :for="`limit-${category.id}`" class="min-w-0 flex-1 truncate font-normal">
            {{ category.name }}
          </Label>
          <Input
            :id="`limit-${category.id}`"
            v-model="draft[category.id]"
            inputmode="decimal"
            placeholder="—"
            class="w-28 text-right tabular-nums"
            :aria-invalid="Boolean(limitFields[category.id])"
            :aria-describedby="limitFields[category.id] ? `limit-${category.id}-error` : undefined"
            @input="limitFields[category.id] = ''"
          />
          <p
            v-if="limitFields[category.id]"
            :id="`limit-${category.id}-error`"
            class="basis-full text-right text-xs text-destructive"
          >
            {{ limitFields[category.id] }}
          </p>
        </div>

        <div class="mt-2 flex flex-col gap-2">
          <Label for="note">Note <span class="text-muted-foreground">(optional)</span></Label>
          <Input id="note" v-model="note" placeholder="What this month is about" />
        </div>

        <p v-if="error" class="status-strip status-strip-error" role="alert">{{ error }}</p>
      </CardContent>
    </Card>

    <div v-else-if="budgetStatus === 'pending'" class="flex flex-col gap-4" aria-label="Loading budget">
      <div class="app-panel p-5">
        <div class="skeleton-line h-9 w-48" />
        <div class="skeleton-line mt-5 h-3 w-full" />
      </div>
      <div v-for="index in 4" :key="index" class="app-panel p-4">
        <div class="flex justify-between gap-4">
          <div class="skeleton-line h-3 w-32" />
          <div class="skeleton-line h-3 w-24" />
        </div>
        <div class="skeleton-line mt-4 h-3 w-full" />
      </div>
    </div>

    <p v-else-if="budgetLoadError" class="status-strip status-strip-error" role="alert">
      Could not load this month's budget. Try refreshing the page.
    </p>

    <template v-else-if="budget">
      <EmptyState
        v-if="!budget.exists"
        :icon="Wallet"
        title="No budget for this month yet"
        description="Set a limit on the categories you want to watch. Jara will track what you have actually spent against them, and tell you when you are moving too fast."
      >
        <Button @click="startEditing">Set limits</Button>
      </EmptyState>

      <div v-else class="flex flex-col gap-9">
        <!-- Overall -->
        <section class="app-panel p-4 sm:p-6">
          <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2 border-b-2 border-foreground pb-3">
            <div>
              <MoneyAmount :pesewas="budget.totalSpentPesewas" size="xl" />
              <p class="mt-1 text-sm text-muted-foreground">
                of <MoneyAmount :pesewas="budget.totalLimitPesewas" size="sm" /> budgeted for
                {{ budget.monthLabel }}
              </p>
            </div>
            <p
              class="text-2xl font-semibold tabular-nums"
              :class="budget.overall.isOver ? 'text-expense' : 'text-muted-foreground'"
            >
              {{ Math.round(budget.overall.percentUsed) }}%
            </p>
          </div>

          <div class="mt-4 flex flex-col gap-2">
            <ProgressBar
              :percent="budget.overall.percentForBar"
              :over="budget.overall.isOver"
              :warning="isAheadOfPace(budget.overall.percentUsed)"
              :pace-percent="budget.periodElapsedPercent"
              label="Overall budget used"
            />
            <p class="text-xs text-muted-foreground">
              The standing rule marks how far through the month you are —
              {{ Math.round(budget.periodElapsedPercent) }}% of
              {{ budget.monthLabel }} has passed.
            </p>
          </div>

          <p v-if="budget.note" class="mt-3 text-sm text-muted-foreground">{{ budget.note }}</p>
        </section>

        <!-- Per category -->
        <section class="app-panel p-4 sm:p-5">
          <div class="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <h2 class="text-sm font-semibold">By category</h2>
            <span class="shrink-0 text-xs text-muted-foreground">Worst overspend first</span>
          </div>
          <div class="flex flex-col">
            <div
              v-for="line in budget.lines"
              :key="line.categoryId"
              class="flex flex-col gap-2 border-b border-border py-4"
            >
              <div class="flex items-baseline justify-between gap-3">
                <span class="truncate text-sm font-medium">{{ line.name }}</span>
                <span class="shrink-0 text-sm tabular-nums">
                  <MoneyAmount :pesewas="line.actualPesewas" size="sm" />
                  <span class="text-muted-foreground">
                    / <MoneyAmount :pesewas="line.targetPesewas" size="sm" hide-zero-decimals />
                  </span>
                </span>
              </div>
              <ProgressBar
                :percent="line.percentForBar"
                :over="line.isOver"
                :warning="isAheadOfPace(line.percentUsed)"
                :pace-percent="budget.periodElapsedPercent"
                :label="`${line.name} budget used`"
              />
              <p class="text-xs" :class="line.isOver ? 'text-expense' : 'text-muted-foreground'">
                <template v-if="line.isOver">
                  <MoneyAmount :pesewas="Math.abs(line.remainingPesewas)" size="sm" tone="expense" /> over budget
                </template>
                <template v-else>
                  <MoneyAmount :pesewas="line.remainingPesewas" size="sm" /> left
                  <template v-if="isAheadOfPace(line.percentUsed)">
                    · spending faster than the month is passing
                  </template>
                </template>
              </p>
            </div>
          </div>
        </section>

        <!-- Spending with no cap set -->
        <section v-if="budget.unbudgetedSpend.length > 0" class="app-panel p-4 sm:p-5">
          <div class="flex items-baseline justify-between gap-3 border-b border-border pb-2">
            <h2 class="text-sm font-semibold">Not budgeted</h2>
            <span class="shrink-0 text-xs text-muted-foreground">No limit set</span>
          </div>
          <div class="flex flex-col">
            <div
              v-for="row in budget.unbudgetedSpend"
              :key="row.categoryId ?? 'uncategorised'"
              class="flex items-center justify-between gap-3 border-b border-border py-2.5"
            >
              <span class="truncate text-sm">{{ row.name }}</span>
              <MoneyAmount :pesewas="row.amountPesewas" size="sm" />
            </div>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
