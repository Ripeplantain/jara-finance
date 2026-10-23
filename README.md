# Salo

An AI-powered personal finance coach for Ghana. Track income and expenses across cash, Mobile Money and bank accounts, build monthly budgets, hit savings goals, and ask Salo what you can actually afford.

> **Know where your money goes, what you can afford, and what to do next.**

## Requirements

- **Node 22.22.0** — pinned in `.nvmrc`. Run `nvm use`. Nuxt 4.6 does not support Node 20.
- **pnpm 10**
- **Docker** — for local Postgres.

## Getting started

```bash
nvm use
pnpm install
cp .env.example .env     # then fill in BETTER_AUTH_SECRET and an AI key
pnpm db:up               # start Postgres on :5432
pnpm db:migrate          # apply migrations
pnpm db:seed             # system categories
pnpm dev                 # http://localhost:3100
```

Port **3100**, not 3000 — 3000 is taken by another local app.

Generate an auth secret with `openssl rand -base64 32`.

## Scripts

| Command | Does |
|---|---|
| `pnpm dev` | Dev server on :3100 |
| `pnpm typecheck` | `vue-tsc` over the whole project |
| `pnpm lint` / `pnpm lint:fix` | ESLint |
| `pnpm test` | Vitest — domain logic |
| `pnpm test:e2e` | Playwright — user flows |
| `pnpm db:up` / `db:down` | Postgres container |
| `pnpm db:generate` | Generate a migration from schema changes |
| `pnpm db:migrate` | Apply migrations |
| `pnpm db:studio` | Drizzle Studio |

## Architecture

A modular monolith. Nuxt handles both the UI and the API; there is no separate backend service.

```
app/          Vue pages, components, layouts  (Nuxt 4 srcDir)
server/
  api/        HTTP endpoints
  services/   Domain logic — the only place financial maths happens
  ai/tools/   Read-only tools the AI coach may call
  database/   Drizzle schema + migrations
shared/       Code used by both sides: money, periods, Zod schemas, types
tests/        unit/ (Vitest) and e2e/ (Playwright)
```

### Rules that are not negotiable

1. **Money is integer pesewas.** Never a float, anywhere in the money path. Use `shared/money`.
2. **Balances come from `server/services/balances.ts`.** Nothing recomputes a balance inline.
3. **Every user-data query filters by `userId` in its `where` clause** — never by checking ownership in JS after fetching.
4. **The AI never does arithmetic.** It calls a tool, gets numbers, and explains them. If a figure isn't in a tool result, Salo doesn't state it.
5. **Transfers are two rows sharing a `transferGroupId`**, written in one transaction. They are never income or expense.

### AI provider

Swappable via `AI_PROVIDER` (`anthropic` | `openai`) in `.env`. Defaults to Anthropic.

## Tech

Nuxt 4 · Vue 3 · TypeScript · Tailwind v4 · shadcn-vue / Reka UI · PostgreSQL · Drizzle · Better Auth · Vercel AI SDK · ECharts · Zod · Vitest · Playwright
