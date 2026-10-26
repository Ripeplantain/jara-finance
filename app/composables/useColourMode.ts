export type ColourMode = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'salo-theme'

/**
 * Light, dark, or whatever the device says.
 *
 * Light is the default. The device preference only applies once someone has
 * chosen "system" themselves, which is stored as the string 'system' so a first
 * visit on a dark-mode laptop still opens in the design the product was drawn in.
 *
 * Hand-rolled rather than pulled from a module: this is one class on `<html>`
 * and one string in `localStorage`, and the inline script in `nuxt.config.ts`
 * already applies it before first paint so the page never flashes the wrong
 * theme. A dependency would buy nothing and cost a module boot.
 *
 * The preference is per device on purpose — someone reading Jara on a phone in
 * sunlight and on a laptop at night wants different answers, and the server has
 * no business knowing either.
 */
export function useColourMode() {
  const mode = useState<ColourMode>('colour-mode', () => 'light')

  function apply(next: ColourMode) {
    const dark
      = next === 'dark'
        || (next === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
    document.documentElement.classList.toggle('dark', dark)
  }

  function set(next: ColourMode) {
    mode.value = next
    try {
      localStorage.setItem(STORAGE_KEY, next)
    } catch {
      // Private browsing, or storage disabled. The choice still applies to this
      // page; it just will not survive a reload.
    }
    apply(next)
  }

  onMounted(() => {
    let stored: string | null
    try {
      stored = localStorage.getItem(STORAGE_KEY)
    } catch {
      stored = null
    }
    mode.value = stored === 'dark' || stored === 'system' ? stored : 'light'

    // Follow the device while the user has not chosen for themselves.
    const query = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      if (mode.value === 'system') apply('system')
    }
    query.addEventListener('change', onChange)
    onUnmounted(() => query.removeEventListener('change', onChange))
  })

  return { mode, set }
}
