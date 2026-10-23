<script setup lang="ts">
/**
 * The tally field — Jara's signature move.
 *
 * A susu card records money by striking cells, and that is exactly the shape of
 * the affordability formula: what you hold, minus what is already promised,
 * leaves what is actually yours. Drawing it as one field of equal cells makes
 * the subtraction visible in a way three stacked figures never do.
 *
 * Cell states, and the ink each one carries:
 *   struck (oxblood)  money transferred into a goal — gone, by your own choice,
 *                     and struck in the collector's own stamp ink
 *   hatched (green)   budgeted and not yet spent — committed without leaving
 *   taken (full ink)  what the purchase being considered would take
 *   open              yours
 *
 * Weight follows the figure, not the category: the purchase under consideration
 * is the heaviest mark on the field, because it is the only quantity the user
 * is deciding about. A pale wash there let five struck cells outweigh fifteen
 * taken ones, which inverted the whole point of the screen.
 *
 * Every state carries a shape as well as a colour — a strike, a hatch, a solid
 * — so the field is readable without colour at all.
 *
 * An open cell takes the page's own ground rather than `--card`: card is
 * *lighter* than the page in dark mode, which made "yours" read as a filled
 * cell instead of an empty one.
 *
 * This component derives no financial figure. It is handed pesewa quantities
 * the server already computed and only chooses how many squares represent
 * them; every figure on screen is rendered by `MoneyAmount` from those same
 * server values.
 */
const props = withDefaults(
  defineProps<{
    liquidPesewas: number
    committedSavingsPesewas: number
    remainingBudgetedPesewas: number
    /** The purchase under consideration, if one has been entered. */
    pricePesewas?: number
    /** Stagger the cells in as they are stamped. */
    animate?: boolean
  }>(),
  { pricePesewas: 0, animate: false }
)

/**
 * Cell size, in pesewas.
 *
 * Chosen so the field stays countable — a wall of two hundred squares is a
 * texture, not a tally. The ramp is round cedi amounts so the unit is something
 * a person can say out loud.
 */
const UNIT_RAMP = [1000, 2000, 5000, 10_000, 20_000, 50_000, 100_000, 200_000, 500_000]
const MAX_CELLS = 40

const unitPesewas = computed(() => {
  const total = Math.max(props.liquidPesewas, 0)
  return (
    UNIT_RAMP.find(unit => Math.ceil(total / unit) <= MAX_CELLS)
    ?? UNIT_RAMP[UNIT_RAMP.length - 1]!
  )
})

const unitLabel = computed(() => `GH₵${(unitPesewas.value / 100).toLocaleString('en-GH')}`)

type CellState = 'struck' | 'hatched' | 'open' | 'taken'

const cells = computed<CellState[]>(() => {
  const unit = unitPesewas.value
  const total = Math.ceil(Math.max(props.liquidPesewas, 0) / unit)
  if (total === 0) return []

  const struck = Math.min(total, Math.round(Math.max(props.committedSavingsPesewas, 0) / unit))
  const hatched = Math.min(
    total - struck,
    Math.round(Math.max(props.remainingBudgetedPesewas, 0) / unit)
  )
  const open = total - struck - hatched
  // The purchase eats into the open cells from the far end, so the cells that
  // survive it are the ones at the end of the row — what is left, read last.
  const taken = Math.min(open, Math.round(Math.max(props.pricePesewas, 0) / unit))

  return [
    ...Array<CellState>(struck).fill('struck'),
    ...Array<CellState>(hatched).fill('hatched'),
    ...Array<CellState>(taken).fill('taken'),
    ...Array<CellState>(open - taken).fill('open')
  ]
})

const counts = computed(() => ({
  struck: cells.value.filter(c => c === 'struck').length,
  hatched: cells.value.filter(c => c === 'hatched').length,
  taken: cells.value.filter(c => c === 'taken').length,
  open: cells.value.filter(c => c === 'open').length
}))

const label = computed(() => {
  const { struck, hatched, taken, open } = counts.value
  const parts = [
    `${cells.value.length} cells of ${unitLabel.value}, one for each ${unitLabel.value} you hold`,
    `${struck} promised to goals`,
    `${hatched} budgeted and not yet spent`
  ]
  if (taken > 0) parts.push(`${taken} this purchase would take`)
  parts.push(`${open} yours to spend`)
  return `${parts.join(', ')}.`
})
</script>

<template>
  <div>
    <div class="flex items-baseline justify-between gap-3">
      <h2 class="text-sm font-semibold">Your month, one cell per {{ unitLabel }}</h2>
      <span class="shrink-0 text-xs text-muted-foreground tabular-nums">
        {{ cells.length }} cells
      </span>
    </div>

    <div
      v-if="cells.length"
      class="mt-2.5 grid grid-cols-8 gap-1 sm:grid-cols-10 lg:grid-cols-7"
      role="img"
      :aria-label="label"
    >
      <span
        v-for="(state, index) in cells"
        :key="index"
        class="aspect-square border"
        :class="[
          {
            struck: 'border-expense bg-expense',
            hatched: 'cell-hatched border-primary',
            taken: 'border-foreground bg-foreground',
            open: 'border-input bg-card dark:bg-background'
          }[state],
          animate ? 'motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-75' : ''
        ]"
        :style="animate ? { animationDelay: `${Math.min(index * 18, 520)}ms` } : undefined"
      >
        <!-- a struck cell carries the strike itself, not just a colour -->
        <svg
          v-if="state === 'struck'"
          viewBox="0 0 10 10"
          class="size-full text-expense-foreground/75"
          aria-hidden="true"
        >
          <path d="M2 2 8 8M8 2 2 8" stroke="currentColor" stroke-width="1.4" />
        </svg>
      </span>
    </div>

    <p v-else class="mt-3 border border-dashed border-border bg-card px-4 py-6 text-center text-sm text-muted-foreground">
      Nothing to tally yet — record what you hold and the field fills in.
    </p>
  </div>
</template>
