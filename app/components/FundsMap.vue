<script setup lang="ts">
/**
 * Where the money in hand is spoken for, as one quiet line and four labels.
 *
 * Every figure is passed in from the server; the only arithmetic here is the
 * bar's segment widths, which are drawing, not reporting. The labels carry the
 * meaning, so the bar never depends on colour alone.
 */
const props = withDefaults(
  defineProps<{
    liquidPesewas: number
    committedSavingsPesewas: number
    remainingBudgetedPesewas: number
    pricePesewas?: number
    /** The server's headroom figure, shown against its label when given. */
    availablePesewas?: number
    animate?: boolean
  }>(),
  { pricePesewas: 0, availablePesewas: undefined, animate: false }
)

const widths = computed(() => {
  if (props.liquidPesewas <= 0) {
    return { goals: 0, budgets: 0, purchase: 0, available: 0 }
  }

  const total = props.liquidPesewas
  const goals = Math.min(Math.max(props.committedSavingsPesewas, 0), total)
  const budgets = Math.min(Math.max(props.remainingBudgetedPesewas, 0), total - goals)
  const room = Math.max(total - goals - budgets, 0)
  const purchase = Math.min(Math.max(props.pricePesewas, 0), room)
  const available = Math.max(room - purchase, 0)
  return {
    goals: goals / total * 100,
    budgets: budgets / total * 100,
    purchase: purchase / total * 100,
    available: available / total * 100
  }
})

const ariaLabel = computed(() => {
  const parts = [
    `Funds map for ${props.liquidPesewas} pesewas in hand`,
    `${props.committedSavingsPesewas} promised to goals`,
    `${props.remainingBudgetedPesewas} budgeted and not yet spent`
  ]
  if (props.pricePesewas > 0) parts.push(`${props.pricePesewas} for this purchase`)
  return `${parts.join(', ')}.`
})

const items = computed(() => [
  { key: 'goals' as const, label: 'Set aside for goals', amount: props.committedSavingsPesewas, color: 'var(--champagne)', minus: true },
  { key: 'budgets' as const, label: 'Budgeted, not yet spent', amount: props.remainingBudgetedPesewas, color: 'var(--faint)', minus: true },
  ...(props.pricePesewas > 0
    ? [{ key: 'purchase' as const, label: 'This purchase', amount: props.pricePesewas, color: 'var(--foreground)', minus: true }]
    : []),
  { key: 'available' as const, label: 'Available', amount: props.availablePesewas ?? null, color: 'var(--primary)', minus: false }
])
</script>

<template>
  <div class="j-stack">
    <div class="j-stack-bar" role="img" :aria-label="ariaLabel">
      <span
        v-for="item in items"
        :key="item.key"
        :style="{ width: `${widths[item.key]}%`, background: item.color }"
        aria-hidden="true"
      />
    </div>

    <dl class="j-stack-labels">
      <div>
        <dt><i style="background: var(--foreground)" /> Liquid, all accounts</dt>
        <dd class="j-num"><MoneyAmount :pesewas="liquidPesewas" size="plain" hide-zero-decimals /></dd>
      </div>
      <div v-for="item in items" :key="item.key">
        <dt><i :style="{ background: item.color }" /> {{ item.label }}</dt>
        <dd v-if="item.amount !== null" class="j-num">
          {{ item.minus ? '−' : '' }}<MoneyAmount :pesewas="item.amount" size="plain" hide-zero-decimals />
        </dd>
      </div>
    </dl>
  </div>
</template>
