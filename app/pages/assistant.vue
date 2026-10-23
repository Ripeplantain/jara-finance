<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next'

useHead({ title: 'Salo — your finance coach' })
</script>

<template>
  <div>
    <PageHeader title="Salo" description="Ask about your money. Answers come from your own records." />

    <EmptyState
      :icon="Sparkles"
      title="Salo isn't connected yet"
      description="The coach arrives once there's financial data to ground it in. It will only ever answer from what you've actually recorded."
    />
  </div>
</template>
