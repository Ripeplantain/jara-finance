<script setup lang="ts">
/**
 * The Jara mark.
 *
 * Built in adinkra's grammar rather than copying any one adinkra symbol: a
 * square stamp block, strict two-fold rotational symmetry, meaning carried by
 * bold positive and negative space. Two diagonal quarters are inked and two are
 * open — what is promised and what is yours — and the coin is bitten clean out
 * of the point where the two meet, because that junction is the only figure
 * this product actually computes.
 *
 * One `currentColor` path, so it sits on the shell, on stock, or in either
 * theme with no variant. The void is a real mask rather than a filled disc, so
 * whatever is behind the mark shows through it. Three moves; it still resolves
 * at 16px.
 */
withDefaults(defineProps<{ title?: string }>(), { title: undefined })

// Masks are referenced by id, so two marks on one page need two of them.
const maskId = `salo-mark-${useId()}`
</script>

<template>
  <svg
    viewBox="0 0 48 48"
    fill="none"
    :role="title ? 'img' : undefined"
    :aria-hidden="title ? undefined : true"
  >
    <title v-if="title">{{ title }}</title>

    <mask :id="maskId">
      <rect width="48" height="48" fill="white" />
      <circle cx="24" cy="24" r="9.5" fill="black" />
    </mask>

    <!-- promised, and yours: inked on the diagonal -->
    <path
      :mask="`url(#${maskId})`"
      fill="currentColor"
      d="M3 3H24V24H3V3ZM24 24H45V45H24V24Z"
    />

    <!-- the coin, struck where the two meet -->
    <circle cx="24" cy="24" r="7" stroke="currentColor" stroke-width="3.25" />
  </svg>
</template>
