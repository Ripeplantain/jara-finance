<script setup lang="ts">
import { Archive, CircleCheck, LogOut, Trash2, TriangleAlert } from 'lucide-vue-next'
import {
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogOverlay,
  AlertDialogPortal,
  AlertDialogRoot,
  AlertDialogTitle
} from 'reka-ui'

/**
 * The one confirmation dialog, driven by `useConfirm`. It is an alert dialog on
 * purpose: focus lands on Cancel, so pressing Enter by reflex never confirms.
 * A centred card on larger screens, a bottom sheet on phones.
 */
const { options, isOpen, settle } = useConfirm()

// Keep the last text on screen while the dialog fades out, rather than blanking.
const shown = ref(options.value)
watch(options, (next) => { if (next) shown.value = next })

const ICONS = { trash: Trash2, logout: LogOut, archive: Archive, check: CircleCheck } as const
const icon = computed(() =>
  shown.value?.icon ? ICONS[shown.value.icon] : shown.value?.tone === 'danger' ? TriangleAlert : null
)
</script>

<template>
  <AlertDialogRoot :open="isOpen" @update:open="(open: boolean) => { if (!open) settle(false) }">
    <AlertDialogPortal>
      <AlertDialogOverlay class="j-scrim j-confirm-scrim" />
      <AlertDialogContent class="j-confirm">
        <div v-if="icon" class="j-confirm-icon" :class="{ 'is-danger': shown?.tone === 'danger' }" aria-hidden="true">
          <component :is="icon" :size="22" :stroke-width="1.8" />
        </div>
        <AlertDialogTitle class="j-confirm-title">{{ shown?.title }}</AlertDialogTitle>
        <AlertDialogDescription v-if="shown?.description" class="j-confirm-text">
          {{ shown.description }}
        </AlertDialogDescription>
        <div class="j-confirm-actions">
          <AlertDialogCancel class="j-pill is-quiet" @click="settle(false)">
            {{ shown?.cancelLabel ?? 'Cancel' }}
          </AlertDialogCancel>
          <AlertDialogAction
            class="j-pill"
            :class="{ 'is-danger': shown?.tone === 'danger' }"
            @click="settle(true)"
          >
            {{ shown?.confirmLabel ?? 'Confirm' }}
          </AlertDialogAction>
        </div>
      </AlertDialogContent>
    </AlertDialogPortal>
  </AlertDialogRoot>
</template>
