<script setup lang="ts">
import {
  ArrowLeftRight,
  ChartLine,
  Ellipsis,
  LayoutDashboard,
  Plus,
  Scale,
  Settings,
  Wallet
} from 'lucide-vue-next'

/**
 * Five destinations, in the order v1's shell reads them. The top bar shows all
 * five; the phone tab bar is v1's own four plus "More" (Afford, Settings),
 * because five labelled targets plus Add do not fit 390px at 44px each without
 * clipping "Transactions". Salo is not a destination: it is the floating
 * launcher below, on every page.
 */
const navItems = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, exact: true, tab: true },
  { to: '/transactions', label: 'Transactions', icon: ArrowLeftRight, tab: true },
  // Goals are managed on /goals but belong to the Budgets screen, as in v1.
  { to: '/budgets', label: 'Budgets', icon: Wallet, tab: true, also: ['/goals'] },
  { to: '/insights', label: 'Insights', icon: ChartLine, tab: true },
  { to: '/afford', label: 'Afford', icon: Scale, tab: false }
]
const tabItems = navItems.filter(item => item.tab)
const moreItems = [
  ...navItems.filter(item => !item.tab),
  { to: '/settings', label: 'Settings', icon: Settings }
]

const route = useRoute()
const { open: openAdd } = useAddTransaction()
const moreOpen = ref(false)

function isActive(item: { to: string, exact?: boolean, also?: string[] }) {
  if (item.exact) return route.path === item.to
  return [item.to, ...(item.also ?? [])].some(path => route.path === path || route.path.startsWith(`${path}/`))
}
const moreActive = computed(() => moreItems.some(item => isActive(item)))
const settingsActive = computed(() => route.path.startsWith('/settings'))

watch(() => route.path, () => { moreOpen.value = false })
</script>

<template>
  <div class="j-app">
    <header class="j-top">
      <div class="j-top-inner">
        <NuxtLink to="/" class="j-mark" aria-label="Jara home">
          <JaraMark class="j-mark-glyph" />
          Jara
        </NuxtLink>
        <nav class="j-nav" aria-label="Main">
          <NuxtLink
            v-for="item in navItems"
            :key="item.to"
            :to="item.to"
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            {{ item.label }}
          </NuxtLink>
        </nav>
        <div class="j-top-right">
          <button type="button" class="j-pill" aria-label="Add transaction" @click="openAdd()">
            <Plus :size="16" aria-hidden="true" />
            <span class="j-pill-long">Add transaction</span>
            <span class="j-pill-short">Add</span>
          </button>
          <ThemeMenu />
          <NuxtLink
            to="/settings"
            class="j-icon-link"
            :aria-current="settingsActive ? 'page' : undefined"
            aria-label="Settings"
          >
            <Settings :size="20" aria-hidden="true" />
          </NuxtLink>
        </div>
      </div>
    </header>

    <header class="j-mobile-head">
      <NuxtLink to="/" class="j-mark" aria-label="Jara home">
        <JaraMark class="j-mark-glyph" />
        Jara
      </NuxtLink>
      <div class="j-mobile-actions">
        <button type="button" class="j-pill" aria-label="Add transaction" @click="openAdd()">
          <Plus :size="16" aria-hidden="true" /> Add
        </button>
        <ThemeMenu />
        <NuxtLink
          to="/settings"
          class="j-icon-link"
          :aria-current="settingsActive ? 'page' : undefined"
          aria-label="Settings"
        >
          <Settings :size="20" aria-hidden="true" />
        </NuxtLink>
      </div>
    </header>

    <main class="j-main">
      <slot />
    </main>

    <footer class="j-foot">
      <p>Every figure comes from your own ledger. Moving money between accounts or into goals is never counted as income or spending.</p>
    </footer>

    <nav class="j-tabbar" aria-label="Main">
      <NuxtLink
        v-for="item in tabItems"
        :key="item.to"
        :to="item.to"
        :aria-current="isActive(item) ? 'page' : undefined"
      >
        <component :is="item.icon" :size="21" :stroke-width="1.7" aria-hidden="true" />
        {{ item.label }}
      </NuxtLink>
      <button
        type="button"
        class="j-tab-more"
        :aria-current="moreActive ? 'page' : undefined"
        aria-haspopup="dialog"
        @click="moreOpen = true"
      >
        <Ellipsis :size="21" :stroke-width="1.7" aria-hidden="true" />
        More
      </button>
    </nav>

    <SideSheet :open="moreOpen" label="More" @close="moreOpen = false">
      <p class="j-eyebrow">More</p>
      <ul class="j-rows" style="margin-top: 20px">
        <li v-for="item in moreItems" :key="item.to">
          <NuxtLink
            :to="item.to"
            class="j-row j-more-row"
            :aria-current="isActive(item) ? 'page' : undefined"
          >
            <span class="j-more-icon" aria-hidden="true"><component :is="item.icon" :size="18" :stroke-width="1.7" /></span>
            <span class="t">{{ item.label }}</span>
            <span />
          </NuxtLink>
        </li>
      </ul>
    </SideSheet>

    <ConfirmDialog />
    <SaloLauncher />
    <AddTransactionSheet />
  </div>
</template>
