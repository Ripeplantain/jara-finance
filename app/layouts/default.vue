<script setup lang="ts">
import { ArrowLeftRight, LayoutDashboard, Settings, Sparkles, Target, Wallet } from 'lucide-vue-next'

// PRD §6.2 — five primary sections, with Settings reachable but not competing
// for space in the primary nav.
const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight },
  { to: '/budgets', label: 'Budgets', icon: Wallet },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/assistant', label: 'Salo', icon: Sparkles }
]
</script>

<template>
  <div class="min-h-dvh bg-background">
    <!-- Desktop sidebar -->
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-border bg-card px-3 py-5 md:flex"
    >
      <NuxtLink to="/" class="mb-6 flex items-center gap-2.5 px-2">
        <span
          class="grid size-9 place-items-center rounded-xl bg-primary font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          S
        </span>
        <span class="text-lg font-semibold tracking-tight">Salo</span>
      </NuxtLink>

      <nav class="flex flex-1 flex-col gap-1" aria-label="Main">
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
          active-class="bg-accent text-accent-foreground"
        >
          <component :is="item.icon" class="size-4.5 shrink-0" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <NuxtLink
        to="/settings"
        class="flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        active-class="bg-accent text-accent-foreground"
      >
        <Settings class="size-4.5 shrink-0" aria-hidden="true" />
        Settings
      </NuxtLink>
    </aside>

    <!-- Mobile header -->
    <header
      class="sticky top-0 z-30 flex items-center justify-between border-b border-border bg-background/85 px-4 py-3 backdrop-blur md:hidden"
    >
      <NuxtLink to="/" class="flex items-center gap-2">
        <span
          class="grid size-8 place-items-center rounded-lg bg-primary text-sm font-semibold text-primary-foreground"
          aria-hidden="true"
        >
          S
        </span>
        <span class="font-semibold tracking-tight">Salo</span>
      </NuxtLink>
      <NuxtLink
        to="/settings"
        class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
        aria-label="Settings"
      >
        <Settings class="size-5" aria-hidden="true" />
      </NuxtLink>
    </header>

    <main class="md:pl-60">
      <div class="mx-auto w-full max-w-5xl px-4 py-6 pb-28 md:px-8 md:py-8 md:pb-10">
        <slot />
      </div>
    </main>

    <!-- Mobile bottom tab bar -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden"
      aria-label="Main"
    >
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium text-muted-foreground transition-colors"
        active-class="text-primary"
      >
        <component :is="item.icon" class="size-5" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
