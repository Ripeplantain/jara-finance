<script setup lang="ts">
import { Check, Monitor, Moon, Sun } from 'lucide-vue-next'
import {
  DropdownMenuContent,
  DropdownMenuItemIndicator,
  DropdownMenuPortal,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuRoot,
  DropdownMenuTrigger
} from 'reka-ui'
import type { ColourMode } from '~/composables/useColourMode'

/**
 * The light / dark / system switch, as a menu in the app bar. The choice lives
 * in `useColourMode` (per device, applied before first paint); this is only the
 * control for it.
 */
const { mode, set } = useColourMode()

const OPTIONS = [
  { value: 'light', label: 'Light', icon: Sun },
  { value: 'dark', label: 'Dark', icon: Moon },
  { value: 'system', label: 'System', icon: Monitor }
] as const

const current = computed(() => OPTIONS.find(option => option.value === mode.value) ?? OPTIONS[0])
</script>

<template>
  <DropdownMenuRoot>
    <DropdownMenuTrigger class="j-icon-link" aria-label="Theme">
      <component :is="current.icon" :size="20" aria-hidden="true" />
    </DropdownMenuTrigger>
    <DropdownMenuPortal>
      <DropdownMenuContent class="j-menu" align="end" :side-offset="8">
        <DropdownMenuRadioGroup :model-value="mode" @update:model-value="set($event as ColourMode)">
          <DropdownMenuRadioItem
            v-for="option in OPTIONS"
            :key="option.value"
            :value="option.value"
            class="j-menu-item"
          >
            <component :is="option.icon" :size="16" aria-hidden="true" />
            <span>{{ option.label }}</span>
            <DropdownMenuItemIndicator class="j-menu-check">
              <Check :size="16" aria-hidden="true" />
            </DropdownMenuItemIndicator>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenuPortal>
  </DropdownMenuRoot>
</template>
