<script setup lang="ts">
import { INCOME_FREQUENCIES, INCOME_FREQUENCY_LABELS } from '#shared/schemas/profile'
import { toApiError } from '~/lib/errors'

definePageMeta({ layout: 'auth' })
useHead({ title: 'Set up Jara' })

const { user, refresh } = useCurrentUser()

const displayName = ref(user.value?.name ?? '')
const timezone = ref('Africa/Accra')
const incomeFrequency = ref<(typeof INCOME_FREQUENCIES)[number]>('monthly')
const expectedIncome = ref('')
const error = ref('')
const fields = ref<Record<string, string>>({})
const pending = ref(false)

/**
 * Timezones, from the runtime's own tzdata rather than a hardcoded list.
 *
 * `supportedValuesOf` is not in every engine, so the catch falls back to the
 * handful that cover the target users. Getting this wrong matters more than it
 * looks: the timezone decides what "this month" means for every figure.
 */
const timezones = computed(() => {
  try {
    return Intl.supportedValuesOf('timeZone')
  } catch {
    return ['Africa/Accra', 'Africa/Lagos', 'Africa/Abidjan', 'Europe/London', 'UTC']
  }
})

async function submit() {
  error.value = ''
  fields.value = {}
  pending.value = true
  try {
    await $fetch('/api/onboarding', {
      method: 'POST',
      body: {
        displayName: displayName.value,
        timezone: timezone.value,
        incomeFrequency: incomeFrequency.value,
        // Blank means "I don't know", which is stored as null rather than zero.
        expectedIncome: expectedIncome.value.trim() === '' ? null : expectedIncome.value
      }
    })
    await refresh()
    await navigateTo('/')
  } catch (caught) {
    const apiError = toApiError(caught, 'Could not save your details')
    error.value = apiError.message
    fields.value = apiError.fields
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <div>
    <h1 class="font-display text-[2.25rem] leading-[1.1] sm:text-[2.5rem]">Set up your money view</h1>
    <p class="mt-3 text-[0.95rem] text-muted-foreground">This is how Jara works out your months and what you can afford.</p>

    <form class="mt-8 flex flex-col gap-5" @submit.prevent="submit">
        <div class="flex flex-col gap-2">
          <Label for="displayName">What should Jara call you?</Label>
          <Input id="displayName" v-model="displayName" required placeholder="Ama" />
          <p v-if="fields.displayName" class="text-xs text-destructive">
            {{ fields.displayName }}
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="timezone">Timezone</Label>
          <select
            id="timezone"
            v-model="timezone"
            class="field-select"
          >
            <option v-for="zone in timezones" :key="zone" :value="zone">{{ zone }}</option>
          </select>
          <p class="text-xs text-muted-foreground">
            Your months and daily totals are worked out in this timezone.
          </p>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="incomeFrequency">How often do you get paid?</Label>
          <select
            id="incomeFrequency"
            v-model="incomeFrequency"
            class="field-select"
          >
            <option v-for="value in INCOME_FREQUENCIES" :key="value" :value="value">
              {{ INCOME_FREQUENCY_LABELS[value] }}
            </option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <Label for="expectedIncome">Roughly how much do you earn a month?</Label>
          <Input id="expectedIncome" v-model="expectedIncome" inputmode="decimal" placeholder="e.g. 3500" />
          <p class="text-xs text-muted-foreground">
            Optional — leave it blank if it varies. Jara will use your recorded income instead.
          </p>
          <p v-if="fields.expectedIncome" class="text-xs text-destructive">
            {{ fields.expectedIncome }}
          </p>
        </div>

        <p v-if="error" class="status-strip status-strip-error" role="alert">{{ error }}</p>

        <Button type="submit" class="min-h-11" :disabled="pending">
          {{ pending ? 'Saving…' : 'Start using Jara' }}
        </Button>
    </form>
  </div>
</template>
