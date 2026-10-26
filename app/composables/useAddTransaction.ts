/**
 * Shared state for the add-transaction side sheet.
 *
 * The sheet is mounted once, in the default layout, and opened from the top bar
 * and the mobile header. `useState` keeps one copy across both and across SSR.
 * `savedCount` is a signal rather than an event: the layout bumps it when a
 * save lands, and anything that needs to react (a page, a test) can watch it.
 */
export function useAddTransaction() {
  const isOpen = useState('add-transaction-open', () => false)
  const savedCount = useState('add-transaction-saved', () => 0)
  // The Afford screen hands over the price it just checked; see `TransactionForm`.
  const initialAmount = useState<string | undefined>('add-transaction-amount', () => undefined)

  return {
    isOpen,
    savedCount,
    initialAmount,
    open: (options?: { amount?: string }) => {
      initialAmount.value = options?.amount
      isOpen.value = true
    },
    close: () => { isOpen.value = false },
    markSaved: () => { savedCount.value += 1 }
  }
}
