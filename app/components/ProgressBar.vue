<script setup lang="ts">
/**
 * A progress bar that knows the difference between "a lot" and "too much".
 *
 * `over` is passed in rather than inferred from the percentage, because the
 * caller has already computed it with `deriveProgress` — and a bar that
 * re-derives its own state is a second source of truth waiting to disagree
 * with the number printed beside it.
 *
 * The rounded track stays quiet so pace and state carry the meaning.
 */
const props = withDefaults(
  defineProps<{
    /** 0–100, already clamped by `deriveProgress`. */
    percent: number
    over?: boolean
    /** Ahead of where the period's elapsed time suggests it should be. */
    warning?: boolean
    /**
     * Where the period itself has got to, 0–100. Drawn as a standing rule, so
     * "spending faster than the month is passing" is visible rather than only
     * stated underneath.
     */
    pacePercent?: number
    tone?: 'primary' | 'saving'
    label?: string
  }>(),
  { over: false, warning: false, pacePercent: undefined, tone: 'primary', label: undefined }
)

const barClass = computed(() => {
  if (props.over) return 'bg-expense'
  if (props.warning) return 'bg-warning'
  return props.tone === 'saving' ? 'bg-saving' : 'bg-primary'
})
</script>

<template>
  <div class="relative h-2.5 w-full overflow-visible rounded-full bg-muted ring-1 ring-inset ring-border">
    <div
      class="h-full rounded-full transition-[width] duration-500 ease-out motion-reduce:transition-none"
      role="progressbar"
      :class="barClass"
      :style="{ width: `${percent}%` }"
      :aria-valuenow="Math.round(percent)"
      aria-valuemin="0"
      aria-valuemax="100"
      :aria-label="label"
    />
    <!--
      The pace rule stands proud of the bar at both ends, like a tick on a
      ruler. Drawn inside the track it vanished against a dark fill; drawn
      through it, it reads against the fill, the empty track and the page.
    -->
    <span
      v-if="pacePercent !== undefined"
      class="absolute -inset-y-1 w-0.5 rounded-full bg-foreground"
      :style="{ left: `calc(${Math.min(Math.max(pacePercent, 0), 100)}% - 1px)` }"
      aria-hidden="true"
    />
  </div>
</template>
