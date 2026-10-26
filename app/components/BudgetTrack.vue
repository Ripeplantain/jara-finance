<script setup lang="ts">
import type { BudgetPaceStatus } from '#shared/money/progress'

/**
 * The v1 budget track: a 6px line, a fill, and a fine tick for where the month
 * has got to. Presentational only — every value comes from the server's budget
 * status — and `aria-hidden` unless a `label` is given, because the status is
 * always written out in words beside it.
 */
defineProps<{
  /** 0–100, already clamped by the server. */
  percent: number
  /** 0–100: how much of the month has passed. */
  pacePercent: number
  status: BudgetPaceStatus
  label?: string
}>()
</script>

<template>
  <div
    class="track"
    :role="label ? 'img' : undefined"
    :aria-label="label"
    :aria-hidden="label ? undefined : 'true'"
  >
    <div class="fill" :class="{ 'is-watch': status === 'watch', 'is-over': status === 'over' }" :style="{ width: `${percent}%` }" />
    <div class="tick" :style="{ left: `${pacePercent}%` }" />
  </div>
</template>

<style scoped>
.track {
  --t-tint: var(--tint, #efeae0); --t-champagne: var(--champagne, #c9a46a); --t-clay: var(--clay, #9c4a32);
  position: relative; height: 6px; border-radius: 6px; background: var(--t-tint);
}
:global(.dark) .track { --t-tint: var(--tint, var(--muted)); --t-champagne: var(--champagne, var(--chart-2)); --t-clay: var(--clay, var(--chart-6)); }
.fill { position: absolute; inset: 0 auto 0 0; border-radius: 6px; background: var(--primary); transition: width 0.5s cubic-bezier(0.22, 0.61, 0.36, 1), background 0.3s; }
.fill.is-watch { background: var(--t-champagne); }
.fill.is-over { background: var(--t-clay); }
.tick { position: absolute; top: -5px; bottom: -5px; width: 2px; border-radius: 2px; background: var(--foreground); transition: left 0.4s cubic-bezier(0.22, 0.61, 0.36, 1); }
@media (prefers-reduced-motion: reduce) { .fill, .tick { transition: none; } }
</style>
