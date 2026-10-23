<script setup lang="ts">
import { refDebounced } from '@vueuse/core'
import { Wallet } from 'lucide-vue-next'

useHead({ title: 'Can I afford it? — Jara' })

/**
 * The affordability answer.
 *
 * This screen deliberately opens on the breakdown rather than on a price field
 * alone: the verdict only means something once you have seen the three figures
 * it was subtracted from. Typing a price adds the verdict; it does not reveal
 * the page.
 *
 * Every figure here comes from `/api/affordability`, which is the same endpoint
 * the AI coach's tool calls — so what this screen says and what Salo says in
 * chat cannot drift apart.
 */
const price = ref('')
// Long enough that a three-digit amount is not three round trips, short enough
// that the answer feels like it is tracking what you type.
const debouncedPrice = refDebounced(price, 400)

const { data, error, status } = await useFetch('/api/affordability', {
  query: computed(() => ({ price: debouncedPrice.value.trim() || undefined }))
})

/*
  The verdict is a word, not a word plus a glyph. A stock pictogram beside
  "Tight" restates in a generic icon what the 54px word already says, and the
  word is what makes the answer readable without colour.
*/
const VERDICTS = {
  yes: { word: 'Yes', tone: 'text-income' },
  tight: { word: 'Tight', tone: 'text-warning' },
  no: { word: 'Not yet', tone: 'text-expense' }
} as const

const verdict = computed(() => (data.value?.verdict ? VERDICTS[data.value.verdict] : null))
const hasNothing = computed(() => (data.value?.liquidPesewas ?? 0) <= 0)

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000] as const
</script>

<template>
  <div class="flex flex-col gap-6 sm:gap-8">
    <!--
      The price field is the page's first element and first stop in tab order.
      A user opens this screen with a figure already in their head.
    -->
    <div class="max-w-2xl">
      <p class="section-kicker">Affordability check</p>
      <p class="mt-1 text-sm text-muted-foreground">
        Measure a purchase against what is genuinely free after your plans.
      </p>
    </div>

    <form class="app-panel max-w-2xl p-4 sm:p-6" @submit.prevent>
      <!--
        The page's heading and the field's label are the same words, so they are
        the same element. Without this the screen had no h1 at all and its
        outline started at h2.
      -->
      <h1 class="text-sm font-semibold">
        <label for="price">Can I afford</label>
      </h1>
      <div
        class="mt-2 flex items-baseline gap-2 border-b-2 border-foreground pb-2 focus-within:border-ring"
      >
        <span class="text-xl font-medium text-muted-foreground" aria-hidden="true">GH₵</span>
        <input
          id="price"
          v-model="price"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0"
          class="w-full min-w-0 bg-transparent text-4xl font-semibold tracking-tight tabular-nums outline-none placeholder:text-muted-foreground/45 sm:text-5xl"
        >
      </div>
      <!--
        Common amounts. The screen is opened mid-decision, often one-handed, and
        a round figure is usually close enough to decide on.
      -->
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="amount in QUICK_AMOUNTS"
          :key="amount"
          type="button"
          class="min-h-11 border border-input px-3 py-1.5 text-sm font-medium tabular-nums transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          :class="price === String(amount) ? 'bg-foreground text-background' : ''"
          @click="price = String(amount)"
        >
          {{ amount.toLocaleString('en-GH') }}
        </button>
        <button
          v-if="price"
          type="button"
          class="min-h-11 px-3 py-1.5 text-sm font-medium text-muted-foreground underline underline-offset-4 transition-colors hover:text-foreground focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          @click="price = ''"
        >
          Clear
        </button>
      </div>
    </form>

    <p v-if="error" class="status-strip status-strip-error" role="alert">
      {{ error.message || 'Could not work out what you can afford just now.' }}
    </p>

    <div v-else-if="status === 'pending'" class="grid gap-4 lg:grid-cols-5" aria-label="Working out affordability">
      <div class="app-panel p-5 lg:col-span-3">
        <div class="skeleton-line h-3 w-48" />
        <div class="mt-5 grid grid-cols-8 gap-1">
          <div v-for="index in 24" :key="index" class="skeleton-line aspect-square" />
        </div>
      </div>
      <div class="app-panel p-5 lg:col-span-2">
        <div v-for="index in 4" :key="index" class="mb-4 flex justify-between gap-4">
          <div class="skeleton-line h-3 w-28" />
          <div class="skeleton-line h-3 w-20" />
        </div>
      </div>
    </div>

    <EmptyState
      v-else-if="hasNothing"
      :icon="Wallet"
      title="There is nothing to measure against yet"
      description="Add an account and record what is in it. Once Jara knows what you hold, it can tell you what a purchase would leave."
    >
      <Button as-child>
        <NuxtLink to="/settings">Add an account</NuxtLink>
      </Button>
    </EmptyState>

    <template v-else-if="data">
      <!-- The verdict. One word, then what it leaves. -->
      <div v-if="verdict" class="flex flex-wrap items-end gap-x-5 gap-y-2">
        <p
          class="text-[2.75rem] font-bold leading-none tracking-tight sm:text-6xl"
          :class="verdict.tone"
        >
          {{ verdict.word }}
        </p>
        <p class="text-sm leading-snug text-muted-foreground">
          <template v-if="data.verdict === 'no'">
            Short by
            <MoneyAmount
              :pesewas="Math.abs(data.afterPurchasePesewas ?? 0)"
              size="lg"
              tone="expense"
              class="align-baseline"
            />
            <br>
            of what is yours to spend.
          </template>
          <template v-else>
            It leaves
            <MoneyAmount
              :pesewas="data.afterPurchasePesewas ?? 0"
              size="lg"
              :tone="data.verdict === 'tight' ? 'warning' : 'income'"
              class="align-baseline"
            />
            <br>
            of what is yours this month.
          </template>
        </p>
      </div>

      <div class="grid gap-6 lg:grid-cols-5 lg:gap-8">
        <!-- The signature: the subtraction, drawn -->
        <TallyField
          class="app-panel p-4 sm:p-5 lg:col-span-3"
          :liquid-pesewas="data.liquidPesewas"
          :committed-savings-pesewas="data.committedSavingsPesewas"
          :remaining-budgeted-pesewas="data.remainingBudgetedPesewas"
          :price-pesewas="data.pricePesewas ?? 0"
          animate
        />

        <!-- The same subtraction, as figures -->
        <div class="app-panel p-4 sm:p-5 lg:col-span-2">
          <h2 class="text-sm font-semibold">How that is worked out</h2>
          <dl class="mt-3 border-t border-border">
            <div class="flex items-center gap-3 border-b border-border py-2">
              <span class="size-3 shrink-0 border border-input bg-card dark:bg-background" aria-hidden="true" />
              <dt class="min-w-0 flex-1 text-sm">In hand</dt>
              <dd><MoneyAmount :pesewas="data.liquidPesewas" size="sm" /></dd>
            </div>
            <div class="flex items-center gap-3 border-b border-border py-2">
              <span class="size-3 shrink-0 border border-expense bg-expense" aria-hidden="true" />
              <dt class="min-w-0 flex-1 text-sm">Promised to goals</dt>
              <dd>
                <MoneyAmount :pesewas="-data.committedSavingsPesewas" size="sm" signed />
              </dd>
            </div>
            <div class="flex items-center gap-3 border-b border-border py-2">
              <span class="cell-hatched size-3 shrink-0 border border-primary" aria-hidden="true" />
              <dt class="min-w-0 flex-1 text-sm">Budgeted, not yet spent</dt>
              <dd>
                <MoneyAmount :pesewas="-data.remainingBudgetedPesewas" size="sm" signed />
              </dd>
            </div>
            <!--
              Two totals, and each one is the sum of the rows above it.

              The purchase sits *below* "Yours to spend", not above it: it is
              not one of the three things subtracted to reach what is available,
              it is what is then measured against that figure. With it listed
              among them the column read as a subtraction whose total excluded
              the row directly above the rule — the one thing this screen can
              never do.
            -->
            <div class="flex items-baseline gap-3 border-b-2 border-foreground py-2.5">
              <dt class="min-w-0 flex-1 text-sm font-semibold">Yours to spend</dt>
              <dd>
                <MoneyAmount
                  :pesewas="data.availablePesewas"
                  size="lg"
                  :tone="data.availablePesewas < 0 ? 'expense' : 'neutral'"
                />
              </dd>
            </div>

            <template v-if="data.pricePesewas">
              <div class="flex items-center gap-3 border-b border-border py-2">
                <span class="size-3 shrink-0 border border-foreground bg-foreground" aria-hidden="true" />
                <dt class="min-w-0 flex-1 text-sm">This purchase</dt>
                <dd><MoneyAmount :pesewas="-data.pricePesewas" size="sm" signed /></dd>
              </div>
              <div class="flex items-baseline gap-3 border-b-2 border-foreground py-2.5">
                <dt class="min-w-0 flex-1 text-sm font-semibold">
                  {{ data.verdict === 'no' ? 'Short by' : 'Leaves' }}
                </dt>
                <dd>
                  <MoneyAmount
                    :pesewas="data.verdict === 'no'
                      ? Math.abs(data.afterPurchasePesewas ?? 0)
                      : (data.afterPurchasePesewas ?? 0)"
                    size="lg"
                    :tone="data.verdict === 'no'
                      ? 'expense'
                      : data.verdict === 'tight' ? 'warning' : 'income'"
                  />
                </dd>
              </div>
            </template>
          </dl>
          <p class="mt-3 text-xs leading-relaxed text-muted-foreground">
            Money you have moved into a goal, and money you have budgeted but not yet
            spent, are both left out — so this is what you can spend without breaking a
            plan you already made.
          </p>

          <!-- A verdict that fits should lead somewhere. -->
          <div v-if="data.verdict && data.verdict !== 'no'" class="mt-5 flex flex-wrap gap-2">
            <Button as-child size="sm">
              <NuxtLink :to="{ path: '/transactions', query: { amount: price.trim() } }">
                Record this spend
              </NuxtLink>
            </Button>
            <Button as-child size="sm" variant="outline">
              <NuxtLink to="/budgets">See the budget behind this</NuxtLink>
            </Button>
          </div>
          <div v-else-if="data.verdict === 'no'" class="mt-5 flex flex-wrap gap-2">
            <Button as-child size="sm" variant="outline">
              <NuxtLink to="/goals">Review what is promised to goals</NuxtLink>
            </Button>
            <Button as-child size="sm" variant="outline">
              <NuxtLink to="/budgets">Adjust this month's limits</NuxtLink>
            </Button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
