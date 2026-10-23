<script setup lang="ts">
/** Jara's open loop: one clear view of money, with room to move forward. */
withDefaults(defineProps<{ title?: string }>(), { title: undefined })
</script>

<template>
  <svg
    viewBox="0 0 48 48"
    fill="none"
    :role="title ? 'img' : undefined"
    :aria-hidden="title ? undefined : true"
  >
    <title v-if="title">{{ title }}</title>
    <path
      d="M35.5 7.5H24C14.9 7.5 8 14.2 8 23.4S14.7 40.5 24 40.5c8.5 0 15-5.9 15-14.6V17"
      stroke="currentColor"
      stroke-width="7"
      stroke-linecap="round"
    />
    <path
      d="M39 7.5v9.8c0 6.1-4.8 10.9-11 10.9h-5.4"
      stroke="currentColor"
      stroke-width="7"
      stroke-linecap="round"
      stroke-linejoin="round"
      opacity="0.44"
    />
    <circle cx="39" cy="7.5" r="3.5" fill="var(--aqua)" />
  </svg>
</template>
