<script setup lang="ts">
/** Visual allocation of server-provided affordability inputs. */
const props = withDefaults(
  defineProps<{
    liquidPesewas: number
    committedSavingsPesewas: number
    remainingBudgetedPesewas: number
    pricePesewas?: number
    animate?: boolean
  }>(),
  { pricePesewas: 0, animate: false }
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
  { key: 'goals' as const, label: 'Promised to goals', amount: props.committedSavingsPesewas, class: 'bg-saving' },
  { key: 'budgets' as const, label: 'Budgeted', amount: props.remainingBudgetedPesewas, class: 'funds-pattern' },
  ...(props.pricePesewas > 0
    ? [{ key: 'purchase' as const, label: 'This purchase', amount: props.pricePesewas, class: 'bg-foreground' }]
    : []),
  { key: 'available' as const, label: 'Available', amount: null, class: 'bg-income' }
])
</script>

<template>
  <div>
    <div class="flex items-start justify-between gap-4">
      <div>
        <h2 class="text-sm font-semibold">How your money is allocated</h2>
        <p class="mt-1 text-xs text-muted-foreground">Every segment is part of what is currently in hand.</p>
      </div>
      <span class="shrink-0 rounded-full bg-secondary px-2.5 py-1 text-[11px] font-semibold text-secondary-foreground">
        Live view
      </span>
    </div>

    <div
      class="mt-6 flex h-5 w-full overflow-hidden rounded-full bg-muted ring-1 ring-inset ring-border"
      role="img"
      :aria-label="ariaLabel"
    >
      <span
        v-for="item in items"
        :key="item.key"
        class="h-full min-w-0 transition-[width] duration-500 ease-out motion-reduce:transition-none"
        :class="item.class"
        :style="{ width: `${widths[item.key]}%` }"
        aria-hidden="true"
      />
    </div>

    <dl class="mt-5 grid gap-3 sm:grid-cols-2">
      <div v-for="item in items" :key="item.key" class="flex items-center gap-3 rounded-lg bg-muted/55 px-3 py-2.5">
        <span class="size-2.5 shrink-0 rounded-full" :class="item.class" aria-hidden="true" />
        <dt class="min-w-0 flex-1 truncate text-xs text-muted-foreground">{{ item.label }}</dt>
        <dd v-if="item.amount !== null"><MoneyAmount :pesewas="item.amount" size="sm" /></dd>
      </div>
    </dl>
  </div>
</template>

<style scoped>
.funds-pattern {
  background-color: var(--primary);
  background-image: repeating-linear-gradient(
    135deg,
    transparent 0 5px,
    color-mix(in oklab, var(--primary-foreground) 35%, transparent) 5px 7px
  );
}
</style>
