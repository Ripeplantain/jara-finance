# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Anyone in Ghana managing money across cash, Mobile Money and a bank account at
once. The user explicitly declined to optimise for a single segment — salaried
Accra professional, informal/irregular earner, and student all count — and asked
that the design serve **the moment of financial pressure all three share**: a
decision is pending, the money is finite, and the real figures are scattered
across three places that do not talk to each other.

Conditions are phone-first but desktop is genuinely used: a few glances a week on
a phone, mid-decision, plus an occasional longer sit-down at a desk. Neither
viewport is an afterthought.

## Product Purpose

Jara answers three questions from a user's own ledger: where the money went, what
is left, and what they can afford right now. Success is a user trusting a figure
on screen enough to act on it — to make or not make a purchase — without opening
a calculator or three banking apps.

## Positioning

Two mechanisms a neighbouring app could not truthfully copy:

1. **A conservative, stated affordability formula.**
   `available = liquid − committedSavings − remainingBudgetedSpend`, and
   `verdict = compare(price, available)` with a third state, `tight`, at 85% of
   available. "Available" deliberately subtracts money already promised to a
   goal and money budgeted but not yet spent, so the answer is what the user can
   spend *without breaking a plan they already made* — not what is merely
   sitting in their accounts. The formula is one pure function in
   `shared/money/affordability.ts` and is unit-tested at its edges.
2. **The AI never does arithmetic.** The coach calls a read-only tool, receives
   numbers, and explains them. If a figure is not in a tool result, Salo does not
   state it. The UI and the AI call the same `/api/affordability` endpoint, so the
   number on screen and the number Salo quotes cannot diverge.

The product's claim is therefore not "insight" but **arithmetic the user can
audit**.

## Operating Context

- Money lives in three parallel places — physical cash, Mobile Money, and a bank
  account that is often the least-used of the three. Balances are derived from a
  ledger, never stored.
- Currency is GHS, displayed as GH₵. Default timezone `Africa/Accra`, set per
  user at onboarding, and it decides what "this month" means for every figure.
- Periods are monthly, with `this_month`, `last_month`, `last_30_days`,
  `this_year`, `all_time`.
- Income frequency is a profile fact (the user says how often they are paid), and
  expected monthly income is optional because for many users it genuinely varies.
- A transfer between one's own accounts is neither income nor expense — a
  distinction most consumer finance UIs get wrong and this one enforces in the
  database.
- The AI coach is rate-limited to a daily message allowance (default 25), so its
  answers are a scarce resource the UI should not waste.

## Capabilities and Constraints

**Ships today:** email/password auth, onboarding (name, timezone, pay frequency,
optional expected income), accounts (cash / MoMo / bank, archivable), a
transaction ledger with income, expense and two-row transfers, 19 seeded system
categories plus user categories, monthly budgets with per-category limits and
pace tracking, savings goals with tracked and backed contributions, deterministic
insights, and an AI coach with eight read-only tools.

**Hard technical constraints, enforced in code and tests:**

1. Money is integer pesewas, never a float.
2. Balances come only from `server/services/balances.ts` and are never stored.
3. Every user-data query filters `userId` in its SQL `where` clause.
4. The AI never does arithmetic — it calls a tool and explains the result.
5. A transfer is two rows sharing a `transferGroupId`, in one transaction, and is
   never income or expense.
6. Schema changes go through generated Drizzle migrations.

Design work lives in `app/` and may not compute a financial figure in a
component, nor render money except through the `MoneyAmount` contract.

**Open product decision:** affordability is reachable today only through the AI
coach and a bare `/api/affordability` endpoint. There is no screen that makes
"can I afford this?" the primary act, and the user has named that screen the one
that must be undeniable. Whether it becomes a route, a persistent surface on the
dashboard, or both is undecided.

## Brand Commitments

- Name: the app is **Jara Finance**, shortened to **Jara** everywhere in the
  interface; the AI coach inside it is **Salo**. Tagline in the repo: "Know
  where your money goes, what you can afford, and what to do next."
- Voice: plain and specific. States the figure and where it came from. Says "it
  does not have that number" rather than guessing.
- **Never judgmental or preachy.** Red alarms, scolding copy and guilt as a
  motivator are out. The app reports; it does not lecture.
- **Never the crypto/hype aesthetic.** Neon on near-black, glow edges and
  breathless motion read as a scam to this audience.
- Binding visual constraints the user set directly: the brand mark is to be
  **geometric, in the spirit of Ghanaian adinkra stamp forms**, replacing the
  placeholder "S" tile; and the app is to carry a **real, self-hosted typeface**
  (via `@nuxt/fonts`) rather than the browser default stack.
- Money direction is meaning, not decoration — a long-standing commitment in this
  codebase, not a style preference.

## Evidence on Hand

- `README.md` is current and is the closest thing to a spec.
- `server/database/seed-data.ts` — 19 real system categories.
- Working API surface across dashboard, transactions, budgets, goals, insights,
  affordability and the AI chat.
- No logo asset of any kind exists. `public/favicon.ico` is a placeholder and the
  in-app mark is the letter "S" in a rounded square.
- No typeface is configured; the app renders in the browser's default sans.
- **Absences that must not be fabricated:** there are no users, no customers, no
  testimonials, no press, no pricing, no benchmarks, no funding, no partnerships,
  no bank or telco integrations, and no launch date. Six code comments cite a PRD
  by section but no PRD file exists in the repo. Any figure shown in design work
  is demonstration data and must be labelled as such.

## Product Principles

1. **Show the arithmetic.** Every figure can be traced to the rows that produced
   it. The user's trust is the product; an unexplained number spends it.
2. **Answer the decision, not the category.** The useful output is "yes, and this
   is what is left" — not a dashboard the user has to interpret.
3. **Conservative by default.** Where a figure could be read two ways, show the
   one that will not break a plan the user already made.
4. **Report, never lecture.** Name the fact and what it implies. The user decides
   what it means about them.
5. **Three places, one answer.** Cash, MoMo and bank are an implementation
   detail of the user's life, not a structure the interface should impose.

## Accessibility & Inclusion

- Money direction is never conveyed by colour alone.
- Every control is labelled; progress and chart elements keep their `aria-*`.
- Light and dark must both work — tokens are defined twice.
- Mobile-first at phone width, and usable at desktop width without a separate
  design.
