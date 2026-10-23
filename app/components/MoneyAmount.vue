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
     * exist so the tally field and the figures beside it carry one colour
     * language.
     */
    tone?: 'auto' | 'income' | 'expense' | 'neutral' | 'warning' | 'saving'
    size?: 'sm' | 'base' | 'lg' | 'xl'
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

const sizeClass = {
  sm: 'text-sm',
  base: 'text-base',
  lg: 'text-xl font-semibold tracking-tight',
  xl: 'text-4xl font-semibold tracking-tight sm:text-[2.75rem]'
}
</script>

<template>
  <span class="tabular-nums" :class="[toneClass, sizeClass[size]]">{{ text }}</span>
</template>
