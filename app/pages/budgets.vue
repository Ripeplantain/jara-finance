<script setup lang="ts">
import { Minus, Plus, Wallet } from 'lucide-vue-next'
import { formatPercentage } from '#shared/money/format'
import {
  addPesewas,
  MoneyError,
  parseAmountToPesewas,
  pesewasToCedis,
  subtractPesewas
} from '#shared/money/pesewas'
import { toApiError } from '~/lib/errors'

useHead({ title: 'Budgets — Jara' })

const {
  data: budget,
  refresh,
  status: budgetStatus,
  error: budgetLoadError
} = await useFetch('/api/budgets')
const { data: goalData, error: goalLoadError } = await useFetch('/api/goals')
const { data: categoryData } = await useFetch('/api/categories', {
  query: { kind: 'expense' }
})

const editing = ref(false)
/** The category the person chose, so its field is the one focused on open. */
const focusId = ref<string | null>(null)
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

function startEditing(categoryId: string | null = null) {
  focusId.value = categoryId ?? expenseCategories.value[0]?.id ?? null
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
    openId.value = null
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
 * Status is decided on the server (`deriveBudgetPaceStatus`); the page only
 * chooses words for it. The wording stays calm on purpose, and the track's
 * colour is never the only signal.
 */
const STATUS_WORDS = {
  'on-track': 'Comfortably within',
  watch: 'Nearly there',
  over: 'Past the limit',
  unbudgeted: 'No limit set'
} as const

const STATUS_CLASS = {
  'on-track': 'is-ok',
  watch: 'is-watch',
  over: 'is-over',
  unbudgeted: ''
} as const

// ── Stepper: adjust one category's limit, then save through the same PUT ──
const STEP_PESEWAS = 5000 // GH₵50
const openId = ref<string | null>(null)
/** Limits being adjusted, in pesewas, by category. Absent = untouched. */
const stepped = ref<Record<string, number>>({})
const stepError = ref('')
const stepPending = ref(false)

function toggle(categoryId: string) {
  openId.value = openId.value === categoryId ? null : categoryId
  stepError.value = ''
}

function limitFor(line: { categoryId: string, targetPesewas: number }): number {
  return stepped.value[line.categoryId] ?? line.targetPesewas
}

function nudge(line: { categoryId: string, targetPesewas: number }, direction: 1 | -1) {
  const next = direction === 1
    ? addPesewas(limitFor(line), STEP_PESEWAS)
    : subtractPesewas(limitFor(line), STEP_PESEWAS)
  stepped.value = { ...stepped.value, [line.categoryId]: Math.max(STEP_PESEWAS, next) }
}

function isChanged(line: { categoryId: string, targetPesewas: number }): boolean {
  return limitFor(line) !== line.targetPesewas
}

async function saveStepped(categoryId: string) {
  stepError.value = ''
  stepPending.value = true
  try {
    // The month is replaced wholesale, so every existing limit goes back with
    // the one that changed.
    const allocations = (budget.value?.lines ?? []).map(line => ({
      categoryId: line.categoryId,
      limit: String(pesewasToCedis(
        line.categoryId === categoryId ? limitFor(line) : line.targetPesewas
      ))
    }))
    await $fetch('/api/budgets', {
      method: 'PUT',
      body: { month: budget.value?.month, note: budget.value?.note ?? null, allocations }
    })
    stepped.value = {}
    openId.value = null
    await refresh()
  } catch (caught) {
    stepError.value = toApiError(caught, 'Could not save your budget').message
  } finally {
    stepPending.value = false
  }
}

// ── Goals ──
const goals = computed(() => (goalData.value?.goals ?? []).filter(goal => goal.status !== 'archived'))
</script>

<template>
  <div class="v1">
    <div v-if="budgetStatus === 'pending'" aria-label="Loading budget">
      <div class="skeleton-line h-4 w-24" />
      <div class="skeleton-line mt-4 h-10 w-72" />
      <div class="skeleton-line mt-8 h-1.5 w-full max-w-[560px]" />
      <div v-for="index in 4" :key="index" class="mt-10">
        <div class="skeleton-line h-4 w-40" />
        <div class="skeleton-line mt-4 h-1.5 w-full" />
      </div>
    </div>

    <p v-else-if="budgetLoadError" class="status-strip status-strip-error" role="alert">
      Could not load this month's budget. Try refreshing the page.
    </p>

    <template v-else-if="budget">
      <header>
        <p class="v1-eyebrow">{{ budget.monthLabel }}</p>
        <h1 class="v1-h1" style="margin-top: 8px">Budgets and goals</h1>

        <EmptyState
          v-if="!budget.exists"
          class="mt-8"
          :icon="Wallet"
          title="No budget for this month yet"
          description="Set a limit on the categories you want to watch. Jara will track what you have actually spent against them, and tell you when you are moving too fast."
        >
          <button type="button" class="v1-pill" @click="startEditing()">Set limits</button>
        </EmptyState>

        <template v-else>
          <p class="v1-sentence" style="max-width: 36ch; margin-top: 28px">
            <em class="v1-num"><MoneyAmount :pesewas="budget.totalSpentPesewas" hide-zero-decimals /></em> spent of
            <em class="v1-num"><MoneyAmount :pesewas="budget.totalLimitPesewas" hide-zero-decimals /></em> planned, with
            {{ formatPercentage(budget.periodElapsedPercent) }} of the month gone.
          </p>
          <BudgetTrack
            style="max-width: 560px"
            :percent="budget.overall.percentForBar"
            :pace-percent="budget.periodElapsedPercent"
            status="on-track"
            :label="`${formatPercentage(budget.overall.percentUsed)} of the month's plan used, ${formatPercentage(budget.periodElapsedPercent)} of the month elapsed`"
          />
          <p class="v1-track-cap v1-num" style="max-width: 560px">
            <span v-if="budget.overall.isOver">
              <MoneyAmount :pesewas="Math.abs(budget.overall.remainingPesewas)" hide-zero-decimals /> over in total
            </span>
            <span v-else>
              <MoneyAmount :pesewas="budget.overall.remainingPesewas" hide-zero-decimals /> left in total
            </span>
            <span>Marker: where the month is today</span>
          </p>
          <p v-if="budget.note" class="v1-small" style="margin-top: 14px; max-width: 56ch">{{ budget.note }}</p>
        </template>
      </header>

      <section v-if="budget.exists" class="v1-section" aria-labelledby="v1-cats">
        <div class="v1-section-head">
          <h2 id="v1-cats" class="v1-h2">By category</h2>
          <p class="v1-small">
            Choose a category to adjust its limit.
            <button type="button" class="v1-link" @click="startEditing()">Edit all limits</button>
          </p>
        </div>
        <ul>
          <li v-for="line in budget.lines" :key="line.categoryId" class="v1-bud">
            <button
              type="button"
              class="v1-bud-btn"
              :aria-expanded="openId === line.categoryId"
              :aria-controls="`adj-${line.categoryId}`"
              @click="toggle(line.categoryId)"
            >
              <CategoryGlyph :icon="line.icon" :color-index="line.colorIndex" />
              <span>
                <span class="v1-bud-line">
                  <span class="n">{{ line.name }}</span>
                  <span class="v1-status" :class="STATUS_CLASS[line.status]">{{ STATUS_WORDS[line.status] }}</span>
                </span>
                <BudgetTrack
                  class="v1-bud-track"
                  :percent="line.percentForBar"
                  :pace-percent="budget.periodElapsedPercent"
                  :status="line.status"
                />
                <span class="v1-track-cap v1-num" style="margin-top: 0">
                  <span>
                    <MoneyAmount :pesewas="line.actualPesewas" hide-zero-decimals /> of
                    <MoneyAmount :pesewas="line.targetPesewas" hide-zero-decimals />
                  </span>
                  <span v-if="line.isOver">
                    <MoneyAmount :pesewas="Math.abs(line.remainingPesewas)" hide-zero-decimals /> over
                  </span>
                  <span v-else>
                    <MoneyAmount :pesewas="line.remainingPesewas" hide-zero-decimals /> left
                  </span>
                </span>
              </span>
            </button>
            <div
              v-if="openId === line.categoryId"
              :id="`adj-${line.categoryId}`"
              class="v1-adjust"
              role="group"
              :aria-label="`Adjust ${line.name} limit`"
            >
              <p class="v1-small" style="max-width: 34ch">
                {{ formatPercentage(line.percentUsed) }} used, {{ formatPercentage(budget.periodElapsedPercent) }} of the month gone.
                <template v-if="isChanged(line)"> Save to apply the new limit.</template>
              </p>
              <div class="v1-stepper">
                <button type="button" aria-label="Lower the limit by GH₵50" @click="nudge(line, -1)">
                  <Minus :size="18" />
                </button>
                <output class="v1-num" aria-live="polite">
                  <MoneyAmount :pesewas="limitFor(line)" hide-zero-decimals />
                </output>
                <button type="button" aria-label="Raise the limit by GH₵50" @click="nudge(line, 1)">
                  <Plus :size="18" />
                </button>
              </div>
              <button
                v-if="isChanged(line)"
                type="button"
                class="v1-pill"
                :disabled="stepPending"
                @click="saveStepped(line.categoryId)"
              >
                {{ stepPending ? 'Saving…' : 'Save limit' }}
              </button>
              <p v-if="stepError" class="status-strip status-strip-error" style="flex-basis: 100%" role="alert">{{ stepError }}</p>
            </div>
          </li>
        </ul>
      </section>

      <section v-if="budget.exists && budget.unbudgetedSpend.length > 0" class="v1-section" aria-labelledby="v1-unbudgeted">
        <div class="v1-section-head">
          <h2 id="v1-unbudgeted" class="v1-h2">Not budgeted</h2>
          <p class="v1-small">Spending with no limit set. Use “Edit all limits” to cap it.</p>
        </div>
        <ul>
          <li v-for="row in budget.unbudgetedSpend" :key="row.categoryId ?? 'uncategorised'" class="v1-bud v1-plain">
            <CategoryGlyph :icon="row.icon" :color-index="row.colorIndex" />
            <span class="n">{{ row.name }}</span>
            <MoneyAmount class="v1-num" :pesewas="row.amountPesewas" hide-zero-decimals />
          </li>
        </ul>
      </section>

      <section class="v1-section" aria-labelledby="v1-goals">
        <div class="v1-section-head">
          <h2 id="v1-goals" class="v1-h2">Savings goals</h2>
          <p v-if="goals.length > 0 && goalData?.totals" class="v1-small v1-num">
            <MoneyAmount :pesewas="goalData.totals.savedPesewas" hide-zero-decimals /> saved of
            <MoneyAmount :pesewas="goalData.totals.targetPesewas" hide-zero-decimals />
          </p>
        </div>
        <p v-if="goalLoadError" class="status-strip status-strip-error" role="alert">
          Could not load your goals. Try refreshing the page.
        </p>
        <p v-else-if="goals.length === 0" class="v1-small">
          No savings goals yet.
          <NuxtLink to="/goals" class="v1-link">Add a goal</NuxtLink>
        </p>
        <ul v-else class="v1-goals">
          <li v-for="goal in goals" :key="goal.id" class="v1-goal">
            <div class="v1-ring" role="img" :aria-label="`${goal.name}: ${Math.round(goal.percentForBar)} percent saved`">
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
              <span class="pct" aria-hidden="true"><span>{{ Math.round(goal.percentForBar) }}<small>%</small></span></span>
            </div>
            <h3 class="v1-serif" style="font-size: 1.3rem; font-weight: 450">{{ goal.name }}</h3>
            <p class="v1-num">
              <b style="font-weight: 500"><MoneyAmount :pesewas="goal.actualPesewas" hide-zero-decimals /></b>
              <span class="v1-small"> of <MoneyAmount :pesewas="goal.targetPesewas" hide-zero-decimals /></span>
            </p>
            <p v-if="goal.remainingPesewas > 0" class="v1-small v1-num">
              <MoneyAmount :pesewas="goal.remainingPesewas" hide-zero-decimals /> to go<template v-if="goal.targetDate">, by {{ formatDayShort(goal.targetDate) }}</template>
            </p>
            <p v-else class="v1-small">Goal reached</p>
            <p v-if="goal.thisMonthPesewas > 0" class="v1-small v1-num">
              <MoneyAmount :pesewas="goal.thisMonthPesewas" signed hide-zero-decimals tone="neutral" /> moved in this month
            </p>
          </li>
        </ul>
      </section>
    </template>

    <!-- Editor: the whole month is replaced on save, so every expense category is here. -->
    <SideSheet :open="editing" label="Edit budget limits" @close="editing = false">
      <form class="flex flex-col gap-5" @submit.prevent="save">
        <div>
          <h2 class="font-display text-2xl">Limits for {{ budget?.monthLabel }}</h2>
          <p class="mt-2 text-sm text-muted-foreground">
            Leave a category blank if you do not want to cap it. Amounts are in cedis.
          </p>
        </div>

        <div class="flex flex-col gap-3">
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
              :data-autofocus="category.id === focusId ? '' : undefined"
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
        </div>

        <div class="flex flex-col gap-2">
          <Label for="note">Note <span class="text-muted-foreground">(optional)</span></Label>
          <Input id="note" v-model="note" placeholder="What this month is about" />
        </div>

        <p v-if="error" class="status-strip status-strip-error" role="alert">{{ error }}</p>

        <div class="flex justify-end gap-2">
          <Button type="button" variant="ghost" @click="editing = false">Cancel</Button>
          <Button type="submit" :disabled="pending">
            {{ pending ? 'Saving…' : 'Save budget' }}
          </Button>
        </div>
      </form>
    </SideSheet>
  </div>
</template>

<style scoped>
/* v1 "Modern Financial Minimalism", ported from the v1 design preview. Every
   colour comes from the theme tokens in main.css, in light and dark. */
.v1 {
  --v1-tint: var(--tint, #efeae0);
  --v1-line: var(--line, rgb(29 42 39 / 12%));
  --v1-accent-ink: var(--accent-ink, #0f433d);
  --v1-accent-soft: var(--accent-soft, #e1ece8);
  --v1-champagne-ink: var(--champagne-ink, #7a5c28);
  --v1-clay: var(--clay, #9c4a32);
  --v1-serif: var(--font-serif);
  --v1-ease: cubic-bezier(0.22, 0.61, 0.36, 1);
  color: var(--foreground);
}
:global(.dark) .v1 {
  --v1-tint: var(--tint, var(--muted));
  --v1-line: var(--line, var(--border));
  --v1-accent-ink: var(--accent-ink, var(--primary));
  --v1-accent-soft: var(--accent-soft, color-mix(in srgb, var(--primary) 14%, var(--card)));
  --v1-champagne-ink: var(--champagne-ink, var(--warning));
  --v1-clay: var(--clay, var(--chart-6));
}
.v1 :focus-visible { outline: 2px solid var(--primary); outline-offset: 3px; border-radius: 4px; }
.v1 button { cursor: pointer; text-align: inherit; }
.v1 .v1-num { font-variant-numeric: tabular-nums lining-nums; }

.v1-eyebrow { font-size: 0.78rem; font-weight: 500; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted-foreground); }
.v1-h1 { font-family: var(--v1-serif); font-weight: 400; font-size: clamp(2rem, 4.4vw, 3rem); line-height: 1.08; letter-spacing: -0.02em; font-variation-settings: 'opsz' 96; }
.v1-h2 { font-family: var(--v1-serif); font-weight: 450; font-size: clamp(1.5rem, 2.6vw, 1.85rem); line-height: 1.15; letter-spacing: -0.012em; font-variation-settings: 'opsz' 48; }
.v1-small { font-size: 0.875rem; color: var(--muted-foreground); }
.v1-serif { font-family: var(--v1-serif); font-variation-settings: 'opsz' 48; }
.v1-sentence { font-family: var(--v1-serif); font-size: clamp(1.25rem, 2.2vw, 1.55rem); line-height: 1.4; font-weight: 380; font-variation-settings: 'opsz' 48; margin: 14px 0 22px; }
.v1-sentence em { font-style: normal; color: var(--v1-accent-ink); font-weight: 500; }
/* MoneyAmount sets its own size and weight; inside prose and the stepper it must follow its surroundings. */
.v1-sentence :deep(span), .v1-stepper :deep(span), .v1 .v1-goal :deep(b span) { font-size: inherit; line-height: inherit; font-family: inherit; font-weight: inherit; letter-spacing: inherit; }
.v1-small :deep(span), .v1-track-cap :deep(span) { font-size: inherit; }

.v1-link {
  display: inline-flex; align-items: center; gap: 0.35em; color: var(--primary); font-weight: 500; font-size: 0.95rem; min-height: 28px;
  background-image: linear-gradient(currentColor, currentColor); background-size: 100% 1px; background-position: 0 100%; background-repeat: no-repeat;
  padding-bottom: 1px; width: fit-content; transition: background-size 0.25s var(--v1-ease); margin-left: 0.6em;
}
.v1-link:hover { background-size: 0 1px; }
.v1-pill {
  display: inline-flex; align-items: center; justify-content: center; gap: 8px; min-height: 42px; padding: 0 20px; border-radius: 999px;
  background: var(--primary); color: var(--primary-foreground); font-weight: 500; font-size: 0.92rem; white-space: nowrap; transition: background 0.2s;
}
.v1-pill:hover { background: var(--v1-accent-ink); }
.v1-pill:disabled { opacity: 0.6; cursor: default; }

.v1-section { margin-top: clamp(64px, 9vw, 112px); }
.v1-section-head { display: flex; align-items: baseline; justify-content: space-between; gap: 24px; flex-wrap: wrap; margin-bottom: 28px; }
.v1-track-cap { display: flex; justify-content: space-between; gap: 12px; margin-top: 12px; font-size: 0.8rem; color: var(--muted-foreground); }

.v1-bud { border-top: 1px solid var(--v1-line); }
.v1-bud:last-child { border-bottom: 1px solid var(--v1-line); }
.v1-bud-btn { display: grid; grid-template-columns: 36px 1fr; gap: 6px 18px; padding: 22px 8px; margin: 0 -8px; width: calc(100% + 16px); border-radius: 8px; transition: background 0.2s; }
.v1-bud-btn:hover { background: var(--v1-tint); }
.v1-bud-line { display: flex; justify-content: space-between; align-items: baseline; gap: 16px; flex-wrap: wrap; }
.v1-bud-line .n { font-weight: 500; font-size: 1.05rem; }
.v1-bud-track { margin: 14px 0 10px; }
.v1-status { font-size: 0.85rem; font-weight: 500; }
.v1-status.is-watch { color: var(--v1-champagne-ink); }
.v1-status.is-over { color: var(--v1-clay); }
.v1-status.is-ok { color: var(--primary); }
.v1-plain { display: grid; grid-template-columns: 36px 1fr auto; align-items: center; gap: 18px; padding: 14px 0; }
.v1-plain .n { font-size: 1.05rem; }

.v1-adjust { display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 14px 32px; padding: 4px 0 26px 54px; }
.v1-stepper { display: inline-flex; align-items: center; gap: 6px; }
.v1-stepper button { width: 44px; height: 44px; border-radius: 50%; display: grid; place-items: center; box-shadow: inset 0 0 0 1px var(--v1-line); transition: box-shadow 0.2s, background 0.2s; }
.v1-stepper button:hover { box-shadow: inset 0 0 0 1px var(--primary); background: var(--v1-accent-soft); }
.v1-stepper output { min-width: 128px; text-align: center; font-family: var(--v1-serif); font-size: 1.3rem; }

.v1-goals { display: grid; grid-template-columns: repeat(3, 1fr); gap: 48px; }
.v1-goal { display: grid; justify-items: start; gap: 6px; }
.v1-ring { position: relative; width: 164px; height: 164px; margin-bottom: 14px; }
.v1-ring svg { width: 100%; height: 100%; transform: rotate(-90deg); }
.v1-ring circle { fill: none; stroke-width: 5; stroke-linecap: round; }
.v1-ring .bg { stroke: var(--v1-tint); }
.v1-ring .fg { stroke: var(--primary); transition: stroke-dasharray 0.9s var(--v1-ease); }
.v1-ring .pct { position: absolute; inset: 0; display: grid; place-items: center; font-family: var(--v1-serif); font-size: 2.1rem; letter-spacing: -0.02em; font-variation-settings: 'opsz' 96; }
.v1-ring .pct small { font-size: 0.5em; margin-left: 1px; color: var(--muted-foreground); }

@media (max-width: 980px) { .v1-goals { gap: 28px; } }
@media (max-width: 760px) {
  .v1-goals { grid-template-columns: 1fr; gap: 32px; }
  .v1-goal { grid-template-columns: 132px 1fr; column-gap: 24px; align-items: center; }
  .v1-goal .v1-ring { grid-row: 1 / span 4; width: 132px; height: 132px; margin: 0; }
  .v1-goal .v1-ring .pct { font-size: 1.7rem; }
  .v1-adjust { padding-left: 0; }
}
@media (pointer: coarse) { .v1-link { min-height: 44px; } .v1-bud-btn { min-height: 56px; } }
@media (prefers-reduced-motion: reduce) { .v1 *, .v1 *::before, .v1 *::after { transition: none !important; } }
</style>
