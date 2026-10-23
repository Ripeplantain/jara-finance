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
    class="app-panel flex min-h-72 flex-col items-center justify-center border-dashed px-6 py-14 text-center"
  >
    <div
      v-if="icon"
      class="mb-5 grid size-12 place-items-center border border-shell-border bg-shell text-shell-foreground"
      aria-hidden="true"
    >
      <component :is="icon" class="size-5" />
    </div>
    <h2 class="text-lg font-semibold tracking-tight">{{ title }}</h2>
    <p class="mt-2 max-w-md text-sm leading-relaxed text-muted-foreground">{{ description }}</p>
    <div v-if="$slots.default" class="mt-5">
      <slot />
    </div>
  </div>
</template>
