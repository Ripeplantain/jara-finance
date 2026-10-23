import {
  boolean,
  index,
  integer,
  pgEnum,
  pgTable,
  text,
  unique,
  uuid
} from 'drizzle-orm/pg-core'
import { createdAt, updatedAt } from './columns'
import { user } from './auth'

export const categoryKind = pgEnum('category_kind', ['income', 'expense'])

/**
 * System categories (`userId` null, `isSystem` true) are shared by everyone and
 * seeded by `server/database/seed.ts`. Custom categories belong to one user.
 *
 * Transfers never carry a category — moving your own money between your own
 * accounts is not spending, so there is nothing to categorise.
 */
export const categories = pgTable(
  'categories',
  {
    id: uuid().primaryKey().defaultRandom(),
    // Null means a system category. Every user-scoped read must therefore filter
    // `userId = $me OR userId IS NULL`, never `userId = $me` alone.
    userId: text().references(() => user.id, { onDelete: 'cascade' }),
    name: text().notNull(),
    kind: categoryKind().notNull(),
    // Lucide icon name, resolved on the client.
    icon: text().notNull().default('circle'),
    // A `--chart-N` token index, so category colours stay inside the design system.
    colorIndex: integer().notNull().default(1),
    isSystem: boolean().notNull().default(false),
    sortOrder: integer().notNull().default(100),
    isArchived: boolean().notNull().default(false),
    createdAt: createdAt(),
    updatedAt: updatedAt()
  },
  table => [
    index('categories_user_idx').on(table.userId),
    // Stops a user creating two "Food" expense categories.
    //
    // `nullsNotDistinct` is what makes this cover system categories too: by
    // default Postgres treats every NULL as distinct, so the null-`userId`
    // system rows would be free to duplicate on every re-seed. With it, the seed
    // script can upsert safely and remains idempotent.
    // A UNIQUE *constraint* rather than a unique index, because
    // `nullsNotDistinct` is only available on the constraint builder.
    unique('categories_user_name_kind_key')
      .on(table.userId, table.name, table.kind)
      .nullsNotDistinct()
  ]
)
