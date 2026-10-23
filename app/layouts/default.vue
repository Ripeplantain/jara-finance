<script setup lang="ts">
import {
  ArrowLeftRight,
  Coins,
  LayoutDashboard,
  Scale,
  Settings,
  Target
} from 'lucide-vue-next'
// Auto-imports cover templates; using a component as a value needs the import.
import { SaloMark } from '#components'

/**
 * The shell.
 *
 * Every surface in Jara is pale ruled stock; this is the one that is not. The
 * rail and the tab bar are inked in `--shell`, which is what makes the stock
 * read as a card laid on a table rather than as a page background.
 *
 * PRD §6.2 named five primary sections. Afford is the sixth and sits in the
 * middle of the tab bar, because it is the question the product exists to
 * answer and the one a user opens the app mid-decision to ask. Settings stays
 * reachable without competing for a slot.
 */
const navItems = [
  { to: '/', label: 'Home', icon: LayoutDashboard },
  { to: '/transactions', label: 'Money', icon: ArrowLeftRight },
  { to: '/afford', label: 'Afford', icon: Scale },
  { to: '/budgets', label: 'Budget', icon: Coins },
  { to: '/goals', label: 'Goals', icon: Target },
  // The coach is Salo, and it carries the Jara mark. The four-point sparkle is
  // the house style of AI hype, which is the register this audience distrusts.
  { to: '/assistant', label: 'Salo', icon: SaloMark }
]

const { profile, user } = useCurrentUser()
</script>

<template>
  <div class="min-h-dvh bg-background">
    <!-- Desktop rail -->
    <aside
      class="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-shell-border bg-shell text-shell-foreground md:flex"
    >
      <NuxtLink
        to="/"
        class="flex h-20 items-center gap-3 border-b border-shell-border px-5 outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-shell-foreground"
      >
        <SaloMark class="size-8 shrink-0" title="Jara" />
        <span>
          <span class="block text-lg font-semibold leading-none tracking-tight">Jara</span>
          <span class="mt-1 block text-[11px] text-shell-muted">Personal finance</span>
        </span>
      </NuxtLink>

      <nav class="flex flex-1 flex-col gap-1 px-3 py-5" aria-label="Main">
        <span class="mb-2 px-3 text-[11px] font-medium text-shell-muted">Workspace</span>
        <NuxtLink
          v-for="item in navItems"
          :key="item.to"
          :to="item.to"
          class="group flex min-h-11 items-center gap-3 border-l-2 border-transparent px-3 py-2.5 text-sm font-medium text-shell-muted transition-colors outline-none hover:bg-shell-border hover:text-shell-foreground focus-visible:ring-2 focus-visible:ring-shell-foreground focus-visible:ring-inset"
          active-class="!bg-shell-foreground !text-shell"
        >
          <component :is="item.icon" class="size-4.5 shrink-0" aria-hidden="true" />
          {{ item.label }}
        </NuxtLink>
      </nav>

      <div class="border-t border-shell-border p-3">
        <NuxtLink
          to="/settings"
          class="flex min-h-11 items-center gap-3 px-3 py-2.5 text-sm font-medium text-shell-muted transition-colors outline-none hover:bg-shell-border hover:text-shell-foreground focus-visible:ring-2 focus-visible:ring-shell-foreground focus-visible:ring-inset"
          active-class="!bg-shell-foreground !text-shell"
        >
          <Settings class="size-4.5 shrink-0" aria-hidden="true" />
          <span class="min-w-0 flex-1">
            <span class="block truncate text-shell-foreground">{{ profile?.displayName || 'Settings' }}</span>
            <span class="block truncate text-[11px] font-normal text-shell-muted">{{ user?.email || 'Preferences' }}</span>
          </span>
        </NuxtLink>
      </div>
    </aside>

    <!-- Mobile header -->
    <header
      class="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-shell-border bg-shell px-4 text-shell-foreground md:hidden"
    >
      <NuxtLink to="/" class="flex items-center gap-2 outline-none focus-visible:ring-2 focus-visible:ring-shell-foreground">
        <SaloMark class="size-6 shrink-0" title="Jara" />
        <span class="font-semibold tracking-tight">Jara</span>
      </NuxtLink>
      <NuxtLink
        to="/settings"
        class="-mr-2 p-2 text-shell-muted transition-colors outline-none hover:text-shell-foreground focus-visible:ring-2 focus-visible:ring-shell-foreground"
        aria-label="Settings"
      >
        <Settings class="size-5" aria-hidden="true" />
      </NuxtLink>
    </header>

    <!--
      The stock itself: faint rules at the 32px rhythm the rows are built on, so
      the page reads as a card that has been ruled for writing on rather than as
      a blank background. Applied to the field, under the content.
    -->
    <main class="stock-ruled min-h-dvh md:pl-60">
      <div class="mx-auto w-full max-w-6xl px-4 py-6 pb-28 sm:px-6 md:px-10 md:py-10 md:pb-14">
        <slot />
      </div>
    </main>

    <!-- Mobile tab bar -->
    <nav
      class="fixed inset-x-0 bottom-0 z-30 grid grid-cols-6 border-t border-shell-border bg-shell pb-[env(safe-area-inset-bottom)] text-shell-foreground md:hidden"
      aria-label="Main"
    >
      <NuxtLink
        v-for="item in navItems"
        :key="item.to"
        :to="item.to"
        class="flex min-h-16 flex-col items-center justify-center gap-1 border-t-2 border-transparent px-0.5 py-2 text-[10px] font-medium text-shell-muted transition-colors outline-none focus-visible:bg-shell-border focus-visible:text-shell-foreground"
        active-class="!border-shell-foreground !text-shell-foreground"
      >
        <component :is="item.icon" class="size-5" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
    </nav>
  </div>
</template>
