<script setup lang="ts">
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
 */
const { options, isOpen, settle } = useConfirm()

// Keep the last text on screen while the dialog fades out, rather than blanking.
const shown = ref(options.value)
watch(options, (next) => { if (next) shown.value = next })
</script>

<template>
  <AlertDialogRoot :open="isOpen" @update:open="(open: boolean) => { if (!open) settle(false) }">
    <AlertDialogPortal>
      <AlertDialogOverlay class="j-scrim j-confirm-scrim" />
      <AlertDialogContent class="j-confirm">
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
