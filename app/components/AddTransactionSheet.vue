<script setup lang="ts">
import { todayInTimezone } from '#shared/period/dates'

/**
 * The layout-level "Add transaction" sheet: the real TransactionForm, fed with
 * accounts and categories fetched when the sheet opens so a just-added account
 * is never missing from the list.
 */
const { isOpen, initialAmount, close, markSaved } = useAddTransaction()
const { timezone } = useCurrentUser()

type Accounts = Array<{ accountId: string, name: string, type: string, currency: string }>
type Categories = Array<{ id: string, name: string, kind: string }>

const accounts = ref<Accounts>([])
const categories = ref<Categories>([])
const loaded = ref(false)
const failed = ref(false)
// Resolved in the user's timezone, as the server does; recomputed per open.
const today = ref('')

watch(isOpen, async (open) => {
  if (!open) return
  loaded.value = false
  failed.value = false
  today.value = todayInTimezone(timezone.value)
  try {
    const [accountData, categoryData] = await Promise.all([
      $fetch('/api/accounts'),
      $fetch('/api/categories')
    ])
    accounts.value = accountData.accounts
    categories.value = categoryData.categories
  } catch {
    failed.value = true
  } finally {
    loaded.value = true
  }
  await nextTick()
  document.getElementById('amount')?.focus()
})

async function onSaved() {
  close()
  markSaved()
  // Every page lists data that a new transaction changes; re-read what is on screen.
  await refreshNuxtData()
}
</script>

<template>
  <SideSheet :open="isOpen" label="Add transaction" @close="close">
    <p class="section-kicker">New entry</p>
    <h2 class="font-display mb-6 mt-2 text-3xl">Add a transaction</h2>

    <div v-if="!loaded" class="flex flex-col gap-4" aria-label="Loading form">
      <div class="skeleton-line h-10 w-full" />
      <div class="skeleton-line h-10 w-full" />
      <div class="skeleton-line h-10 w-full" />
    </div>
    <p v-else-if="failed" class="status-strip status-strip-error" role="alert">
      Could not load your accounts. Close this and try again.
    </p>
    <div v-else-if="accounts.length === 0">
      <p class="text-sm text-muted-foreground">
        Transactions belong to an account: cash, Mobile Money or a bank. Add one first.
      </p>
      <Button as-child class="mt-5">
        <NuxtLink to="/settings" data-autofocus @click="close">Add an account</NuxtLink>
      </Button>
    </div>
    <TransactionForm
      v-else
      :accounts="accounts"
      :categories="categories"
      :today="today"
      :initial-amount="initialAmount"
      @saved="onSaved"
    />
  </SideSheet>
</template>
