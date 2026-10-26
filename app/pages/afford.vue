<script setup lang="ts">
import { refDebounced } from '@vueuse/core'

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
  The verdict is a word, not a word plus a glyph. A generic pictogram beside
  "Tight" would only repeat what the display word already says; the word also
  keeps the answer readable without colour.
*/
const VERDICTS = {
  yes: { word: 'Yes', tone: 'is-yes' },
  tight: { word: 'Tight', tone: 'is-tight' },
  no: { word: 'Not yet', tone: 'is-no' }
} as const

const verdict = computed(() => (data.value?.verdict ? VERDICTS[data.value.verdict] : null))
const hasNothing = computed(() => (data.value?.liquidPesewas ?? 0) <= 0)

const QUICK_AMOUNTS = [50, 100, 200, 500, 1000] as const
</script>

<template>
  <div>
    <!--
      The price field is the page's first control and first stop in tab order.
      A user opens this screen with a figure already in their head.
    -->
    <header>
      <p class="j-eyebrow">Decision check</p>
      <h1 class="j-h1" style="margin-top: 8px">Can I afford it?</h1>
      <p class="j-lede" style="margin-top: 14px">
        Measure a purchase against what is genuinely free after your plans.
      </p>
    </header>

    <form class="j-afford-form" @submit.prevent>
      <label for="price" class="j-eyebrow">Can I afford</label>
      <div class="j-afford-input">
        <span class="cur" aria-hidden="true">GH₵</span>
        <input
          id="price"
          v-model="price"
          inputmode="decimal"
          autocomplete="off"
          placeholder="0"
        >
      </div>
      <!--
        Common amounts. The screen is opened mid-decision, often one-handed, and
        a round figure is usually close enough to decide on.
      -->
      <div class="j-toggles" style="margin-top: 14px" role="group" aria-label="Common amounts">
        <button
          v-for="amount in QUICK_AMOUNTS"
          :key="amount"
          type="button"
          class="j-toggle j-num"
          :aria-pressed="price === String(amount)"
          @click="price = String(amount)"
        >
          {{ amount.toLocaleString('en-GH') }}
        </button>
        <button v-if="price" type="button" class="j-toggle" @click="price = ''">Clear</button>
      </div>
    </form>

    <p v-if="error" class="j-small" role="alert" style="margin-top: 48px">
      {{ error.message || 'Could not work out what you can afford just now.' }}
    </p>

    <div v-else-if="status === 'pending'" style="margin-top: 56px" aria-label="Working out affordability">
      <div class="skeleton-line h-16 w-64" />
      <div class="skeleton-line mt-10 h-2 w-full" />
    </div>

    <div v-else-if="hasNothing" class="j-empty">
      <p>There is nothing to measure against yet.</p>
      <p class="j-small">
        Add an account and record what is in it. Once Jara knows what you hold, it can tell you
        what a purchase would leave.
      </p>
      <NuxtLink to="/settings" class="j-pill" style="margin-top: 24px">Add an account</NuxtLink>
    </div>

    <template v-else-if="data">
      <!-- The verdict. One word, then what it leaves. -->
      <section v-if="verdict" class="j-section j-verdict" aria-live="polite" style="margin-top: 64px">
        <p class="word" :class="verdict.tone">{{ verdict.word }}</p>
        <p class="j-sentence">
          <template v-if="data.verdict === 'no'">
            Short by <em><MoneyAmount :pesewas="Math.abs(data.afterPurchasePesewas ?? 0)" /></em>
            of what is yours to spend.
          </template>
          <template v-else>
            It leaves <em><MoneyAmount :pesewas="data.afterPurchasePesewas ?? 0" /></em>
            of what is yours this month.
          </template>
        </p>
      </section>

      <section class="j-section" aria-labelledby="afford-map" :style="verdict ? 'margin-top: 48px' : ''">
        <div class="j-section-head">
          <h2 id="afford-map" class="j-h2">What is yours to spend</h2>
          <p class="j-small">Left out: money moved into goals, and money budgeted but not yet spent.</p>
        </div>
        <FundsMap
          :liquid-pesewas="data.liquidPesewas"
          :committed-savings-pesewas="data.committedSavingsPesewas"
          :remaining-budgeted-pesewas="data.remainingBudgetedPesewas"
          :available-pesewas="data.availablePesewas"
          :price-pesewas="data.pricePesewas ?? 0"
          animate
        />
      </section>

      <!-- The same subtraction, as figures -->
      <section class="j-section" aria-labelledby="afford-sum" style="margin-top: 72px">
        <h2 id="afford-sum" class="j-h2" style="margin-bottom: 20px">How that is worked out</h2>
        <dl class="j-sum">
          <div>
            <dt>In hand, all accounts</dt>
            <dd><MoneyAmount :pesewas="data.liquidPesewas" /></dd>
          </div>
          <div>
            <dt>Promised to goals</dt>
            <dd><MoneyAmount :pesewas="-data.committedSavingsPesewas" signed /></dd>
          </div>
          <div>
            <dt>Budgeted, not yet spent</dt>
            <dd><MoneyAmount :pesewas="-data.remainingBudgetedPesewas" signed /></dd>
          </div>
          <!--
            Two totals, and each one is the sum of the rows above it.

            The purchase sits *below* "Yours to spend", not above it: it is not
            one of the three things subtracted to reach what is available, it is
            what is then measured against that figure.
          -->
          <div class="is-total">
            <dt>Yours to spend</dt>
            <dd><MoneyAmount :pesewas="data.availablePesewas" :tone="data.availablePesewas < 0 ? 'expense' : 'neutral'" /></dd>
          </div>
          <template v-if="data.pricePesewas">
            <div>
              <dt>This purchase</dt>
              <dd><MoneyAmount :pesewas="-data.pricePesewas" signed /></dd>
            </div>
            <div class="is-total">
              <dt>{{ data.verdict === 'no' ? 'Short by' : 'Leaves' }}</dt>
              <dd>
                <MoneyAmount
                  :pesewas="data.verdict === 'no'
                    ? Math.abs(data.afterPurchasePesewas ?? 0)
                    : (data.afterPurchasePesewas ?? 0)"
                />
              </dd>
            </div>
          </template>
        </dl>

        <!-- A verdict that fits should lead somewhere. -->
        <div v-if="data.verdict && data.verdict !== 'no'" class="j-goal-actions" style="margin-top: 32px">
          <NuxtLink :to="{ path: '/transactions', query: { amount: price.trim() } }" class="j-pill">
            Record this spend
          </NuxtLink>
          <NuxtLink to="/budgets" class="j-link">See the budget behind this</NuxtLink>
        </div>
        <div v-else-if="data.verdict === 'no'" class="j-goal-actions" style="margin-top: 32px">
          <NuxtLink to="/goals" class="j-link">Review what is promised to goals</NuxtLink>
          <NuxtLink to="/budgets" class="j-link">Adjust this month's limits</NuxtLink>
        </div>
      </section>
    </template>
  </div>
</template>
