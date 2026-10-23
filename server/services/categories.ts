import { and, asc, eq, isNull, or } from 'drizzle-orm'
import type { CreateCategoryInput } from '#shared/schemas/categories'
import { categories } from '../database/schema'
import type { Database } from '../types/database'

/**
 * Categories are either shared system rows (`userId` null) or one user's own.
 *
 * Every read therefore filters `userId = $me OR userId IS NULL`. Filtering on
 * `userId = $me` alone — the obvious thing to write — would hide every seeded
 * category and leave new users with nothing to pick.
 */

export async function listCategories(
  userId: string,
  options: { kind?: 'income' | 'expense', includeArchived?: boolean } = {}
) {
  return queryCategories(useDb(), userId, options)
}

export async function queryCategories(
  db: Database,
  userId: string,
  options: { kind?: 'income' | 'expense', includeArchived?: boolean } = {}
) {
  return db
    .select({
      id: categories.id,
      name: categories.name,
      kind: categories.kind,
      icon: categories.icon,
      colorIndex: categories.colorIndex,
      isSystem: categories.isSystem,
      isArchived: categories.isArchived,
      sortOrder: categories.sortOrder
    })
    .from(categories)
    .where(
      and(
        or(eq(categories.userId, userId), isNull(categories.userId)),
        options.kind ? eq(categories.kind, options.kind) : undefined,
        options.includeArchived ? undefined : eq(categories.isArchived, false)
      )
    )
    .orderBy(asc(categories.sortOrder), asc(categories.name))
}

export async function createCategory(userId: string, input: CreateCategoryInput) {
  try {
    const [category] = await useDb()
      .insert(categories)
      .values({
        userId,
        name: input.name,
        kind: input.kind,
        icon: input.icon,
        colorIndex: input.colorIndex,
        isSystem: false,
        // After the system rows, so custom categories sort below the familiar ones.
        sortOrder: 500
      })
      .returning()

    return category
  } catch (error) {
    // The `(userId, name, kind)` unique constraint. Reported as a conflict with
    // a readable message rather than a 500 on a raw Postgres error string.
    if (isUniqueViolation(error)) {
      throw createError({
        statusCode: 409,
        statusMessage: `You already have a ${input.kind} category called "${input.name}"`
      })
    }
    throw error
  }
}

function isUniqueViolation(error: unknown): boolean {
  return (error as { code?: string })?.code === '23505'
}

/**
 * Asserts the category exists, is usable by the user, and matches the expected
 * kind — an expense can't be filed under an income category.
 */
export async function assertUsableCategory(
  db: Database,
  userId: string,
  categoryId: string,
  kind: 'income' | 'expense'
) {
  const [category] = await db
    .select({ id: categories.id, kind: categories.kind })
    .from(categories)
    .where(
      and(
        eq(categories.id, categoryId),
        or(eq(categories.userId, userId), isNull(categories.userId))
      )
    )
    .limit(1)

  if (!category) {
    throw createError({ statusCode: 404, statusMessage: 'That category does not exist' })
  }
  if (category.kind !== kind) {
    throw createError({
      statusCode: 400,
      statusMessage: `That is an ${category.kind} category, but this is an ${kind}`
    })
  }

  return category
}
