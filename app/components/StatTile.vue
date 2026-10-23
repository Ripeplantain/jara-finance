<script setup lang="ts">
import type { Component } from 'vue'

/**
 * One line of the ledger: what it is on the left, what it is worth on the right.
 *
 * Deliberately a ruled row and not a tile. A row of equal boxes each holding an
 * icon, a label and a number is the arrangement every finance app ships, and it
 * reads as four unrelated facts; under one rule they read as a column that adds
 * up, which is what they are.
 *
 * (The filename is historical — it renders a row. Renaming it is a follow-up.)
 */
defineProps<{
  label: string
  icon?: Component
  hint?: string
}>()
</script>

<template>
  <div class="flex min-h-24 flex-col justify-between gap-4 border-b border-border px-4 py-4 sm:border-r sm:last:border-r-0">
    <div class="min-w-0">
      <p class="flex items-center gap-2 text-xs font-medium text-muted-foreground">
        <component :is="icon" v-if="icon" class="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
        <span class="truncate">{{ label }}</span>
      </p>
      <p v-if="hint" class="mt-0.5 text-xs leading-snug text-muted-foreground">{{ hint }}</p>
    </div>
    <div class="shrink-0 self-end sm:self-start">
      <slot />
    </div>
  </div>
</template>
