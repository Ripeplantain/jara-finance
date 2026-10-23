<script setup lang="ts">
import { Settings } from 'lucide-vue-next'

useHead({ title: 'Settings — Salo' })
</script>

<template>
  <div>
    <PageHeader title="Settings" description="Your profile, preferences and data." />

    <EmptyState
      :icon="Settings"
      title="Nothing to configure yet"
      description="Profile, currency, timezone, data export and account deletion land with authentication."
    />
  </div>
</template>
