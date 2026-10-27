import { addMonths, isIsoDate, startOfMonth, todayInTimezone, type IsoDate } from '#shared/period/month'

/**
 * The month a page is showing, kept in the URL as `?month=2026-09` so a
 * refresh, a shared link and the back button all land on the same month.
 *
 * The current month is the default and is left out of the URL, so the plain
 * page address always means "now". "Current" is resolved in the user's own
 * timezone, as the server does.
 *
 * `maxAhead` is how many months past the current one can be reached: 0 for
 * pages that only report what happened, more for pages where planning ahead is
 * the point.
 */
export function useSelectedMonth(maxAhead = 0) {
  const route = useRoute()
  const router = useRouter()
  const { timezone } = useCurrentUser()

  const currentMonth = computed<IsoDate>(() => startOfMonth(todayInTimezone(timezone.value)))
  const latestMonth = computed<IsoDate>(() => addMonths(currentMonth.value, maxAhead))

  function fromQuery(): IsoDate | null {
    const raw = route.query.month
    if (typeof raw !== 'string' || !/^\d{4}-\d{2}$/.test(raw)) return null
    const candidate = `${raw}-01`
    return isIsoDate(candidate) ? candidate : null
  }

  const month = computed<IsoDate>({
    get() {
      const chosen = fromQuery()
      if (!chosen) return currentMonth.value
      // A hand-edited URL cannot walk past the allowed window.
      return chosen > latestMonth.value ? latestMonth.value : chosen
    },
    set(next) {
      router.replace({
        query: { ...route.query, month: next === currentMonth.value ? undefined : next.slice(0, 7) }
      })
    }
  })

  return { month, currentMonth, latestMonth }
}
