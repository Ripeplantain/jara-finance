export interface ConfirmOptions {
  title: string
  description?: string
  confirmLabel?: string
  cancelLabel?: string
  /** `danger` paints the confirm button in the destructive colour. */
  tone?: 'default' | 'danger'
}

let resolver: ((confirmed: boolean) => void) | undefined

/**
 * Ask the user to confirm before doing something they cannot easily undo.
 *
 *   if (!await confirm({ title: 'Delete this transaction?', tone: 'danger' })) return
 *
 * One `ConfirmDialog` is mounted in the default layout and reads this state, so
 * callers never render a dialog of their own. The promise resolves `false` for
 * cancel, Escape and a click on the scrim, and `true` only for the confirm
 * button.
 */
export function useConfirm() {
  const options = useState<ConfirmOptions | null>('confirm-options', () => null)

  function settle(confirmed: boolean) {
    const done = resolver
    resolver = undefined
    options.value = null
    done?.(confirmed)
  }

  function confirm(next: ConfirmOptions): Promise<boolean> {
    // A second request replaces the first rather than stacking dialogs.
    resolver?.(false)
    return new Promise((resolve) => {
      resolver = resolve
      options.value = next
    })
  }

  return { options, isOpen: computed(() => options.value !== null), confirm, settle }
}
