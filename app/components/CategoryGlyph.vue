<script setup lang="ts">
import type { Component } from 'vue'
import {
  ArrowLeftRight,
  Banknote,
  Bus,
  CircleMinus,
  CirclePlus,
  CircleQuestionMark,
  GraduationCap,
  Gift,
  HandHeart,
  HeartPulse,
  House,
  Laptop,
  Music,
  Receipt,
  Shirt,
  ShoppingBasket,
  Smartphone,
  Sparkles,
  Store,
  Users,
  Zap
} from 'lucide-vue-next'

/**
 * A category's icon in its own colour, read from the category row itself.
 *
 * The names are the `icon` values in `server/database/seed-data.ts`. A name this
 * map does not know, or a row with no category, falls back to a neutral mark
 * rather than rendering nothing: an empty circle in a ledger reads as a bug.
 * `transfer` has no category and is deliberately neutral, never income-coloured.
 */
const props = withDefaults(
  defineProps<{
    icon?: string | null
    /** 1–6, the `--cN` ramp index stored on the category. */
    colorIndex?: number | null
    transfer?: boolean
    size?: 'sm' | 'md'
  }>(),
  { icon: null, colorIndex: null, transfer: false, size: 'md' }
)

const ICONS: Record<string, Component> = {
  banknote: Banknote,
  store: Store,
  laptop: Laptop,
  gift: Gift,
  'circle-plus': CirclePlus,
  'shopping-basket': ShoppingBasket,
  bus: Bus,
  house: House,
  zap: Zap,
  smartphone: Smartphone,
  'heart-pulse': HeartPulse,
  'graduation-cap': GraduationCap,
  users: Users,
  music: Music,
  shirt: Shirt,
  sparkles: Sparkles,
  receipt: Receipt,
  'hand-heart': HandHeart,
  'circle-minus': CircleMinus,
  'circle-help': CircleQuestionMark
}

const glyph = computed<Component>(() => {
  if (props.transfer) return ArrowLeftRight
  return (props.icon && ICONS[props.icon]) || CircleQuestionMark
})

const color = computed(() => {
  if (props.transfer || !props.colorIndex) return 'var(--muted-foreground)'
  return `var(--c${((props.colorIndex - 1) % 6) + 1})`
})
</script>

<template>
  <span class="j-glyph" :class="{ 'is-sm': size === 'sm' }" :style="{ '--g': color }" aria-hidden="true">
    <component :is="glyph" :size="size === 'sm' ? 15 : 17" :stroke-width="1.7" />
  </span>
</template>
