<script setup lang="ts">
import { ArrowLeftRight } from 'lucide-vue-next'

useHead({ title: 'Transactions — Salo' })
</script>

<template>
  <div>
    <PageHeader title="Transactions" description="Every cedi in and out." />

    <EmptyState
      :icon="ArrowLeftRight"
      title="No transactions yet"
      description="Record income and expenses to build an accurate picture of where your money goes."
    />
  </div>
</template>
