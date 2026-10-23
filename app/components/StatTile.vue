<script setup lang="ts">
import type { Component } from 'vue'

/** A compact summary surface for one server-provided figure. */
defineProps<{
  label: string
  icon?: Component
  hint?: string
}>()
</script>

<template>
  <div class="app-panel flex min-h-32 flex-col justify-between gap-5 p-4 transition-[transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:[box-shadow:var(--surface-shadow-hover)] motion-reduce:transform-none sm:p-5">
    <div class="min-w-0">
      <p class="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
        <span v-if="icon" class="grid size-8 place-items-center rounded-lg bg-primary/10 text-primary">
          <component :is="icon" class="size-4" aria-hidden="true" />
        </span>
        <span class="truncate">{{ label }}</span>
      </p>
      <p v-if="hint" class="mt-0.5 text-xs leading-snug text-muted-foreground">{{ hint }}</p>
    </div>
    <div class="shrink-0">
      <slot />
    </div>
  </div>
</template>
