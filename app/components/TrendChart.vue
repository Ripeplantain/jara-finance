<script setup lang="ts">
/**
 * The one chart: smooth lines with direct end labels, a scrubbable cursor and a
 * readout. Ported from the v1 preview. Values are integer pesewas from the
 * server; the only arithmetic here is where to draw them.
 */
export interface TrendLine {
  key: string
  label: string
  values: number[]
  tone: 'accent' | 'champagne'
  fill?: boolean
}

const props = withDefaults(defineProps<{
  labels: string[]
  lines: TrendLine[]
  active: number | null
  format: (pesewas: number) => string
  /** Text equivalent of the chart for assistive tech. */
  summary: string
  /** Show every nth axis label (the last is always shown). */
  labelEvery?: number
  /** Heading for the readout, per index (e.g. "October", "Day 12"). */
  pointLabel?: (index: number) => string
}>(), { labelEvery: 1, pointLabel: undefined })

const emit = defineEmits<{ 'update:active': [index: number | null] }>()

const uid = useId()
const TONE: Record<TrendLine['tone'], string> = {
  accent: 'var(--primary)',
  champagne: 'var(--champagne-ink)'
}

const count = computed(() => props.labels.length)
const maxValue = computed(() => Math.max(1, ...props.lines.flatMap(line => line.values)) * 1.08)

const xAt = (index: number) => 2 + (index / Math.max(1, count.value - 1)) * 96
const yAt = (value: number) => 94 - (value / maxValue.value) * 84

// Catmull-Rom spline turned into cubic Béziers: smooth without overshooting wildly.
function curve(values: number[]): string {
  const pts = values.map((value, index) => [xAt(index), yAt(value)] as const)
  if (pts.length < 2) return ''
  let d = `M${pts[0]![0]},${pts[0]![1]}`
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i]!
    const p1 = pts[i]!
    const p2 = pts[i + 1]!
    const p3 = pts[i + 2] ?? p2
    const c1x = p1[0] + (p2[0] - p0[0]) / 6
    const c1y = p1[1] + (p2[1] - p0[1]) / 6
    const c2x = p2[0] - (p3[0] - p1[0]) / 6
    const c2y = p2[1] - (p3[1] - p1[1]) / 6
    d += ` C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0]},${p2[1]}`
  }
  return d
}

const paths = computed(() => props.lines.map((line) => {
  const d = curve(line.values)
  return { line, d, area: `${d} L${xAt(count.value - 1)},100 L${xAt(0)},100 Z` }
}))

// Direct end labels, nudged apart so neighbours never collide.
const endLabels = computed(() => {
  const items = props.lines
    .map(line => ({ line, y: yAt(line.values[line.values.length - 1] ?? 0) }))
    .sort((a, b) => a.y - b.y)
  const gap = 22
  for (let i = 1; i < items.length; i++) {
    if (items[i]!.y - items[i - 1]!.y < gap) items[i]!.y = items[i - 1]!.y + gap
  }
  return items
})

const axisIdx = computed(() =>
  props.labels.map((_, index) => index).filter(index => index % props.labelEvery === 0 || index === count.value - 1)
)

function onPointer(event: PointerEvent) {
  const box = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const pct = ((event.clientX - box.left) / box.width) * 100
  const index = Math.round(((pct - 2) / 96) * (count.value - 1))
  emit('update:active', Math.min(count.value - 1, Math.max(0, index)))
}
</script>

<template>
  <div class="j-chart">
    <div class="j-chart-grid">
      <div class="j-plot" @pointermove="onPointer" @pointerdown="onPointer">
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" role="img" :aria-label="summary">
          <title>{{ summary }}</title>
          <defs>
            <linearGradient v-for="item in paths" :id="`${uid}-${item.line.key}`" :key="item.line.key" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0" :stop-color="TONE[item.line.tone]" stop-opacity="0.2" />
              <stop offset="1" :stop-color="TONE[item.line.tone]" stop-opacity="0" />
            </linearGradient>
          </defs>
          <line class="base" x1="0" y1="100" x2="100" y2="100" />
          <template v-for="item in paths" :key="item.line.key">
            <path v-if="item.line.fill" :d="item.area" :fill="`url(#${uid}-${item.line.key})`" />
            <path class="ln" :d="item.d" :stroke="TONE[item.line.tone]" />
          </template>
        </svg>
        <template v-if="active !== null">
          <span class="cursor" :style="{ left: `${xAt(active)}%` }" />
          <span
            v-for="line in lines"
            :key="line.key"
            class="dot"
            :style="{ left: `${xAt(active)}%`, top: `${yAt(line.values[active] ?? 0)}%`, color: TONE[line.tone] }"
          />
        </template>
      </div>
      <div class="j-endlabels" aria-hidden="true">
        <div
          v-for="item in endLabels"
          :key="item.line.key"
          class="j-endlabel"
          :style="{ top: `${item.y}%`, color: TONE[item.line.tone] }"
        >
          <b>{{ item.line.label }}</b>
          <span class="j-num" style="color: var(--foreground)">{{ format(item.line.values[item.line.values.length - 1] ?? 0) }}</span>
        </div>
      </div>
    </div>
    <div class="j-chart-axis">
      <div class="j-axis-row" role="group" aria-label="Choose a point on the chart">
        <button
          v-for="index in axisIdx"
          :key="index"
          type="button"
          :style="{ left: `${xAt(index)}%` }"
          :aria-pressed="active === index"
          @click="emit('update:active', index)"
        >
          {{ labels[index] }}
        </button>
      </div>
      <span />
    </div>
    <p class="j-sr">{{ summary }}</p>
    <div class="j-readout j-num" aria-live="polite">
      <template v-if="active !== null">
        <strong>{{ pointLabel ? pointLabel(active) : labels[active] }}</strong>
        <span v-for="line in lines" :key="line.key">{{ line.label }} {{ format(line.values[active] ?? 0) }}</span>
      </template>
      <span v-else>Choose a point on the chart to read its values.</span>
    </div>
  </div>
</template>
