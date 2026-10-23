/**
 * Schema barrel.
 *
 * `server/database/` is NOT an auto-imported directory, so the usual Nuxt rule
 * against barrel files doesn't apply here — and both `drizzle-kit` (which needs
 * one entry point to diff against) and the relational query builder (which needs
 * every table in one object) expect exactly this.
 */
export * from './auth'
export * from './profile'
export * from './accounts'
export * from './categories'
export * from './transactions'
export * from './budgets'
export * from './goals'
export * from './ai'
export * from './insights'
