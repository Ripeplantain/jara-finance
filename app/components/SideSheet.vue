<script setup lang="ts">
import { X } from 'lucide-vue-next'

/**
 * A modal side sheet (bottom sheet below 760px), styled by the `.j-sheet`
 * rules in v1.css, which are v1's sheet verbatim.
 *
 * Reka's Dialog is deliberately not used: the sheet needs to hold arbitrary
 * form content and keep the page behind it visible, and the behaviours that
 * matter are few enough to own here — focus trap, focus restore, Escape,
 * scroll lock.
 */
const props = defineProps<{ open: boolean, label: string }>()
const emit = defineEmits<{ close: [] }>()

// A confirmation opened from inside the sheet owns Escape until it closes.
const { isOpen: confirmOpen } = useConfirm()

const panel = ref<HTMLElement | null>(null)
let returnTo: HTMLElement | null = null
let previousOverflow = ''

const FOCUSABLE
  = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

function onWindowKeydown(event: KeyboardEvent) {
  if (event.key === 'Escape' && !confirmOpen.value) {
    event.preventDefault()
    emit('close')
  }
}

function onPanelKeydown(event: KeyboardEvent) {
  if (event.key !== 'Tab' || !panel.value) return
  const items = Array.from(panel.value.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (!items.length) {
    event.preventDefault()
    panel.value.focus()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement
  if (event.shiftKey && (active === first || active === panel.value)) {
    event.preventDefault()
    last.focus()
  } else if (!event.shiftKey && active === last) {
    event.preventDefault()
    first.focus()
  }
}

// The sheet is teleported to <body>, so the whole app root can be made inert
// while it is open. `aria-modal` alone is not honoured everywhere, and without
// this a screen reader (or a test) still finds the page's own controls behind
// the scrim. `aria-hidden` is set too because `inert` is not yet read by every
// assistive technology or test tool. Focus is released first so aria-hidden is
// never applied over a focused descendant.
function setPageInert(inert: boolean) {
  const root = document.getElementById('__nuxt')
  if (!root) return
  if (inert) {
    ;(document.activeElement as HTMLElement | null)?.blur?.()
    root.setAttribute('aria-hidden', 'true')
  } else {
    root.removeAttribute('aria-hidden')
  }
  root.inert = inert
}

function lock() {
  returnTo = document.activeElement as HTMLElement | null
  setPageInert(true)
  previousOverflow = document.body.style.overflow
  document.body.style.overflow = 'hidden'
  window.addEventListener('keydown', onWindowKeydown)
}

function unlock() {
  setPageInert(false)
  document.body.style.overflow = previousOverflow
  window.removeEventListener('keydown', onWindowKeydown)
  returnTo?.focus?.()
  returnTo = null
}

watch(() => props.open, async (isOpen) => {
  if (isOpen) {
    lock()
    await nextTick()
    const target = panel.value?.querySelector<HTMLElement>('[data-autofocus]') ?? panel.value
    target?.focus()
  } else {
    unlock()
  }
})

onBeforeUnmount(() => {
  if (props.open) unlock()
})
</script>

<template>
  <Teleport to="body">
    <Transition name="j-slide">
      <div v-if="open">
        <div class="j-scrim" aria-hidden="true" @click="emit('close')" />
        <div
          ref="panel"
          class="j-sheet"
          role="dialog"
          aria-modal="true"
          :aria-label="label"
          tabindex="-1"
          @keydown="onPanelKeydown"
        >
          <button type="button" class="j-sheet-close" aria-label="Close" @click="emit('close')">
            <X :size="20" aria-hidden="true" />
          </button>
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
