<script setup lang="ts">
import type { Component } from 'vue'

// PRD §6.5 — new users see guidance, never an empty chart.
defineProps<{
  icon?: Component
  title: string
  description: string
}>()
</script>

<template>
  <div
    class="flex flex-col items-center justify-center rounded-xl border border-dashed border-border bg-card px-6 py-12 text-center"
  >
    <div
      v-if="icon"
      class="mb-4 grid size-11 place-items-center rounded-xl bg-accent text-accent-foreground"
      aria-hidden="true"
    >
      <component :is="icon" class="size-5" />
    </div>
    <h2 class="text-base font-semibold">{{ title }}</h2>
    <p class="mt-1.5 max-w-sm text-sm text-muted-foreground">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
