<script setup lang="ts">
import { LogOut, Plus } from 'lucide-vue-next'
import { ACCOUNT_TYPE_LABELS, ACCOUNT_TYPES } from '#shared/schemas/accounts'
import { INCOME_FREQUENCIES, INCOME_FREQUENCY_LABELS } from '#shared/schemas/profile'
import { pesewasToCedis } from '#shared/money/pesewas'
import { authClient } from '~/lib/auth-client'
import { toApiError } from '~/lib/errors'

useHead({ title: 'Settings — Jara' })

const { user, profile, refresh: refreshMe } = useCurrentUser()
const {
  data: accountData,
  refresh: refreshAccounts,
  status: accountsStatus,
  error: accountsLoadError
} = await useFetch('/api/accounts', {
  query: { includeArchived: 'true' }
})

const accounts = computed(() => accountData.value?.accounts ?? [])

// --- Profile ---------------------------------------------------------------
const displayName = ref(profile.value?.displayName ?? '')
const incomeFrequency = ref(profile.value?.incomeFrequency ?? 'monthly')
const expectedIncome = ref(
  profile.value?.expectedIncomePesewas !== null && profile.value?.expectedIncomePesewas !== undefined
    ? String(pesewasToCedis(profile.value.expectedIncomePesewas))
    : ''
)
const profileSaved = ref(false)
const profileError = ref('')
const profileFields = ref<Record<string, string>>({})
const profilePending = ref(false)

async function saveProfile() {
  profileError.value = ''
  profileFields.value = {}
  profileSaved.value = false
  profilePending.value = true
  try {
    await $fetch('/api/settings/profile', {
      method: 'PATCH',
      body: {
        displayName: displayName.value,
        incomeFrequency: incomeFrequency.value,
        expectedIncome: expectedIncome.value.trim() === '' ? null : expectedIncome.value
      }
    })
    await refreshMe()
    profileSaved.value = true
  } catch (caught) {
    const apiError = toApiError(caught, 'Could not save your settings')
    profileError.value = apiError.message
    profileFields.value = apiError.fields
  } finally {
    profilePending.value = false
  }
}

// --- Accounts --------------------------------------------------------------
const addingAccount = ref(false)
const accountName = ref('')
const accountType = ref<(typeof ACCOUNT_TYPES)[number]>('mobile_money')
const institution = ref('')
const openingBalance = ref('')
const accountError = ref('')
const accountFields = ref<Record<string, string>>({})
const accountPending = ref(false)

async function addAccount() {
  accountError.value = ''
  accountFields.value = {}
  accountPending.value = true
  try {
    await $fetch('/api/accounts', {
      method: 'POST',
      body: {
        name: accountName.value,
        type: accountType.value,
        institution: institution.value || null,
        openingBalance: openingBalance.value.trim() === '' ? 0 : openingBalance.value
      }
    })
    accountName.value = ''
    institution.value = ''
    openingBalance.value = ''
    addingAccount.value = false
    await refreshAccounts()
  } catch (caught) {
    const apiError = toApiError(caught, 'Could not add that account')
    accountError.value = apiError.message
    accountFields.value = apiError.fields
  } finally {
    accountPending.value = false
  }
}

/**
 * Accounts are archived, never deleted, so historical transactions keep a
 * parent. Archiving hides it from pickers and totals without rewriting history.
 */
async function setArchived(accountId: string, isArchived: boolean) {
  await $fetch(`/api/accounts/${accountId}`, { method: 'PATCH', body: { isArchived } })
  await refreshAccounts()
}

async function signOut() {
  await authClient.signOut()
  await refreshMe()
  await navigateTo('/login')
}

const { mode: colourMode, set: setColourMode } = useColourMode()

const COLOUR_MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
] as const
</script>

<template>
  <div>
    <header>
      <p class="j-eyebrow">Preferences</p>
      <h1 class="j-h1" style="margin-top: 8px">Settings</h1>
      <p class="j-lede" style="margin-top: 14px">Your accounts and how Jara reads your money.</p>
    </header>

    <nav class="j-toggles j-settings-nav" aria-label="Settings sections">
      <a href="#accounts" class="j-toggle">Accounts</a>
      <a href="#profile" class="j-toggle">About you</a>
      <a href="#appearance" class="j-toggle">Appearance</a>
      <a href="#login" class="j-toggle">Login</a>
    </nav>

    <p v-if="accountsLoadError" class="j-small" role="alert" style="margin-top: 24px">
      Could not load your account settings. Profile settings are still available.
    </p>

    <!-- Accounts -->
    <section id="accounts" class="j-section j-settings-section" aria-labelledby="set-accounts">
      <div class="j-section-head">
        <div>
          <h2 id="set-accounts" class="j-h2">Accounts</h2>
          <p class="j-small" style="margin-top: 6px">Where your money sits. Balances come from your ledger.</p>
        </div>
        <button type="button" class="j-pill is-quiet" @click="addingAccount = !addingAccount">
          <Plus v-if="!addingAccount" :size="16" aria-hidden="true" />
          {{ addingAccount ? 'Cancel' : 'Add' }}
        </button>
      </div>

      <form v-if="addingAccount" class="j-settings-form" @submit.prevent="addAccount">
        <label class="j-field">
          <span>Name</span>
          <input id="account-name" v-model="accountName" required placeholder="MTN MoMo">
        </label>
        <p v-if="accountFields.name" class="j-field-error">{{ accountFields.name }}</p>

        <div class="j-field-pair">
          <label class="j-field">
            <span>Type</span>
            <select id="account-type" v-model="accountType">
              <option v-for="type in ACCOUNT_TYPES" :key="type" :value="type">
                {{ ACCOUNT_TYPE_LABELS[type] }}
              </option>
            </select>
          </label>
          <label class="j-field">
            <span>Provider (optional)</span>
            <input id="account-institution" v-model="institution" placeholder="MTN, GCB">
          </label>
        </div>

        <label class="j-field">
          <span>Balance right now</span>
          <input id="account-opening" v-model="openingBalance" class="big" inputmode="decimal" placeholder="0.00">
        </label>
        <p class="j-small" style="margin: -8px 0 22px">
          Jara treats this as your starting point and derives every later balance from the
          transactions you record.
        </p>
        <p v-if="accountFields.openingBalance" class="j-field-error">{{ accountFields.openingBalance }}</p>

        <p v-if="accountError" class="j-field-error" role="alert">{{ accountError }}</p>

        <button type="submit" class="j-pill" :disabled="accountPending">
          {{ accountPending ? 'Adding…' : 'Add account' }}
        </button>
      </form>

      <div v-if="accountsStatus === 'pending'" aria-label="Loading accounts">
        <div v-for="index in 2" :key="index" class="flex items-center justify-between gap-4 py-4">
          <div class="skeleton-line h-3 w-36" />
          <div class="skeleton-line h-3 w-24" />
        </div>
      </div>

      <p v-else-if="accounts.length === 0" class="j-small">No accounts yet. Add the one you use most.</p>

      <ul v-else class="j-rows">
        <li v-for="account in accounts" :key="account.accountId" class="j-account-row">
          <div class="min-w-0">
            <p class="t">
              {{ account.name }}
              <span v-if="account.isArchived" class="j-small"> · Archived</span>
            </p>
            <p class="j-small">
              {{ ACCOUNT_TYPE_LABELS[account.type] }}
              <template v-if="account.institution">· {{ account.institution }}</template>
            </p>
          </div>
          <MoneyAmount
            class="amt"
            :pesewas="account.balancePesewas"
            :tone="account.balancePesewas < 0 ? 'expense' : 'neutral'"
          />
          <button type="button" class="j-link" @click="setArchived(account.accountId, !account.isArchived)">
            {{ account.isArchived ? 'Restore' : 'Archive' }}
          </button>
        </li>
      </ul>
    </section>

    <!-- Profile -->
    <section id="profile" class="j-section j-settings-section" aria-labelledby="set-profile">
      <h2 id="set-profile" class="j-h2">About you</h2>
      <p class="j-small" style="margin: 6px 0 28px">
        Used for your monthly figures and what Jara thinks you can afford.
      </p>

      <form class="j-settings-form" @submit.prevent="saveProfile">
        <label class="j-field">
          <span>Name</span>
          <input
            id="display-name"
            v-model="displayName"
            required
            :aria-invalid="Boolean(profileFields.displayName)"
            :aria-describedby="profileFields.displayName ? 'display-name-error' : undefined"
          >
        </label>
        <p v-if="profileFields.displayName" id="display-name-error" class="j-field-error">
          {{ profileFields.displayName }}
        </p>

        <label class="j-field">
          <span>How often you get paid</span>
          <select
            id="income-frequency"
            v-model="incomeFrequency"
            :aria-invalid="Boolean(profileFields.incomeFrequency)"
            :aria-describedby="profileFields.incomeFrequency ? 'income-frequency-error' : undefined"
          >
            <option v-for="value in INCOME_FREQUENCIES" :key="value" :value="value">
              {{ INCOME_FREQUENCY_LABELS[value] }}
            </option>
          </select>
        </label>
        <p v-if="profileFields.incomeFrequency" id="income-frequency-error" class="j-field-error">
          {{ profileFields.incomeFrequency }}
        </p>

        <label class="j-field">
          <span>Expected monthly income</span>
          <input
            id="expected-income"
            v-model="expectedIncome"
            inputmode="decimal"
            placeholder="Leave blank if it varies"
            :aria-invalid="Boolean(profileFields.expectedIncome)"
            :aria-describedby="profileFields.expectedIncome ? 'expected-income-error' : undefined"
          >
        </label>
        <p v-if="profileFields.expectedIncome" id="expected-income-error" class="j-field-error">
          {{ profileFields.expectedIncome }}
        </p>

        <div class="j-field">
          <span>Timezone</span>
          <p>{{ profile?.timezone }} <span class="j-small">— your months and daily totals are worked out here.</span></p>
        </div>

        <p v-if="profileError" class="j-field-error" role="alert">{{ profileError }}</p>
        <p v-else-if="profileSaved" class="j-status is-ok" style="margin-bottom: 16px">Saved.</p>

        <button type="submit" class="j-pill" :disabled="profilePending">
          {{ profilePending ? 'Saving…' : 'Save changes' }}
        </button>
      </form>
    </section>

    <!-- Appearance -->
    <section id="appearance" class="j-section j-settings-section" aria-labelledby="set-appearance">
      <h2 id="set-appearance" class="j-h2">Appearance</h2>
      <p class="j-small" style="margin: 6px 0 18px">
        Light by default. Dark reads better at night. Saved on this device.
      </p>
      <div class="j-toggles" role="group" aria-label="Theme">
        <button
          v-for="option in COLOUR_MODES"
          :key="option.value"
          type="button"
          class="j-toggle"
          :aria-pressed="colourMode === option.value"
          @click="setColourMode(option.value)"
        >
          {{ option.label }}
        </button>
      </div>
    </section>

    <!-- Login -->
    <section id="login" class="j-section j-settings-section" aria-labelledby="set-login">
      <h2 id="set-login" class="j-h2">Your login</h2>
      <p class="j-small" style="margin: 6px 0 22px">{{ user?.email }}</p>
      <button type="button" class="j-pill is-quiet" @click="signOut">
        <LogOut :size="16" aria-hidden="true" />
        Sign out
      </button>
    </section>
  </div>
</template>
