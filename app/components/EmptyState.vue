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
    class="app-panel flex min-h-72 flex-col items-center justify-center px-6 py-14 text-center"
  >
    <div
      v-if="icon"
      class="mb-5 grid size-14 place-items-center rounded-2xl bg-primary/10 text-primary"
      aria-hidden="true"
    >
      <component :is="icon" class="size-5" />
    </div>
    <h2 class="text-xl font-semibold tracking-tight">{{ title }}</h2>
    <p class="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
