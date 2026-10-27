<script setup lang="ts">
import { pesewasToAmountString } from '#shared/money/pesewas'
import { toApiError } from '~/lib/errors'

/**
 * Creates a goal, or edits one when `goal` is given. One form for both so the
 * two can never drift apart; the only difference is "already saved", which
 * only makes sense when the goal is being started.
 */
const props = defineProps<{
  open: boolean
  accounts: Array<{ accountId: string, name: string }>
  goal?: {
    id: string
    name: string
    targetPesewas: number
    targetDate: string | null
    accountId: string | null
  }
}>()
const emit = defineEmits<{ close: [], saved: [goalId: string] }>()

const name = ref('')
const target = ref('')
const targetDate = ref('')
const accountId = ref('')
const alreadySaved = ref('')
const error = ref('')
const fields = ref<Record<string, string>>({})
const pending = ref(false)

const editing = computed(() => props.goal !== undefined)

// Reset from the goal (or blank) each time the sheet opens, so a cancelled edit
// never leaks into the next one.
watch(() => props.open, (open) => {
  if (!open) return
  name.value = props.goal?.name ?? ''
  target.value = props.goal ? pesewasToAmountString(props.goal.targetPesewas) : ''
  targetDate.value = props.goal?.targetDate ?? ''
  accountId.value = props.goal?.accountId ?? ''
  alreadySaved.value = ''
  error.value = ''
  fields.value = {}
}, { immediate: true })

async function submit() {
  error.value = ''
  fields.value = {}
  pending.value = true
  try {
    if (props.goal) {
      await $fetch(`/api/goals/${props.goal.id}`, {
        method: 'PATCH',
        body: {
          name: name.value,
          target: target.value,
          targetDate: targetDate.value || null,
          accountId: accountId.value || null
        }
      })
      emit('saved', props.goal.id)
    } else {
      const created = await $fetch<{ goal: { id: string } }>('/api/goals', {
        method: 'POST',
        body: {
          name: name.value,
          target: target.value,
          targetDate: targetDate.value || null,
          accountId: accountId.value || null,
          alreadySaved: alreadySaved.value.trim() || null
        }
      })
      emit('saved', created.goal.id)
    }
  } catch (caught) {
    const apiError = toApiError(caught, editing.value ? 'Could not save that goal' : 'Could not create that goal')
    error.value = apiError.message
    fields.value = apiError.fields
  } finally {
    pending.value = false
  }
}
</script>

<template>
  <SideSheet :open="open" :label="editing ? 'Edit goal' : 'New goal'" @close="emit('close')">
    <p class="j-eyebrow">{{ editing ? 'Edit goal' : 'New goal' }}</p>
    <h2 class="j-h2" style="margin: 8px 0 28px">
      {{ editing ? 'Change this goal' : 'What are you saving for?' }}
    </h2>
    <form @submit.prevent="submit">
      <label class="j-field">
        <span>What for?</span>
        <input id="goal-name" v-model="name" required placeholder="Laptop, rent, emergency fund">
      </label>
      <p v-if="fields.name" class="j-field-error">{{ fields.name }}</p>

      <label class="j-field">
        <span>Target amount</span>
        <input id="goal-target" v-model="target" class="big" inputmode="decimal" required placeholder="5,000">
      </label>
      <p v-if="fields.target" class="j-field-error">{{ fields.target }}</p>

      <label v-if="!editing" class="j-field">
        <span>Already saved (optional)</span>
        <input id="goal-saved" v-model="alreadySaved" inputmode="decimal" placeholder="0.00">
      </label>
      <p v-if="!editing" class="j-small" style="margin: -8px 0 22px">
        Money you have already put aside for this. Jara records it as planned, not moved, so no
        balance changes. You can fix it later from the goal's page.
      </p>
      <p v-if="fields.alreadySaved" class="j-field-error">{{ fields.alreadySaved }}</p>

      <label class="j-field">
        <span>By when? (optional)</span>
        <input id="goal-date" v-model="targetDate" type="date">
      </label>

      <label class="j-field">
        <span>Savings account (optional)</span>
        <select id="goal-account" v-model="accountId">
          <option value="">Track only — no account</option>
          <option v-for="account in accounts" :key="account.accountId" :value="account.accountId">
            {{ account.name }}
          </option>
        </select>
      </label>
      <p class="j-small" style="margin: -8px 0 24px">
        <template v-if="editing">
          Changing this only affects money you move from now on. Transfers already made stay in the
          account they went to.
        </template>
        <template v-else>
          Pick an account if you want to move real money into this goal. Without one, Jara tracks
          your intent but no balance changes.
        </template>
      </p>

      <p v-if="error" class="j-field-error" role="alert">{{ error }}</p>

      <button type="submit" class="j-pill" style="width: 100%" :disabled="pending">
        {{ pending ? 'Saving…' : editing ? 'Save changes' : 'Create goal' }}
      </button>
    </form>
  </SideSheet>
</template>
