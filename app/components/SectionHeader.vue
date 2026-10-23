<script setup lang="ts">
defineProps<{
  title: string
  description?: string
  meta?: string
}>()
</script>

<template>
  <div class="flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
    <div class="min-w-0">
      <h2 class="text-lg font-semibold tracking-tight">{{ title }}</h2>
      <p v-if="description" class="mt-0.5 max-w-xl text-xs leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <span v-if="meta" class="shrink-0 text-xs text-muted-foreground tabular-nums">{{ meta }}</span>
    <div v-if="$slots.actions" class="ml-auto flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </div>
</template>
