import { and, asc, eq, isNotNull, sql } from 'drizzle-orm'
import type {
  ContributeToGoalInput,
  CreateGoalInput,
  UpdateGoalInput
} from '#shared/schemas/goals'
import { addPesewas, assertSafePesewas, dividePesewas, sumPesewas } from '#shared/money/pesewas'
import { deriveProgress, type Progress } from '#shared/money/progress'
import {
  compareIsoDates,
  monthsBetween,
  startOfMonth,
  todayInTimezone,
  type IsoDate
} from '#shared/period/month'
import { financialAccounts, goalEntries, goals } from '../database/schema'
import type { Database, DatabaseTransaction } from '../types/database'
import { assertOwnedAccount } from './accounts'
import { createTransfer } from './transactions'

/**
 * Savings goals and their contributions.
 *
 * A contribution is one of two kinds, and the distinction is the whole point of
 * this module (see `goalEntries` in the schema):
 *
 * - **tracked** — intent only. No money moves; balances are untouched.
 * - **backed** — a real transfer into the goal's account, linked to the entry.
 *
 * Progress reports both separately. Collapsing them into one number would
 * either overstate what the user has actually put aside, or understate what
 * they have committed to.
 */

export interface GoalProgress extends Progress {
  id: string
  name: string
  status: 'active' | 'achieved' | 'archived'
  targetDate: IsoDate | null
  accountId: string | null
  accountName: string | null
  /** Contributions representing real money movements. */
  backedPesewas: number
  /** Contributions that are bookkeeping intent only. */
  trackedPesewas: number
  /** Whole months from this month to the target month, floored at 0. */
  monthsRemaining: number | null
  /**
   * What to put aside each remaining month to land on target. Null when there
   * is no date (nothing to divide by) or the goal is already met.
   */
  suggestedMonthlyPesewas: number | null
  /** True when a dated goal can no longer be reached by its date. */
  isBehind: boolean
  entryCount: number
  /** Contributions dated in the current month, in the user's timezone. */
  thisMonthPesewas: number
}

export async function listGoals(userId: string, timezone: string): Promise<GoalProgress[]> {
  return queryGoals(useDb(), userId, timezone)
}

/**
 * Saved and target across the goals still being worked towards, for the one
 * headline line on the Budgets screen. Summed here so no component adds money.
 */
export function summariseActiveGoals(list: GoalProgress[]) {
  const active = list.filter(goal => goal.status === 'active')
  return {
    savedPesewas: sumPesewas(active.map(goal => goal.actualPesewas)),
    targetPesewas: sumPesewas(active.map(goal => goal.targetPesewas))
  }
}

export async function queryGoals(
  db: Database,
  userId: string,
  timezone: string,
  now: Date = new Date()
): Promise<GoalProgress[]> {
  const today = todayInTimezone(timezone, now)
  const monthStart = startOfMonth(today)

  const rows = await db
    .select({
      id: goals.id,
      name: goals.name,
      targetPesewas: goals.targetPesewas,
      targetDate: goals.targetDate,
      status: goals.status,
      accountId: goals.accountId,
      accountName: financialAccounts.name,
      // Split in SQL by whether the entry is linked to a real transaction, so
      // "actually moved" and "intended" never get conflated in transit.
      backed: sql<string>`coalesce(sum(${goalEntries.amountPesewas}) filter (where ${goalEntries.linkedTransactionId} is not null), 0)::text`,
      tracked: sql<string>`coalesce(sum(${goalEntries.amountPesewas}) filter (where ${goalEntries.linkedTransactionId} is null), 0)::text`,
      entryCount: sql<string>`count(${goalEntries.id})::text`,
      thisMonth: sql<string>`coalesce(sum(${goalEntries.amountPesewas}) filter (where ${goalEntries.occurredOn} >= ${monthStart}), 0)::text`
    })
    .from(goals)
    .leftJoin(financialAccounts, eq(financialAccounts.id, goals.accountId))
    // The entry join is scoped by `userId` as well as `goalId`: ownership is
    // asserted at every hop rather than inferred from a foreign key.
    .leftJoin(
      goalEntries,
      and(eq(goalEntries.goalId, goals.id), eq(goalEntries.userId, userId))
    )
    .where(eq(goals.userId, userId))
    .groupBy(goals.id, financialAccounts.name)
    .orderBy(asc(goals.status), asc(goals.targetDate), asc(goals.name))

  return rows.map((row) => {
    const backedPesewas = assertSafePesewas(Number(row.backed), 'backedPesewas')
    const trackedPesewas = assertSafePesewas(Number(row.tracked), 'trackedPesewas')
    const savedPesewas = addPesewas(backedPesewas, trackedPesewas)
    const progress = deriveProgress(savedPesewas, row.targetPesewas)

    const monthsRemaining = row.targetDate
      ? Math.max(0, monthsBetween(startOfMonth(today), startOfMonth(row.targetDate)))
      : null

    // Divided rather than plain-divided: `dividePesewas` distributes the
    // remainder so the monthly figures sum back to exactly what is left. Naive
    // division would leave the user a few pesewas short at the end.
    const suggestedMonthlyPesewas =
      monthsRemaining !== null && monthsRemaining > 0 && progress.remainingPesewas > 0
        ? dividePesewas(progress.remainingPesewas, monthsRemaining)[0]!
        : null

    return {
      id: row.id,
      name: row.name,
      status: row.status,
      targetDate: row.targetDate,
      accountId: row.accountId,
      accountName: row.accountName,
      backedPesewas,
      trackedPesewas,
      monthsRemaining,
      suggestedMonthlyPesewas,
      // Past its date with money still to find.
      isBehind:
        row.targetDate !== null
        && progress.remainingPesewas > 0
        && compareIsoDates(today, row.targetDate) > 0,
      entryCount: Number(row.entryCount),
      thisMonthPesewas: assertSafePesewas(Number(row.thisMonth), 'thisMonthPesewas'),
      ...progress
    }
  })
}

export async function createGoal(userId: string, input: CreateGoalInput) {
  const db = useDb()
  if (input.accountId) {
    await assertOwnedAccount(db, userId, input.accountId, 'savings account')
  }

  const [goal] = await db
    .insert(goals)
    .values({
      userId,
      name: input.name,
      targetPesewas: input.target,
      targetDate: input.targetDate,
      accountId: input.accountId
    })
    .returning()

  return goal
}

export async function updateGoal(userId: string, goalId: string, input: UpdateGoalInput) {
  const db = useDb()
  if (input.accountId) {
    await assertOwnedAccount(db, userId, input.accountId, 'savings account')
  }

  const [goal] = await db
    .update(goals)
    .set({
      ...(input.name !== undefined && { name: input.name }),
      ...(input.target !== undefined && { targetPesewas: input.target }),
      ...(input.targetDate !== undefined && { targetDate: input.targetDate }),
      ...(input.accountId !== undefined && { accountId: input.accountId }),
      ...(input.status !== undefined && { status: input.status }),
      updatedAt: new Date()
    })
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .returning()

  if (!goal) {
    throw createError({ statusCode: 404, statusMessage: 'Goal not found' })
  }

  return goal
}

/**
 * Records a contribution.
 *
 * A **backed** contribution delegates to `createTransfer`, which writes the
 * transfer pair and the linked goal entry in one database transaction. Writing
 * the transfer here instead would duplicate the ledger's most safety-critical
 * code path, and the two copies would eventually disagree.
 *
 * A **tracked** contribution is a single row and moves no money.
 */
export async function contributeToGoal(
  userId: string,
  goalId: string,
  input: ContributeToGoalInput
) {
  const db = useDb()
  const goal = await assertOwnedGoal(db, userId, goalId)

  if (input.kind === 'tracked') {
    const [entry] = await db
      .insert(goalEntries)
      .values({
        userId,
        goalId,
        amountPesewas: input.amount,
        occurredOn: input.occurredOn,
        note: input.note
      })
      .returning()

    return { kind: 'tracked' as const, entry }
  }

  if (!goal.accountId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'Give this goal a savings account before moving money into it'
    })
  }

  const transfer = await createTransfer(userId, {
    fromAccountId: input.fromAccountId!,
    toAccountId: goal.accountId,
    amount: input.amount,
    occurredOn: input.occurredOn,
    note: input.note ?? `Towards ${goal.name}`,
    goalId
  })

  return { kind: 'backed' as const, transfer }
}

/**
 * Deletes a contribution.
 *
 * A backed entry cannot be deleted on its own — the money really moved, and
 * removing the bookkeeping while leaving the transfer would make goal progress
 * disagree with the ledger. Deleting the transfer removes the entry via the
 * cascade on `linkedTransactionId`.
 */
export async function deleteGoalEntry(userId: string, entryId: string) {
  const db = useDb()

  const [entry] = await db
    .select({
      id: goalEntries.id,
      linkedTransactionId: goalEntries.linkedTransactionId
    })
    .from(goalEntries)
    .where(and(eq(goalEntries.id, entryId), eq(goalEntries.userId, userId)))
    .limit(1)

  if (!entry) {
    throw createError({ statusCode: 404, statusMessage: 'Contribution not found' })
  }
  if (entry.linkedTransactionId) {
    throw createError({
      statusCode: 409,
      statusMessage: 'This contribution is a real transfer — delete the transfer instead',
      data: { transactionId: entry.linkedTransactionId }
    })
  }

  await db.delete(goalEntries).where(
    and(eq(goalEntries.id, entryId), eq(goalEntries.userId, userId))
  )

  return { deleted: true }
}

/** A goal's contributions, newest first. */
export async function listGoalEntries(userId: string, goalId: string) {
  const db = useDb()
  await assertOwnedGoal(db, userId, goalId)

  return db
    .select({
      id: goalEntries.id,
      amountPesewas: goalEntries.amountPesewas,
      occurredOn: goalEntries.occurredOn,
      note: goalEntries.note,
      linkedTransactionId: goalEntries.linkedTransactionId
    })
    .from(goalEntries)
    .where(and(eq(goalEntries.goalId, goalId), eq(goalEntries.userId, userId)))
    .orderBy(sql`${goalEntries.occurredOn} desc`, sql`${goalEntries.createdAt} desc`)
}

/** Total real money committed to active goals — the `committed` affordability term. */
export async function getCommittedSavings(db: Database, userId: string): Promise<number> {
  const [row] = await db
    .select({
      total: sql<string>`coalesce(sum(${goalEntries.amountPesewas}), 0)::text`
    })
    .from(goalEntries)
    .innerJoin(goals, eq(goals.id, goalEntries.goalId))
    .where(
      and(
        eq(goalEntries.userId, userId),
        eq(goals.status, 'active'),
        isNotNull(goalEntries.linkedTransactionId)
      )
    )

  return assertSafePesewas(Number(row?.total ?? 0), 'committedPesewas')
}

export async function assertOwnedGoal(
  db: Database | DatabaseTransaction,
  userId: string,
  goalId: string
) {
  const [goal] = await db
    .select({
      id: goals.id,
      name: goals.name,
      accountId: goals.accountId,
      targetPesewas: goals.targetPesewas,
      status: goals.status
    })
    .from(goals)
    .where(and(eq(goals.id, goalId), eq(goals.userId, userId)))
    .limit(1)

  if (!goal) {
    throw createError({ statusCode: 404, statusMessage: 'That goal does not exist' })
  }

  return goal
}
