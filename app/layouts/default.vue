<script setup lang="ts">
import {
  ArrowLeftRight,
  Coins,
  LayoutDashboard,
  Scale,
  Settings,
  Target
} from 'lucide-vue-next'
import { JaraMark, SaloAvatar } from '#components'

const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Money', icon: ArrowLeftRight },
  { to: '/afford', label: 'Afford', icon: Scale },
  { to: '/budgets', label: 'Budget', icon: Coins },
  { to: '/goals', label: 'Goals', icon: Target },
  { to: '/assistant', label: 'Salo', icon: SaloAvatar }
]

const { profile, user } = useCurrentUser()
</script>

<template>
  <div class="min-h-dvh bg-background">
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden w-64 flex-col border-r border-border bg-card/95 md:flex"
    >
      <NuxtLink
        to="/"
        class="flex h-20 items-center gap-3 px-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
      >
        <span class="grid size-10 place-items-center rounded-xl bg-primary text-primary-foreground shadow-sm">
          <JaraMark class="size-6" title="Jara" />
        </span>
        <span>
          <span class="block text-lg font-bold leading-none tracking-tight">Jara</span>
          <span class="mt-1 block text-[11px] font-medium text-muted-foreground">Money, made clear</span>
        </span>
      </NuxtLink>

      <nav class="flex flex-1 flex-col gap-1 px-3 py-5" aria-label="Main">
        <span class="mb-2 px-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground">Overview</span>
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="group flex min-h-11 items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-muted-foreground transition-colors outline-none hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
          active-class="!bg-primary/10 !text-primary"
        >
          <component :is="item.icon" class="size-4.5 shrink-0" aria-hidden="true" />
          {{ item.label }}
          <span class="ml-auto h-4 w-0.5 rounded-full bg-primary opacity-0 group-[.router-link-active]:opacity-100" aria-hidden="true" />
        </NuxtLink>
      </nav>

      <div class="m-3 rounded-xl border border-border bg-muted/50 p-2">
        <NuxtLink
          to="/settings"
          class="flex min-h-12 items-center gap-3 rounded-lg px-2.5 py-2 text-sm outline-none transition-colors hover:bg-card focus-visible:ring-2 focus-visible:ring-ring"
          active-class="bg-card"
        >
          <span class="grid size-8 shrink-0 place-items-center rounded-full bg-primary/12 text-xs font-bold text-primary">
            {{ (profile?.displayName || user?.email || 'J').charAt(0).toUpperCase() }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-semibold">{{ profile?.displayName || 'Settings' }}</span>
            <span class="block truncate text-[11px] text-muted-foreground">{{ user?.email || 'Preferences' }}</span>
          </span>
          <Settings class="size-4 text-muted-foreground" aria-hidden="true" />
        </NuxtLink>
      </div>
    </aside>

    <header class="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-background/90 px-4 backdrop-blur-xl md:hidden">
      <NuxtLink to="/" class="flex min-h-11 items-center gap-2.5 outline-none focus-visible:ring-2 focus-visible:ring-ring">
        <span class="grid size-9 place-items-center rounded-lg bg-primary text-primary-foreground">
          <JaraMark class="size-5.5" title="Jara" />
        </span>
        <span class="font-bold tracking-tight">Jara</span>
      </NuxtLink>
      <NuxtLink
        to="/settings"
        class="grid size-11 place-items-center rounded-full bg-card text-muted-foreground shadow-sm outline-none transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
        aria-label="Settings"
      >
        <Settings class="size-5" aria-hidden="true" />
      </NuxtLink>
    </header>

    <main class="min-h-dvh md:pl-64">
      <div class="mx-auto w-full max-w-7xl px-4 py-6 pb-28 sm:px-6 md:px-10 md:py-10 md:pb-14">
        <slot />
      </div>
    </main>

    <nav
      class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] shadow-[0_-8px_30px_oklch(0.21_0.035_265/0.08)] backdrop-blur-xl md:hidden"
      aria-label="Main"
    >
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="group flex min-h-16 flex-col items-center justify-center gap-1 rounded-lg px-0.5 py-2 text-[10px] font-medium text-muted-foreground outline-none transition-colors focus-visible:bg-muted focus-visible:text-foreground"
        active-class="!text-primary"
      >
        <span class="grid size-8 place-items-center rounded-lg transition-colors group-[.router-link-active]:bg-primary/10">
          <component :is="item.icon" class="size-5" aria-hidden="true" />
        </span>
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
