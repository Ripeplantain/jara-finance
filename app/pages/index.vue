<script setup lang="ts">
import { PlusCircle } from 'lucide-vue-next'

useHead({ title: 'Dashboard — Salo' })
</script>

<template>
  <div>
    <PageHeader title="Dashboard" description="Your money at a glance." />

    <EmptyState
      :icon="PlusCircle"
      title="Add your first transaction to start tracking your money"
      description="Once you record some income and expenses, Salo will show your balance, spending breakdown, budget progress and savings goals here."
    />
  </div>
</template>
