import { randomUUID } from 'node:crypto'
import { Pool } from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { eq, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import * as schema from '~~/server/database/schema'
import { queryAccountBalances } from '~~/server/services/balances'
import type { Database } from '~~/server/types/database'

/**
 * These exercise the real SQL against a real Postgres, because the parts of the
 * money layer that can be wrong in SQL cannot be caught by a unit test: a
 * filtered aggregate that quietly counts transfers as income, a join that leaks
 * another user's rows, a `bigint` sum arriving as a string.
 *
 * Needs `pnpm db:up` and `pnpm db:migrate`. Skipped (not failed) without a
 * DATABASE_URL, so `pnpm test` stays green on a machine with no database.
 */
const databaseUrl = process.env.DATABASE_URL
const describeWithDb = databaseUrl ? describe : describe.skip

describeWithDb('account balances (real Postgres)', () => {
  let pool: Pool
  let db: Database

  // Two users, so every assertion about one is also an assertion that the other
  // is invisible.
  const alice = `test-alice-${randomUUID()}`
  const bob = `test-bob-${randomUUID()}`

  let cashId: string
  let savingsId: string
  let bobCashId: string
  let foodCategoryId: string
  let salaryCategoryId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema, casing: 'snake_case' })

    for (const id of [alice, bob]) {
      await db.insert(schema.user).values({
        id,
        name: `Test ${id}`,
        email: `${id}@example.test`,
        emailVerified: true
      })
    }

    const categories = await db
      .select({ id: schema.categories.id, name: schema.categories.name })
      .from(schema.categories)
      .where(eq(schema.categories.isSystem, true))

    const findCategory = (name: string) => {
      const found = categories.find(category => category.name === name)
      if (!found) throw new Error(`Seed category "${name}" missing — run \`pnpm db:seed\`.`)
      return found.id
    }
    foodCategoryId = findCategory('Food & Groceries')
    salaryCategoryId = findCategory('Salary')

    const accounts = await db
      .insert(schema.financialAccounts)
      .values([
        // GH₵500 opening
        { userId: alice, name: 'MoMo', type: 'mobile_money', openingBalancePesewas: 50_000 },
        { userId: alice, name: 'Savings', type: 'savings', openingBalancePesewas: 0 },
        {
          userId: alice,
          name: 'Old Bank',
          type: 'bank',
          openingBalancePesewas: 10_000,
          isArchived: true
        },
        { userId: bob, name: 'Bob Cash', type: 'cash', openingBalancePesewas: 999_999 }
      ])
      .returning({ id: schema.financialAccounts.id, name: schema.financialAccounts.name })

    const accountId = (name: string) => accounts.find(account => account.name === name)!.id
    cashId = accountId('MoMo')
    savingsId = accountId('Savings')
    bobCashId = accountId('Bob Cash')

    const transferGroupId = randomUUID()
    await db.insert(schema.transactions).values([
      // GH₵1,200 salary in
      {
        userId: alice,
        accountId: cashId,
        categoryId: salaryCategoryId,
        type: 'income',
        amountPesewas: 120_000,
        occurredOn: '2026-10-01'
      },
      // GH₵430.50 of food out
      {
        userId: alice,
        accountId: cashId,
        categoryId: foodCategoryId,
        type: 'expense',
        amountPesewas: 43_050,
        occurredOn: '2026-10-05'
      },
      // Later than the as-of date used below, to prove the cutoff works.
      {
        userId: alice,
        accountId: cashId,
        categoryId: foodCategoryId,
        type: 'expense',
        amountPesewas: 10_000,
        occurredOn: '2026-10-20'
      },
      // GH₵300 moved to savings: two rows, one group.
      {
        userId: alice,
        accountId: cashId,
        type: 'transfer',
        transferDirection: 'out',
        transferGroupId,
        amountPesewas: 30_000,
        occurredOn: '2026-10-06'
      },
      {
        userId: alice,
        accountId: savingsId,
        type: 'transfer',
        transferDirection: 'in',
        transferGroupId,
        amountPesewas: 30_000,
        occurredOn: '2026-10-06'
      },
      // Bob's money, which must never show up in Alice's totals.
      {
        userId: bob,
        accountId: bobCashId,
        categoryId: salaryCategoryId,
        type: 'income',
        amountPesewas: 500_000,
        occurredOn: '2026-10-02'
      }
    ])
  })

  afterAll(async () => {
    // Cascades clear accounts, transactions and everything else user-owned.
    await db.delete(schema.user).where(sql`${schema.user.id} in (${alice}, ${bob})`)
    await pool.end()
  })

  it('derives a balance from opening, income, expense and transfers', async () => {
    const balances = await queryAccountBalances(db, alice)
    const momo = balances.find(balance => balance.accountId === cashId)!

    // 500 + 1,200 − 430.50 − 100 − 300 = GH₵869.50
    expect(momo.balancePesewas).toBe(86_950)
    expect(momo.incomePesewas).toBe(120_000)
    expect(momo.expensePesewas).toBe(53_050)
    expect(momo.transferOutPesewas).toBe(30_000)
    expect(momo.transferInPesewas).toBe(0)
  })

  it('returns integers, not the strings Postgres sends for bigint sums', async () => {
    const balances = await queryAccountBalances(db, alice)
    for (const balance of balances) {
      expect(Number.isInteger(balance.balancePesewas)).toBe(true)
      expect(Number.isInteger(balance.incomePesewas)).toBe(true)
    }
  })

  it('credits the receiving account of a transfer', async () => {
    const balances = await queryAccountBalances(db, alice)
    const savings = balances.find(balance => balance.accountId === savingsId)!
    expect(savings.balancePesewas).toBe(30_000)
    expect(savings.transferInPesewas).toBe(30_000)
  })

  it('excludes transfers from net flow, so moving money is not earning it', async () => {
    const balances = await queryAccountBalances(db, alice)
    const savings = balances.find(balance => balance.accountId === savingsId)!
    expect(savings.netFlowPesewas).toBe(0)

    const momo = balances.find(balance => balance.accountId === cashId)!
    // 1,200 − 530.50, transfers ignored
    expect(momo.netFlowPesewas).toBe(66_950)
  })

  it('never returns another user’s accounts or amounts', async () => {
    const balances = await queryAccountBalances(db, alice, { includeArchived: true })
    expect(balances.map(balance => balance.accountId)).not.toContain(bobCashId)

    const bobBalances = await queryAccountBalances(db, bob)
    expect(bobBalances).toHaveLength(1)
    // 9,999.99 + 5,000
    expect(bobBalances[0]!.balancePesewas).toBe(1_499_999)
  })

  it('hides archived accounts unless asked', async () => {
    const active = await queryAccountBalances(db, alice)
    expect(active.map(balance => balance.name)).not.toContain('Old Bank')

    const all = await queryAccountBalances(db, alice, { includeArchived: true })
    expect(all.map(balance => balance.name)).toContain('Old Bank')
  })

  it('honours an as-of cutoff', async () => {
    const balances = await queryAccountBalances(db, alice, { asOf: '2026-10-10' })
    const momo = balances.find(balance => balance.accountId === cashId)!
    // The GH₵100 expense on the 20th is excluded: 500 + 1,200 − 430.50 − 300
    expect(momo.balancePesewas).toBe(96_950)
    expect(momo.expensePesewas).toBe(43_050)
  })

  it('reports an account with no transactions at its opening balance', async () => {
    const [account] = await db
      .insert(schema.financialAccounts)
      .values({
        userId: alice,
        name: 'Untouched',
        type: 'cash',
        openingBalancePesewas: 12_345
      })
      .returning({ id: schema.financialAccounts.id })

    const balances = await queryAccountBalances(db, alice)
    const untouched = balances.find(balance => balance.accountId === account!.id)!
    expect(untouched.balancePesewas).toBe(12_345)
    expect(untouched.incomePesewas).toBe(0)
  })
})

/**
 * Drizzle wraps a failed query in its own error whose message is just the SQL,
 * and puts the driver's error — the one carrying the constraint name — on
 * `cause`. Asserting on the name rather than on "it threw" is the difference
 * between proving *which* invariant held and merely proving something broke.
 */
async function violatedConstraint(run: () => Promise<unknown>): Promise<string> {
  try {
    await run()
  } catch (error) {
    const cause = (error as { cause?: { constraint?: string } }).cause
    return cause?.constraint ?? `no constraint name on: ${(error as Error).message}`
  }
  throw new Error('Expected the query to be rejected, but it succeeded')
}

describeWithDb('database invariants', () => {
  let pool: Pool
  let db: Database
  const owner = `test-invariants-${randomUUID()}`
  let accountId: string
  let categoryId: string

  beforeAll(async () => {
    pool = new Pool({ connectionString: databaseUrl })
    db = drizzle(pool, { schema, casing: 'snake_case' })

    await db.insert(schema.user).values({
      id: owner,
      name: 'Invariants',
      email: `${owner}@example.test`,
      emailVerified: true
    })
    const [account] = await db
      .insert(schema.financialAccounts)
      .values({ userId: owner, name: 'Cash', type: 'cash' })
      .returning({ id: schema.financialAccounts.id })
    accountId = account!.id

    const [category] = await db
      .select({ id: schema.categories.id })
      .from(schema.categories)
      .where(eq(schema.categories.isSystem, true))
      .limit(1)
    categoryId = category!.id
  })

  afterAll(async () => {
    await db.delete(schema.user).where(eq(schema.user.id, owner))
    await pool.end()
  })

  const insertTransaction = (values: Partial<typeof schema.transactions.$inferInsert>) =>
    db.insert(schema.transactions).values({
      userId: owner,
      accountId,
      type: 'expense',
      amountPesewas: 1000,
      occurredOn: '2026-10-17',
      ...values
    })

  it('rejects a zero or negative amount', async () => {
    expect(await violatedConstraint(() => insertTransaction({ amountPesewas: 0 }))).toBe(
      'transactions_amount_positive'
    )
    expect(await violatedConstraint(() => insertTransaction({ amountPesewas: -500 }))).toBe(
      'transactions_amount_positive'
    )
  })

  it('rejects a transfer without both a group and a direction', async () => {
    expect(await violatedConstraint(() => insertTransaction({ type: 'transfer' }))).toBe(
      'transactions_transfer_shape'
    )
    expect(
      await violatedConstraint(() =>
        insertTransaction({ type: 'transfer', transferGroupId: randomUUID() })
      )
    ).toBe('transactions_transfer_shape')
  })

  it('rejects a non-transfer carrying transfer fields', async () => {
    expect(
      await violatedConstraint(() =>
        insertTransaction({ type: 'expense', transferGroupId: randomUUID() })
      )
    ).toBe('transactions_transfer_shape')
  })

  it('rejects a categorised transfer — moving money is not spending', async () => {
    expect(
      await violatedConstraint(() =>
        insertTransaction({
          type: 'transfer',
          transferDirection: 'out',
          transferGroupId: randomUUID(),
          categoryId
        })
      )
    ).toBe('transactions_transfer_uncategorised')
  })

  it('allows only one budget per user per month', async () => {
    await db
      .insert(schema.budgets)
      .values({ userId: owner, periodStart: '2026-10-01', periodEnd: '2026-10-31' })

    expect(
      await violatedConstraint(() =>
        db
          .insert(schema.budgets)
          .values({ userId: owner, periodStart: '2026-10-01', periodEnd: '2026-10-31' })
      )
    ).toBe('budgets_user_period_idx')
  })

  it('rejects a budget that does not start on the first of a month', async () => {
    expect(
      await violatedConstraint(() =>
        db
          .insert(schema.budgets)
          .values({ userId: owner, periodStart: '2026-11-15', periodEnd: '2026-11-30' })
      )
    ).toBe('budgets_period_start_is_month_start')
  })

  it('allows only one limit per category within a budget', async () => {
    const [budget] = await db
      .insert(schema.budgets)
      .values({ userId: owner, periodStart: '2026-12-01', periodEnd: '2026-12-31' })
      .returning({ id: schema.budgets.id })

    await db
      .insert(schema.budgetAllocations)
      .values({ budgetId: budget!.id, categoryId, limitPesewas: 50_000 })

    expect(
      await violatedConstraint(() =>
        db
          .insert(schema.budgetAllocations)
          .values({ budgetId: budget!.id, categoryId, limitPesewas: 70_000 })
      )
    ).toBe('budget_allocations_budget_category_idx')
  })

  it('stops one transfer from backing two goal entries', async () => {
    const transferGroupId = randomUUID()
    const [leg] = await db
      .insert(schema.transactions)
      .values({
        userId: owner,
        accountId,
        type: 'transfer',
        transferDirection: 'in',
        transferGroupId,
        amountPesewas: 30_000,
        occurredOn: '2026-10-17'
      })
      .returning({ id: schema.transactions.id })

    const goalIds = await db
      .insert(schema.goals)
      .values([
        { userId: owner, name: 'Laptop', targetPesewas: 300_000 },
        { userId: owner, name: 'Rent', targetPesewas: 500_000 }
      ])
      .returning({ id: schema.goals.id })

    await db.insert(schema.goalEntries).values({
      userId: owner,
      goalId: goalIds[0]!.id,
      amountPesewas: 30_000,
      occurredOn: '2026-10-17',
      linkedTransactionId: leg!.id
    })

    // The same GH₵300 must not count towards a second goal.
    expect(
      await violatedConstraint(() =>
        db.insert(schema.goalEntries).values({
          userId: owner,
          goalId: goalIds[1]!.id,
          amountPesewas: 30_000,
          occurredOn: '2026-10-17',
          linkedTransactionId: leg!.id
        })
      )
    ).toBe('goal_entries_linked_transaction_idx')
  })

  it('deletes a backed goal entry when its transfer is deleted', async () => {
    const transferGroupId = randomUUID()
    const [leg] = await db
      .insert(schema.transactions)
      .values({
        userId: owner,
        accountId,
        type: 'transfer',
        transferDirection: 'in',
        transferGroupId,
        amountPesewas: 20_000,
        occurredOn: '2026-10-18'
      })
      .returning({ id: schema.transactions.id })

    const [goal] = await db
      .insert(schema.goals)
      .values({ userId: owner, name: 'Phone', targetPesewas: 200_000 })
      .returning({ id: schema.goals.id })

    await db.insert(schema.goalEntries).values({
      userId: owner,
      goalId: goal!.id,
      amountPesewas: 20_000,
      occurredOn: '2026-10-18',
      linkedTransactionId: leg!.id
    })

    await db.delete(schema.transactions).where(eq(schema.transactions.id, leg!.id))

    // Cascade, not set-null: if the money never moved, the saving did not happen.
    const remaining = await db
      .select({ id: schema.goalEntries.id })
      .from(schema.goalEntries)
      .where(eq(schema.goalEntries.goalId, goal!.id))
    expect(remaining).toHaveLength(0)
  })
})
