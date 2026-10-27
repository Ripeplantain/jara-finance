import { expect, test, type Page } from '@playwright/test'

/**
 * A new user's path through the app: sign up, onboard, add an account, record
 * money, see it counted.
 *
 * Each run creates its own account, so the suite is repeatable against a
 * database that already has data in it.
 */

function uniqueEmail(): string {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 8)}@example.test`
}

const PASSWORD = 'salo-e2e-password'
const SIGNED_IN_ROUTES = ['/', '/transactions', '/budgets', '/goals', '/insights', '/afford', '/settings']

/**
 * Navigate, then wait until Vue has hydrated.
 *
 * Filling a field before hydration is worse than useless: the value lands in
 * the DOM, and hydration then patches the input back to the component's empty
 * state. The form ends up visibly filled but empty as far as Vue is concerned,
 * so `required` silently blocks submission and the test fails with no error on
 * screen. Every navigation goes through here.
 */
async function gotoReady(page: Page, path: string) {
  await page.goto(path)
  await page.waitForFunction(() =>
    Boolean((document.querySelector('#__nuxt') as (HTMLElement & { __vue_app__?: unknown }) | null)?.__vue_app__)
  )
  await page.waitForLoadState('networkidle')
}

async function signUp(page: Page): Promise<string> {
  const email = uniqueEmail()

  await gotoReady(page, '/signup')
  await page.getByLabel('Name').fill('Ama E2E')
  await page.getByLabel('Email').fill(email)
  // Exact: the field's "Show password" toggle would otherwise match too.
  await page.getByLabel('Password', { exact: true }).fill(PASSWORD)
  await page.getByRole('button', { name: 'Create account' }).click()

  // A brand-new account has no profile, so the middleware sends them here.
  await expect(page).toHaveURL(/\/onboarding/)
  return email
}

async function completeOnboarding(page: Page) {
  await page.getByLabel('What should Jara call you?').fill('Ama')
  await page.getByRole('button', { name: 'Start using Jara' }).click()
  await expect(page).toHaveURL('/')
}

async function addAccount(page: Page, name: string, openingBalance: string) {
  await gotoReady(page, '/settings')
  await page.getByRole('button', { name: 'Add', exact: true }).click()

  // Scoped to the add-account form: the profile card below has its own "Name".
  const form = page.locator('form').filter({ has: page.getByLabel('Balance right now') })
  await form.getByLabel('Name').fill(name)
  await form.getByLabel('Balance right now').fill(openingBalance)
  await form.getByRole('button', { name: 'Add account' }).click()

  await expect(page.getByRole('listitem').filter({ hasText: name })).toBeVisible()
}

async function addExpense(page: Page, amount: string, category: string, merchant?: string) {
  await gotoReady(page, '/transactions')
  // The top bar's pill and the ledger's own button open the same sheet.
  await page.getByRole('button', { name: 'Add transaction' }).first().click()
  // Scoped to the sheet: the ledger behind it has its own "Category" filter.
  const sheet = page.getByRole('dialog')
  await sheet.getByRole('button', { name: 'Expense' }).click()
  await sheet.getByLabel('Amount').fill(amount)
  await sheet.getByLabel('Category').selectOption({ label: category })
  if (merchant) {
    await sheet.getByLabel(/Who \/ where/).fill(merchant)
  }
  await sheet.getByRole('button', { name: 'Save' }).click()
}

test.describe('auth gate', () => {
  test('sends an anonymous visitor to sign in and remembers where they were going', async ({
    page
  }) => {
    await page.goto('/budgets')
    await expect(page).toHaveURL(/\/login\?redirect=\/budgets/)
    await expect(page.getByRole('heading', { name: 'Welcome back' })).toBeVisible()
  })

  test('refuses an unknown sign-in without revealing whether the email exists', async ({
    page
  }) => {
    await gotoReady(page, '/login')
    await page.getByLabel('Email').fill('nobody@example.test')
    await page.getByLabel('Password', { exact: true }).fill('definitely-not-the-password')
    await page.getByRole('button', { name: 'Sign in' }).click()
    await expect(page.getByRole('alert')).toBeVisible()
    await expect(page).toHaveURL(/\/login/)
  })
})

test.describe('a new user records their money', () => {
  test('signs up, onboards, and is guided to add an account first', async ({ page }) => {
    await signUp(page)
    await completeOnboarding(page)

    // With no accounts there is nothing to chart, so the app guides instead.
    await expect(page.getByText('Add an account to start tracking your money')).toBeVisible()
  })

  test('records an expense and sees the balance and breakdown update', async ({ page }) => {
    await signUp(page)
    await completeOnboarding(page)
    await addAccount(page, 'E2E MoMo', '1000')

    await addExpense(page, '87.40', 'Food & Groceries', 'Melcom')

    // The list is the ledger, so the row appearing is the real assertion.
    await expect(page.getByText('Melcom')).toBeVisible()

    await gotoReady(page, '/')
    // GH₵1,000 opening − GH₵87.40 = GH₵912.60
    await expect(page.getByText('GH₵912.60').first()).toBeVisible()
    await expect(page.getByText('Food & Groceries').first()).toBeVisible()
  })

  test('moves money between accounts without counting it as income', async ({ page }) => {
    await signUp(page)
    await completeOnboarding(page)
    await addAccount(page, 'E2E Cash', '500')
    await addAccount(page, 'E2E Savings', '0')

    await gotoReady(page, '/transactions')
    // The top bar's pill and the ledger's own button open the same sheet.
  await page.getByRole('button', { name: 'Add transaction' }).first().click()
    const sheet = page.getByRole('dialog')
    await sheet.getByRole('button', { name: 'Transfer' }).click()
    await sheet.getByLabel('Amount').fill('200')
    // Selected by position: the account list is ordered by name, so index 0 is
    // "E2E Cash" and index 1 is "E2E Savings". The option labels carry a type
    // suffix, which makes matching them by text brittle.
    await sheet.getByLabel('From account').selectOption({ index: 0 })
    await sheet.getByLabel('To account').selectOption({ index: 1 })
    await sheet.getByRole('button', { name: 'Save' }).click()

    // Two legs: one leaving the source, one arriving at the destination.
    await expect(page.getByRole('listitem').filter({ hasText: 'sent' })).toBeVisible()
    await expect(page.getByRole('listitem').filter({ hasText: 'received' })).toBeVisible()

    await gotoReady(page, '/')
    // Moving money changes neither the total nor what was earned.
    await expect(page.getByText('GH₵500.00').first()).toBeVisible()
    const incomeStat = page.locator('dt', { hasText: /^Income / }).locator('xpath=..')
    await expect(incomeStat.getByText('GH₵0', { exact: true })).toBeVisible()
    await expect(page.getByText('Add an account to start tracking your money')).toBeHidden()
  })
})

test.describe('budgets', () => {
  test('sets a limit and names an overspend against it', async ({ page }) => {
    await signUp(page)
    await completeOnboarding(page)
    await addAccount(page, 'E2E Budget Acct', '1000')
    await addExpense(page, '400', 'Transport')

    await gotoReady(page, '/budgets')
    await expect(page.getByText('No budget for this month yet')).toBeVisible()

    await page.getByRole('button', { name: 'Set limits' }).first().click()
    await page.getByLabel('Transport', { exact: true }).fill('300')
    await page.getByRole('button', { name: 'Save budget' }).click()

    // GH₵400 against a GH₵300 cap is an overspend the page must name, in
    // words rather than by colour alone.
    const transport = page.getByRole('listitem').filter({ hasText: 'Transport' })
    await expect(transport.getByText('Past the limit')).toBeVisible()
    await expect(transport.getByText('GH₵100 over')).toBeVisible()
  })
})

test.describe('goals', () => {
  test('creates a goal and tracks a contribution that moves no money', async ({ page }) => {
    await signUp(page)
    await completeOnboarding(page)
    await addAccount(page, 'E2E Goal Acct', '1000')

    await gotoReady(page, '/goals')
    await page.getByRole('button', { name: 'New goal' }).click()
    await page.getByLabel('What for?').fill('Laptop')
    await page.getByLabel('Target amount').fill('5000')
    await page.getByRole('button', { name: 'Create goal' }).click()

    await expect(page.getByText('Laptop')).toBeVisible()
    await expect(page.getByText('of GH₵5,000')).toBeVisible()

    await page.getByRole('button', { name: 'Add money' }).click()
    // Scoped to the sheet: the new-goal sheet may still be fading out behind it.
    const sheet = page.getByRole('dialog', { name: 'Add money to this goal' })
    await sheet.getByLabel('How?').selectOption('tracked')
    await sheet.getByLabel('Amount', { exact: true }).fill('200')
    await sheet.getByRole('button', { name: 'Add money' }).click()

    // Progress counts it, and the balance does not — nothing moved.
    await expect(page.getByText('GH₵200.00').first()).toBeVisible()

    await gotoReady(page, '/settings')
    const accountRow = page.getByRole('listitem').filter({ hasText: 'E2E Goal Acct' })
    await expect(accountRow.getByText('GH₵1,000.00', { exact: true })).toBeVisible()
  })

  test('moves a backed contribution from another account into the goal account', async ({ page }) => {
    await signUp(page)
    await completeOnboarding(page)
    await addAccount(page, 'E2E Goal Source', '1000')
    await addAccount(page, 'E2E Goal Savings', '100')

    await gotoReady(page, '/goals')
    await page.getByRole('button', { name: 'New goal' }).click()
    await page.getByLabel('What for?').fill('Backed laptop')
    await page.getByLabel('Target amount').fill('5000')
    await page.getByLabel('Savings account').selectOption({ label: 'E2E Goal Savings' })
    await page.getByRole('button', { name: 'Create goal' }).click()

    const goal = page.locator('article').filter({ hasText: 'Backed laptop' })
    await goal.getByRole('button', { name: 'Add money' }).click()

    const sheet = page.getByRole('dialog', { name: 'Add money to this goal' })
    const fromAccount = sheet.getByLabel('From which account?')
    await expect(fromAccount.locator('option', { hasText: 'E2E Goal Savings' })).toHaveCount(0)
    await expect(fromAccount.locator('option', { hasText: 'E2E Goal Source' })).toHaveCount(1)
    await fromAccount.selectOption({ label: 'E2E Goal Source' })
    await sheet.getByLabel('Amount', { exact: true }).fill('200')
    await sheet.getByRole('button', { name: 'Add money' }).click()

    await expect(goal.getByText('GH₵200.00', { exact: true }).first()).toBeVisible()
    await expect(goal.getByText('Moved to savings', { exact: true })).toBeVisible()

    await gotoReady(page, '/settings')
    const sourceRow = page.getByRole('listitem').filter({ hasText: 'E2E Goal Source' })
    const destinationRow = page.getByRole('listitem').filter({ hasText: 'E2E Goal Savings' })
    await expect(sourceRow.getByText('GH₵800.00', { exact: true })).toBeVisible()
    await expect(destinationRow.getByText('GH₵300.00', { exact: true })).toBeVisible()
  })
})

test.describe('every page renders for a signed-in user', () => {
  test('renders every route at 1440x900 in light mode without errors or overflow', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.addInitScript(() => localStorage.setItem('salo-theme', 'light'))

    await signUp(page)
    await completeOnboarding(page)

    for (const path of SIGNED_IN_ROUTES) {
      await gotoReady(page, path)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('html')).not.toHaveClass(/dark/)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      expect(errors).toEqual([])
    }
  })

  test('renders every route at 390x844 in dark mode without errors or overflow', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.setViewportSize({ width: 390, height: 844 })
    await page.addInitScript(() => localStorage.setItem('salo-theme', 'dark'))

    await signUp(page)
    await completeOnboarding(page)

    for (const path of SIGNED_IN_ROUTES) {
      await gotoReady(page, path)
      await expect(page.locator('h1')).toBeVisible()
      await expect(page.locator('html')).toHaveClass(/dark/)
      await expect(page.getByRole('navigation', { name: 'Main' })).toBeVisible()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
      expect(errors).toEqual([])
    }
  })
})

/** A month `offset` months from now: URL key, a mid-month date, and its heading. */
function monthOffset(offset: number) {
  const now = new Date()
  const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 15))
  return {
    key: date.toISOString().slice(0, 7),
    date: date.toISOString().slice(0, 10),
    heading: date.toLocaleDateString('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' })
  }
}

test.describe('choosing the month', () => {
  test('editing a transaction date moves it into that month', async ({ page }) => {
    const previous = monthOffset(-1)
    await signUp(page)
    await completeOnboarding(page)
    await addAccount(page, 'E2E Move Acct', '1000')
    await addExpense(page, '50', 'Transport', 'Move Me')
    await expect(page.getByText('Move Me')).toBeVisible()

    await page.locator('.j-row', { hasText: 'Move Me' }).click()
    const sheet = page.getByRole('dialog', { name: 'Transaction detail' })
    await sheet.getByRole('button', { name: 'Edit', exact: true }).click()
    await sheet.getByLabel('Date').fill(previous.date)
    await expect(sheet.getByText(/This moves it to/)).toBeVisible()
    await sheet.getByRole('button', { name: 'Save changes' }).click()

    // The row now sits under last month's heading.
    await expect(page.getByRole('heading', { name: previous.heading })).toBeVisible()
    await expect(page.locator('.j-row', { hasText: 'Move Me' })).toBeVisible()
  })

  test('steps the dashboard to the previous month and back', async ({ page }) => {
    const previous = monthOffset(-1)
    await signUp(page)
    await completeOnboarding(page)

    await gotoReady(page, '/')
    await page.getByRole('button', { name: 'Previous month' }).click()
    await expect(page.locator('.j-month-name')).toHaveText(previous.heading)
    await expect(page).toHaveURL(new RegExp(`month=${previous.key}`))
    // Nothing is recorded yet, but the page still renders for a past month.
    await expect(page.getByRole('heading', { name: 'Income and spending' }).or(page.getByText('Add an account to start tracking your money'))).toBeVisible()

    await page.getByRole('button', { name: 'Back to this month' }).click()
    await expect(page).not.toHaveURL(/month=/)
  })

  test('copies last month\'s limits into an empty month on the budgets page', async ({ page }) => {
    const previous = monthOffset(-1)
    await signUp(page)
    await completeOnboarding(page)

    await gotoReady(page, `/budgets?month=${previous.key}`)
    await page.getByRole('button', { name: 'Set limits' }).first().click()
    await page.getByLabel('Transport', { exact: true }).fill('300')
    await page.getByRole('button', { name: 'Save budget' }).click()
    await expect(page.getByText('Transport').first()).toBeVisible()

    await page.getByRole('button', { name: 'Next month' }).click()
    await expect(page.getByText('No budget for this month yet')).toBeVisible()
    await page.getByRole('button', { name: /^Copy .* limits$/ }).click()
    await expect(page.getByLabel('Transport', { exact: true })).toHaveValue('300.00')
  })
})
