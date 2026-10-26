<script setup lang="ts">
import { formatPesewas, formatSignedPesewas } from '#shared/money/format'

/**
 * The only way money is rendered.
 *
 * Direction is expressed with the `--income` / `--expense` design tokens rather
 * than ad-hoc colour classes, because money direction is meaning, not
 * decoration. `tabular-nums` keeps columns of figures aligned.
 */
const props = withDefaults(
  defineProps<{
    pesewas: number
    /** Show an explicit + / − and colour by direction. */
    signed?: boolean
    /**
     * Colour by direction without forcing a sign. `warning` and `saving` are
     * not directions — they mark money that is committed rather than moved, and
     * exist so the funds map and the figures beside it carry one colour
     * language.
     */
    tone?: 'auto' | 'income' | 'expense' | 'neutral' | 'warning' | 'saving'
    size?: 'sm' | 'base' | 'md' | 'plain' | 'lg' | 'xl' | 'display'
    currency?: string
    hideZeroDecimals?: boolean
  }>(),
  { signed: false, tone: 'neutral', size: 'base', currency: 'GHS', hideZeroDecimals: false }
)

const { currency: userCurrency } = useCurrentUser()

const text = computed(() => {
  const options = {
    currency: props.currency === 'GHS' ? userCurrency.value : props.currency,
    hideZeroDecimals: props.hideZeroDecimals
  }
  return props.signed
    ? formatSignedPesewas(props.pesewas, options)
    : formatPesewas(props.pesewas, options)
})

const toneClass = computed(() => {
  const resolved
    = props.tone === 'auto'
      ? props.pesewas > 0
        ? 'income'
        : props.pesewas < 0
          ? 'expense'
          : 'neutral'
      : props.tone

  return {
    income: 'text-income',
    expense: 'text-expense',
    warning: 'text-warning',
    saving: 'text-saving',
    neutral: ''
  }[resolved]
})

// `plain` takes its size from the parent, for figures set inside a styled `dd`.
// `md`, `xl` and `display` are v1's serif figure treatments (v1.css):
// Fraunces for figures that are the point of a section rather than a cell in a
// table. `display` also sets the currency symbol smaller, in champagne-ink.
const sizeClass = {
  sm: 'text-sm',
  base: 'text-base',
  md: 'j-fig-md',
  plain: '',
  lg: 'text-xl font-semibold tracking-tight',
  xl: 'j-fig-xl',
  display: 'j-hero-fig'
}

// Splits "-GH₵1,234.50" into the symbol and the rest, keeping the sign with the
// digits so a negative balance still reads as one figure.
const parts = computed(() => {
  const firstDigit = text.value.search(/\d/)
  if (firstDigit <= 0) return { cur: '', rest: text.value }
  const prefix = text.value.slice(0, firstDigit)
  const sign = prefix.match(/^[-−+]/)?.[0] ?? ''
  return { cur: prefix.slice(sign.length), rest: sign + text.value.slice(firstDigit) }
})
</script>

<template>
  <span v-if="size === 'display'" :class="sizeClass.display"><span class="cur">{{ parts.cur }}</span>{{ parts.rest }}</span>
  <span v-else class="tabular-nums" :class="[toneClass, sizeClass[size]]">{{ text }}</span>
</template>
