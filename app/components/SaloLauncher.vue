<script setup lang="ts">
/**
 * Salo, on every signed-in page: a round icon at the bottom of the screen that
 * opens the coach in a panel. Mounted once, in the default layout.
 *
 * The panel is non-modal — the page behind stays usable, as in a chat widget —
 * so there is no focus trap. Escape closes it and puts focus back on the icon.
 */
const { isOpen, open, close, reset } = useSalo()
const { user } = useCurrentUser()
const trigger = ref<HTMLButtonElement | null>(null)

function toggle() {
  if (isOpen.value) closeAndRestore()
  else open()
}

function closeAndRestore() {
  close()
  nextTick(() => trigger.value?.focus())
}

// A different person signing in on this tab must not inherit the thread.
watch(() => user.value?.id, (next, previous) => {
  if (previous !== undefined && next !== previous) reset()
})
</script>

<template>
  <aside class="j-salo" :class="{ 'is-open': isOpen }" @keydown.esc="isOpen && closeAndRestore()">
    <SaloPanel v-if="isOpen" @close="closeAndRestore" />
    <button
      ref="trigger"
      type="button"
      class="j-salo-trigger"
      aria-label="Ask Salo"
      title="Ask Salo"
      aria-controls="salo-panel"
      :aria-expanded="isOpen"
      @click="toggle"
    >
      <SaloAvatar />
    </button>
  </aside>
</template>
