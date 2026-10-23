<script setup lang="ts">
import { use } from 'echarts/core'
import { PieChart } from 'echarts/charts'
import { LegendComponent, TooltipComponent } from 'echarts/components'
import { CanvasRenderer } from 'echarts/renderers'
import VChart from 'vue-echarts'
import { formatPesewas } from '#shared/money/format'

/**
 * Spending by category.
 *
 * Registered piecemeal rather than importing all of ECharts: the full bundle is
 * well over 1MB and this chart needs a pie, a tooltip and a legend.
 *
 * `.client.vue` because ECharts measures the DOM to lay itself out, so there is
 * nothing useful to render on the server.
 *
 * Colours come from the `--chart-N` tokens via each category's `colorIndex`,
 * which is why a custom category can never introduce a colour from outside the
 * design system.
 */
use([PieChart, TooltipComponent, LegendComponent, CanvasRenderer])

const props = defineProps<{
  categories: Array<{
    name: string
    amountPesewas: number
    colorIndex: number
    percentOfTotal: number
  }>
  currency: string
}>()

// ECharts needs real colour values, not CSS variables, so the tokens are read
// off the document once the component mounts — and re-read when the theme
// changes, which is what keeps the chart correct in dark mode.
const palette = ref<string[]>([])
// The legend's own text has to follow the theme too, or it stays black on the
// dark card where ECharts puts its default.
const foreground = ref('')
const cardColour = ref('')

function readPalette() {
  const styles = getComputedStyle(document.documentElement)
  palette.value = Array.from({ length: 6 }, (_, index) =>
    styles.getPropertyValue(`--chart-${index + 1}`).trim()
  )
  foreground.value = styles.getPropertyValue('--muted-foreground').trim()
  cardColour.value = styles.getPropertyValue('--card').trim()
}

let themeObserver: MutationObserver | undefined

onMounted(() => {
  readPalette()
  themeObserver = new MutationObserver(readPalette)
  themeObserver.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['class']
  })
})

onUnmounted(() => themeObserver?.disconnect())

const option = computed(() => ({
  tooltip: {
    trigger: 'item',
    formatter: (params: { name: string, value: number, percent: number }) =>
      `${params.name}<br/><strong>${formatPesewas(params.value, { currency: props.currency })}</strong> · ${params.percent}%`
  },
  /*
    No legend. The list beneath this chart already names every category
    with its swatch, its share and its amount — a scrolling legend above it said
    the same thing worse, six entries at a time, and cost the section a band of
    dead space.
  */
  legend: { show: false },
  series: [
    {
      type: 'pie',
      // A donut, not a pie: the hole makes the slice angles easier to compare
      // and leaves room for nothing, which is better than a crowded centre.
      radius: ['52%', '78%'],
      center: ['50%', '50%'],
      avoidLabelOverlap: true,
      label: { show: false },
      labelLine: { show: false },
      // The gap between slices is the card showing through, so the ring reads
      // as separate clear arcs rather than one blended band.
      itemStyle: { borderWidth: 2, borderColor: cardColour.value },
      data: props.categories.map(category => ({
        name: category.name,
        value: category.amountPesewas,
        itemStyle: {
          color: palette.value[(category.colorIndex - 1) % 6] || palette.value[0]
        }
      }))
    }
  ]
}))
</script>

<template>
  <!--
    Height is set inline, not with a utility class. vue-echarts ships its own
    `height` rule for the `x-vue-echarts` host element and it wins over a
    Tailwind `h-*` class, which left a 550px-tall host wrapped around a 275px
    canvas and a band of dead space under the chart.
  -->
  <VChart :option="option" autoresize :style="{ height: '14rem', width: '100%' }" />
</template>
