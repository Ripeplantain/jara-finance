import { z } from 'zod'
import { textSchema } from './common'

export const CATEGORY_KINDS = ['income', 'expense'] as const
export type CategoryKind = (typeof CATEGORY_KINDS)[number]

export const createCategorySchema = z.object({
  name: textSchema(60, 'Category name'),
  kind: z.enum(CATEGORY_KINDS),
  icon: textSchema(40, 'Icon').default('circle'),
  // Indexes into the `--chart-N` design tokens, so a custom category can never
  // introduce a colour from outside the design system.
  colorIndex: z.number().int().min(1).max(6).default(1)
})

export const categoryQuerySchema = z.object({
  kind: z.enum(CATEGORY_KINDS).optional(),
  includeArchived: z.coerce.boolean().default(false)
})

export type CreateCategoryInput = z.infer<typeof createCategorySchema>
