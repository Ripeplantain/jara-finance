<script setup lang="ts">
import { Target } from 'lucide-vue-next'

useHead({ title: 'Goals — Salo' })
</script>

<template>
  <div>
    <PageHeader title="Goals" description="What you're saving towards." />

    <EmptyState
      :icon="Target"
      title="Set a savings goal and start making progress"
      description="Name a target and a date, and Salo will work out how much to put aside each month."
    />
  </div>
</template>
