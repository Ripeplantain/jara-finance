<script setup lang="ts">
import { pesewasToAmountString } from '#shared/money/pesewas'
import { todayInTimezone } from '#shared/period/dates'
import { toApiError } from '~/lib/errors'

/**
 * Adds money to a goal, or edits one existing contribution when `entry` is set.
 *
 * A contribution is *tracked* (planned, nothing moves) or *backed* (a real
 * transfer). Editing a backed one changes both sides of the transfer; a tracked
 * one can be turned into a real transfer from here; deleting a backed one
 * removes the transfer, which is the only honest way to undo money that moved.
 */
const props = defineProps<{
  open: boolean
  goal: { id: string, name: string, accountId: string | null } | null
  accounts: Array<{ accountId: string, name: string, isArchived: boolean }>
  entry?: {
    id: string
    amountPesewas: number
    occurredOn: string
    note: string | null
    linkedTransactionId: string | null
  } | null
}>()
const emit = defineEmits<{ close: [], saved: [] }>()

const { timezone } = useCurrentUser()
const { confirm } = useConfirm()

const editing = computed(() => Boolean(props.entry))
const isBacked = computed(() => Boolean(props.entry?.linkedTransactionId))

const kind = ref<'tracked' | 'backed'>('tracked')
const amount = ref('')
const from = ref('')
const date = ref('')
const note = ref('')
const error = ref('')
const pending = ref(false)

const sources = computed(() =>
  props.goal?.accountId
    ? props.accounts.filter(a => !a.isArchived && a.accountId !== props.goal!.accountId)
    : []
)
const canBack = computed(() => sources.value.length > 0)

watch(() => [props.open, props.entry?.id], () => {
  if (!props.open) return
  error.value = ''
  from.value = sources.value[0]?.accountId ?? ''
  if (props.entry) {
    amount.value = pesewasToAmountString(props.entry.amountPesewas)
    date.value = props.entry.occurredOn
    note.value = props.entry.note ?? ''
  } else {
    // A real transfer needs the goal's own account and a different active source.
    // Without that pair the form cannot offer one the server would refuse.
    kind.value = canBack.value ? 'backed' : 'tracked'
    amount.value = ''
    date.value = todayInTimezone(timezone.value)
    note.value = ''
  }
}, { immediate: true })

async function run(action: () => Promise<unknown>, fallback: string) {
  error.value = ''
  pending.value = true
  try {
    await action()
    emit('saved')
  } catch (caught) {
    error.value = toApiError(caught, fallback).message
  } finally {
    pending.value = false
  }
}

function submit() {
  if (!props.goal) return
  const goal = props.goal

  if (props.entry) {
    const entry = props.entry
    return run(() => $fetch<unknown>(`/api/goals/entries/${entry.id}`, {
      method: 'PATCH',
      body: { amount: amount.value, occurredOn: date.value, note: note.value || null }
    }), 'Could not save that change')
  }

  const backed = kind.value === 'backed' && canBack.value
    && sources.value.some(a => a.accountId === from.value)
  return run(() => $fetch<unknown>(`/api/goals/${goal.id}/contribute`, {
    method: 'POST',
    body: {
      kind: backed ? 'backed' : 'tracked',
      amount: amount.value,
      occurredOn: date.value,
      fromAccountId: backed ? from.value : null,
      note: note.value || null
    }
  }), 'Could not record that')
}

async function moveNow() {
  const entry = props.entry
  if (!entry) return
  if (!await confirm({
    title: 'Move this money now?',
    description: 'Jara will move it out of the account you chose and into this goal\'s savings account. Your balances will change.',
    confirmLabel: 'Move the money',
    icon: 'check'
  })) return
  await run(() => $fetch<unknown>(`/api/goals/entries/${entry.id}/move`, {
    method: 'POST',
    body: { fromAccountId: from.value }
  }), 'Could not move that money')
}

async function remove() {
  const entry = props.entry
  if (!entry) return
  const backed = Boolean(entry.linkedTransactionId)
  if (!await confirm({
    title: 'Delete this contribution?',
    description: backed
      ? 'This was a real transfer. Deleting it removes both sides and puts the money back where it came from.'
      : 'It will no longer count towards this goal. No balances change.',
    confirmLabel: 'Delete',
    tone: 'danger',
    icon: 'trash'
  })) return
  await run(() => backed
    ? $fetch<unknown>(`/api/transactions/${entry.linkedTransactionId}`, { method: 'DELETE' })
    : $fetch<unknown>(`/api/goals/entries/${entry.id}`, { method: 'DELETE' }),
  'Could not delete that')
}
</script>

<template>
  <SideSheet
    :open="open"
    :label="editing ? 'Edit contribution' : 'Add money to this goal'"
    @close="emit('close')"
  >
    <p class="j-eyebrow">{{ goal?.name }}</p>
    <h2 class="j-h2" style="margin: 8px 0 12px">
      {{ editing ? 'Edit this contribution' : 'Add money to this goal' }}
    </h2>
    <p class="j-small" style="margin-bottom: 28px">
      <template v-if="editing && isBacked">
        This is a real transfer. Changing the amount or date changes both sides of it, and your
        balances follow.
      </template>
      <template v-else-if="editing">
        This is planned, not moved. Nothing in your accounts changes when you edit it.
      </template>
      <template v-else-if="canBack">
        Either move real money into the goal's savings account, or record that you intend to.
      </template>
      <template v-else>
        A transfer needs a goal account and a different active source account. This contribution
        will only record your plan.
      </template>
    </p>

    <form @submit.prevent="submit">
      <label v-if="!editing" class="j-field">
        <span>How?</span>
        <select id="contribution-kind" v-model="kind">
          <option v-if="canBack" value="backed">Move the money now — a real transfer</option>
          <option value="tracked">Just track it — nothing moves yet</option>
        </select>
      </label>

      <label class="j-field">
        <span>Amount</span>
        <input
          id="contribution-amount"
          v-model="amount"
          class="big"
          inputmode="decimal"
          required
          placeholder="0.00"
        >
      </label>

      <label v-if="!editing && kind === 'backed'" class="j-field">
        <span>From which account?</span>
        <select id="contribution-from" v-model="from" required>
          <option v-for="account in sources" :key="account.accountId" :value="account.accountId">
            {{ account.name }}
          </option>
        </select>
      </label>

      <label class="j-field">
        <span>Date</span>
        <input id="contribution-date" v-model="date" type="date" required>
      </label>

      <label class="j-field">
        <span>Note (optional)</span>
        <input id="contribution-note" v-model="note" placeholder="Anything worth remembering">
      </label>

      <p v-if="error" class="j-field-error" role="alert">{{ error }}</p>

      <button type="submit" class="j-pill" style="width: 100%" :disabled="pending">
        {{ pending ? 'Saving…' : editing ? 'Save changes' : 'Add money' }}
      </button>
    </form>

    <!-- Only for a planned entry whose goal has a savings account to move into. -->
    <section v-if="editing && !isBacked && goal?.accountId" class="j-contrib-extra">
      <h3 class="j-eyebrow">Make it real</h3>
      <template v-if="canBack">
        <p class="j-small" style="margin: 8px 0 14px">
          Move this money into the goal's savings account now. It stays one contribution, only now
          backed by a real transfer.
        </p>
        <label class="j-field">
          <span>From which account?</span>
          <select id="move-from" v-model="from">
            <option v-for="account in sources" :key="account.accountId" :value="account.accountId">
              {{ account.name }}
            </option>
          </select>
        </label>
        <button type="button" class="j-pill is-quiet" :disabled="pending" @click="moveNow">
          Move the money now
        </button>
      </template>
      <p v-else class="j-small" style="margin-top: 8px">
        You need another active account to move money from.
      </p>
    </section>

    <button
      v-if="editing"
      type="button"
      class="j-link"
      style="margin-top: 28px; color: var(--clay)"
      :disabled="pending"
      @click="remove"
    >
      Delete this contribution
    </button>
  </SideSheet>
</template>
