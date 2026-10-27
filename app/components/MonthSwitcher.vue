<script setup lang="ts">
import { ChevronLeft, ChevronRight } from 'lucide-vue-next'
import { addMonths, type IsoDate } from '#shared/period/month'

/**
 * Previous / next month around the month's name. Pure control: the page owns
 * which month it is (see `useSelectedMonth`) and what to fetch for it.
 */
const props = defineProps<{
  /** First day of the month on show. */
  modelValue: IsoDate
  /** First day of the latest month that can be reached. */
  max: IsoDate
  /** First day of the current month, which gets a quick way back. */
  current: IsoDate
}>()
const emit = defineEmits<{ 'update:modelValue': [month: IsoDate] }>()

const label = computed(() => formatMonthHeading(props.modelValue))
const atLatest = computed(() => props.modelValue >= props.max)
const isCurrent = computed(() => props.modelValue === props.current)

const step = (by: number) => emit('update:modelValue', addMonths(props.modelValue, by))
</script>

<template>
  <div class="j-month-switch" role="group" aria-label="Month">
    <button type="button" class="j-icon-link j-month-step" aria-label="Previous month" @click="step(-1)">
      <ChevronLeft :size="18" aria-hidden="true" />
    </button>
    <!-- Announced when it changes, so the switch is not silent for a screen reader. -->
    <span class="j-month-name" aria-live="polite">{{ label }}</span>
    <button
      type="button"
      class="j-icon-link j-month-step"
      aria-label="Next month"
      :disabled="atLatest"
      @click="step(1)"
    >
      <ChevronRight :size="18" aria-hidden="true" />
    </button>
    <button v-if="!isCurrent" type="button" class="j-link j-month-now" @click="emit('update:modelValue', current)">
      Back to this month
    </button>
  </div>
</template>
