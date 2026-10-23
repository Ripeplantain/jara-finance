<script setup lang="ts">
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
    <rect x="5" y="7" width="38" height="32" rx="16" fill="currentColor" opacity="0.14" />
    <path
      d="M15 24c0-5.2 4-9 9-9s9 3.8 9 9-4 9-9 9h-7.2l-4.4 4 .9-6.5A8.8 8.8 0 0 1 15 24Z"
      fill="currentColor"
    />
    <circle cx="21" cy="24" r="1.5" fill="var(--card)" />
    <circle cx="27" cy="24" r="1.5" fill="var(--card)" />
  </svg>
</template>
