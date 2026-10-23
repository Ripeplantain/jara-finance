<script setup lang="ts">
defineProps<{
  title: string
  description?: string
}>()
</script>

<template>
  <header class="mb-8 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
    <div class="min-w-0">
      <h1 class="text-[1.85rem] font-bold leading-none tracking-[-0.035em] sm:text-4xl">{{ title }}</h1>
      <p v-if="description" class="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
        {{ description }}
      </p>
    </div>
    <div v-if="$slots.actions" class="flex shrink-0 items-center gap-2">
      <slot name="actions" />
    </div>
  </header>
</template>
