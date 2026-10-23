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

const selectClass = 'field-select'

const { mode: colourMode, set: setColourMode } = useColourMode()

const COLOUR_MODES = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' }
] as const
</script>

<template>
  <div>
    <PageHeader title="Settings" description="Your accounts and how Jara reads your money." />

    <p v-if="accountsLoadError" class="status-strip status-strip-error mb-5" role="alert">
      Could not load your account settings. Profile settings are still available.
    </p>

    <div class="grid items-start gap-6 lg:grid-cols-[12rem_minmax(0,1fr)] lg:gap-10">
      <nav class="app-panel sticky top-6 hidden p-2 lg:block" aria-label="Settings sections">
        <a href="#accounts" class="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">Accounts</a>
        <a href="#profile" class="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">About you</a>
        <a href="#appearance" class="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">Appearance</a>
        <a href="#login" class="block rounded-lg px-3 py-2 text-sm font-medium hover:bg-accent">Login</a>
      </nav>

      <div class="flex min-w-0 flex-col gap-6">
      <!-- Accounts -->
      <Card id="accounts" class="scroll-mt-6 overflow-hidden">
        <CardHeader>
          <div class="flex items-start justify-between gap-3">
            <div>
              <CardTitle>Accounts</CardTitle>
              <CardDescription>Where your money sits. Balances come from your ledger.</CardDescription>
            </div>
            <Button size="sm" variant="outline" @click="addingAccount = !addingAccount">
              <Plus />
              {{ addingAccount ? 'Cancel' : 'Add' }}
            </Button>
          </div>
        </CardHeader>

        <CardContent class="flex flex-col gap-4">
          <form
            v-if="addingAccount"
            class="flex flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4"
            @submit.prevent="addAccount"
          >
            <div class="flex flex-col gap-2">
              <Label for="account-name">Name</Label>
              <Input id="account-name" v-model="accountName" required placeholder="e.g. MTN MoMo" />
              <p v-if="accountFields.name" class="text-xs text-destructive">
                {{ accountFields.name }}
              </p>
            </div>

            <div class="grid gap-3 sm:grid-cols-2">
              <div class="flex flex-col gap-2">
                <Label for="account-type">Type</Label>
                <select id="account-type" v-model="accountType" :class="selectClass">
                  <option v-for="type in ACCOUNT_TYPES" :key="type" :value="type">
                    {{ ACCOUNT_TYPE_LABELS[type] }}
                  </option>
                </select>
              </div>

              <div class="flex flex-col gap-2">
                <Label for="account-institution">
                  Provider <span class="text-muted-foreground">(optional)</span>
                </Label>
                <Input id="account-institution" v-model="institution" placeholder="e.g. MTN, GCB" />
              </div>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="account-opening">Balance right now</Label>
              <Input id="account-opening" v-model="openingBalance" inputmode="decimal" placeholder="0.00" />
              <p class="text-xs text-muted-foreground">
                Jara treats this as your starting point and derives every later balance from
                the transactions you record.
              </p>
              <p v-if="accountFields.openingBalance" class="text-xs text-destructive">
                {{ accountFields.openingBalance }}
              </p>
            </div>

            <p v-if="accountError" class="status-strip status-strip-error" role="alert">
              {{ accountError }}
            </p>

            <Button type="submit" size="sm" :disabled="accountPending">
              {{ accountPending ? 'Adding…' : 'Add account' }}
            </Button>
          </form>

          <div v-if="accountsStatus === 'pending'" class="flex flex-col gap-3" aria-label="Loading accounts">
            <div v-for="index in 2" :key="index" class="flex items-center justify-between gap-4 py-2">
              <div class="skeleton-line h-3 w-36" />
              <div class="skeleton-line h-3 w-24" />
            </div>
          </div>

          <p v-else-if="accounts.length === 0" class="text-sm text-muted-foreground">
            No accounts yet. Add the one you use most.
          </p>

          <ul v-else class="flex flex-col divide-y divide-border">
            <li
              v-for="account in accounts"
              :key="account.accountId"
              class="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
            >
              <div class="min-w-0">
                <p class="flex items-center gap-2 truncate text-sm font-medium">
                  {{ account.name }}
                  <Badge v-if="account.isArchived" variant="secondary">Archived</Badge>
                </p>
                <p class="truncate text-xs text-muted-foreground">
                  {{ ACCOUNT_TYPE_LABELS[account.type] }}
                  <template v-if="account.institution">· {{ account.institution }}</template>
                </p>
              </div>

              <div class="flex shrink-0 items-center gap-3">
                <MoneyAmount
                  :pesewas="account.balancePesewas"
                  size="sm"
                  :tone="account.balancePesewas < 0 ? 'expense' : 'neutral'"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  @click="setArchived(account.accountId, !account.isArchived)"
                >
                  {{ account.isArchived ? 'Restore' : 'Archive' }}
                </Button>
              </div>
            </li>
          </ul>
        </CardContent>
      </Card>

      <!-- Profile -->
      <Card id="profile" class="scroll-mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>About you</CardTitle>
          <CardDescription>
            Used for your monthly figures and what Jara thinks you can afford.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form class="flex flex-col gap-4" @submit.prevent="saveProfile">
            <div class="flex flex-col gap-2">
              <Label for="display-name">Name</Label>
              <Input
                id="display-name"
                v-model="displayName"
                required
                :aria-invalid="Boolean(profileFields.displayName)"
                :aria-describedby="profileFields.displayName ? 'display-name-error' : undefined"
              />
              <p v-if="profileFields.displayName" id="display-name-error" class="text-xs text-destructive">
                {{ profileFields.displayName }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="income-frequency">How often you get paid</Label>
              <select
                id="income-frequency"
                v-model="incomeFrequency"
                :class="selectClass"
                :aria-invalid="Boolean(profileFields.incomeFrequency)"
                :aria-describedby="profileFields.incomeFrequency ? 'income-frequency-error' : undefined"
              >
                <option v-for="value in INCOME_FREQUENCIES" :key="value" :value="value">
                  {{ INCOME_FREQUENCY_LABELS[value] }}
                </option>
              </select>
              <p v-if="profileFields.incomeFrequency" id="income-frequency-error" class="text-xs text-destructive">
                {{ profileFields.incomeFrequency }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <Label for="expected-income">Expected monthly income</Label>
              <Input
                id="expected-income"
                v-model="expectedIncome"
                inputmode="decimal"
                placeholder="Leave blank if it varies"
                :aria-invalid="Boolean(profileFields.expectedIncome)"
                :aria-describedby="profileFields.expectedIncome ? 'expected-income-error' : undefined"
              />
              <p v-if="profileFields.expectedIncome" id="expected-income-error" class="text-xs text-destructive">
                {{ profileFields.expectedIncome }}
              </p>
            </div>

            <div class="flex flex-col gap-2">
              <Label>Timezone</Label>
              <p class="text-sm text-muted-foreground">
                {{ profile?.timezone }} — your months and daily totals are worked out here.
              </p>
            </div>

            <p v-if="profileError" class="status-strip status-strip-error" role="alert">
              {{ profileError }}
            </p>
            <p v-else-if="profileSaved" class="text-sm text-income">Saved.</p>

            <Button type="submit" class="self-start" :disabled="profilePending">
              {{ profilePending ? 'Saving…' : 'Save changes' }}
            </Button>
          </form>
        </CardContent>
      </Card>

      <!-- Appearance -->
      <Card id="appearance" class="scroll-mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Appearance</CardTitle>
          <CardDescription>
            Light reads better outdoors; dark reads better at night. Saved on this device.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div class="grid max-w-sm grid-cols-3 gap-1 rounded-xl bg-muted p-1" role="group" aria-label="Theme">
            <button
              v-for="option in COLOUR_MODES"
              :key="option.value"
              type="button"
              class="rounded-lg px-2 py-1.5 text-sm font-medium transition-colors"
              :class="colourMode === option.value
                ? 'bg-background text-foreground'
                : 'text-muted-foreground hover:text-foreground'"
              :aria-pressed="colourMode === option.value"
              @click="setColourMode(option.value)"
            >
              {{ option.label }}
            </button>
          </div>
        </CardContent>
      </Card>

      <!-- Account -->
      <Card id="login" class="scroll-mt-6 overflow-hidden">
        <CardHeader>
          <CardTitle>Your login</CardTitle>
          <CardDescription>{{ user?.email }}</CardDescription>
        </CardHeader>
        <CardFooter>
          <Button variant="outline" @click="signOut">
            <LogOut />
            Sign out
          </Button>
        </CardFooter>
      </Card>
      </div>
    </div>
  </div>
</template>
