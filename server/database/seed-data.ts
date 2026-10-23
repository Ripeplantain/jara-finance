/**
 * System categories, shared by every user.
 *
 * Chosen for Ghana specifically — "Transport" covers trotro and Bolt, "Data &
 * Airtime" is its own line because topping up is a frequent, distinct expense
 * here, and "Family Support" (black tax) is a real recurring outflow that
 * generic budgeting apps bury under "Other". Getting these right matters: a
 * category list that doesn't match how someone actually spends is the fastest
 * way to make them stop categorising at all.
 *
 * `colorIndex` maps to the `--chart-N` design tokens, so category colours stay
 * inside the design system instead of being picked ad hoc.
 */

export interface SeedCategory {
  name: string
  kind: 'income' | 'expense'
  icon: string
  colorIndex: number
  sortOrder: number
}

export const SYSTEM_CATEGORIES: SeedCategory[] = [
  // Income
  { name: 'Salary', kind: 'income', icon: 'banknote', colorIndex: 1, sortOrder: 10 },
  { name: 'Business', kind: 'income', icon: 'store', colorIndex: 2, sortOrder: 20 },
  { name: 'Freelance', kind: 'income', icon: 'laptop', colorIndex: 3, sortOrder: 30 },
  { name: 'Gifts Received', kind: 'income', icon: 'gift', colorIndex: 4, sortOrder: 40 },
  { name: 'Other Income', kind: 'income', icon: 'circle-plus', colorIndex: 5, sortOrder: 50 },

  // Expenses
  { name: 'Food & Groceries', kind: 'expense', icon: 'shopping-basket', colorIndex: 1, sortOrder: 10 },
  { name: 'Transport', kind: 'expense', icon: 'bus', colorIndex: 2, sortOrder: 20 },
  { name: 'Rent & Housing', kind: 'expense', icon: 'house', colorIndex: 3, sortOrder: 30 },
  { name: 'Utilities', kind: 'expense', icon: 'zap', colorIndex: 4, sortOrder: 40 },
  { name: 'Data & Airtime', kind: 'expense', icon: 'smartphone', colorIndex: 5, sortOrder: 50 },
  { name: 'Health', kind: 'expense', icon: 'heart-pulse', colorIndex: 6, sortOrder: 60 },
  { name: 'Education', kind: 'expense', icon: 'graduation-cap', colorIndex: 1, sortOrder: 70 },
  { name: 'Family Support', kind: 'expense', icon: 'users', colorIndex: 2, sortOrder: 80 },
  { name: 'Entertainment', kind: 'expense', icon: 'music', colorIndex: 3, sortOrder: 90 },
  { name: 'Clothing', kind: 'expense', icon: 'shirt', colorIndex: 4, sortOrder: 100 },
  { name: 'Personal Care', kind: 'expense', icon: 'sparkles', colorIndex: 5, sortOrder: 110 },
  { name: 'Fees & Charges', kind: 'expense', icon: 'receipt', colorIndex: 6, sortOrder: 120 },
  { name: 'Giving & Tithe', kind: 'expense', icon: 'hand-heart', colorIndex: 1, sortOrder: 130 },
  { name: 'Other Expense', kind: 'expense', icon: 'circle-minus', colorIndex: 6, sortOrder: 999 }
]
