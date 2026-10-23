<script setup lang="ts">
import { Wallet } from 'lucide-vue-next'

useHead({ title: 'Budgets — Salo' })
</script>

<template>
  <div>
    <PageHeader title="Budgets" description="Plan what you'll spend, then watch it." />

    <EmptyState
      :icon="Wallet"
      title="Create a budget to plan your monthly spending"
      description="Set a limit per category and Salo will track what's left, warning you before you go over."
    />
  </div>
</template>
