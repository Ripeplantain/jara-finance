---
name: Jara Finance
description: A calm financial command centre that makes the next money decision clear.
colors:
  cloud: "oklch(0.975 0.006 255)"
  surface: "oklch(1 0 0)"
  ink: "oklch(0.21 0.035 265)"
  primary: "oklch(0.52 0.205 265)"
  signal: "oklch(0.76 0.12 205)"
  income: "oklch(0.55 0.145 155)"
  expense: "oklch(0.57 0.20 25)"
  warning: "oklch(0.53 0.14 75)"
  saving: "oklch(0.55 0.18 300)"
typography:
  family: "Archivo, ui-sans-serif, system-ui, sans-serif"
  display: "700 / clamp(2.5rem, 5vw, 3.5rem)"
  page-title: "700 / clamp(1.75rem, 3vw, 2.25rem)"
  body: "400 / 0.9375rem"
  label: "600 / 0.75rem"
radius:
  control: "10px"
  compact-card: "14px"
  card: "18px"
  hero: "24px"
---

# Design System: Jara Finance

## Creative North Star: Calm Signal

Jara is a modern financial command centre for a pressured decision: what is
safe to do next? Its interface is calm, spacious and direct. A cool cloud
canvas holds clean elevated surfaces; ultramarine carries action and confidence;
cyan is a restrained signal of movement. The result should feel capable and
current without drifting into fintech hype.

This replaces the former paper, stamp and tally-card metaphor in full. Do not
restore ruled backgrounds, square stamped cells, hatching, institutional green
shells, or vintage-ledger language.

## Brand identity

Jara owns an open-loop `J` mark: a circular path with an opening at the upper
right and a small signal endpoint. The open path means room to move; the loop
means one complete view of money. The mark is authored as SVG, works in
`currentColor`, and remains legible at favicon size.

Jara and Salo are different identities. `JaraMark` appears in product chrome,
auth and favicons. Salo, the coach, uses a compact conversational avatar. Never
label the app Salo or use the Jara brand mark as the coach avatar.

## Colour

The CSS custom properties in `app/assets/css/main.css` are the source of truth.
Every token has a light and dark value.

- **Primary ultramarine**: primary actions, links, selection and active
  navigation.
- **Signal cyan**: restrained supporting accent in brand and data moments.
- **Cloud / surface / raised surface**: page, ordinary panels and emphasized
  panels. Dark mode uses deep navy rather than pure black.
- **Income emerald, expense coral, warning amber, saving violet**: financial
  meaning only. They remain named tokens and always have a second cue such as a
  sign, label, icon or texture.
- **Chart ramp**: token driven and distinguishable in both themes.

Avoid neon, glow edges, pure black, gradient text and decorative glass. A soft
ultramarine-to-violet wash is reserved for the primary availability surface and
auth artwork.

## Typography

Archivo remains self-hosted through `@nuxt/fonts`; no runtime third-party font
host is introduced. Character comes from scale and hierarchy:

- Display: 40–56px, 700 weight, tight tracking.
- Page title: 28–36px, 700 weight.
- Card title: 15–18px, 600 weight.
- Body: 14–16px, 400–500 weight.
- Labels: 12–13px, 600 weight.
- Money: 650–700 weight with tabular numerals.

Money is rendered only through `MoneyAmount`.

## Shape, surfaces and depth

- Controls use a 10px radius; compact cards 14px; normal cards 18px; brand
  heroes 24px.
- Cards use a quiet border and soft two-layer shadow. Hierarchy comes from
  spacing, contrast and elevation, not divider lines under every title.
- Full pills are limited to statuses, chips and compact filters.
- Primary buttons may be pill-adjacent; content containers never are.
- Do not nest cards unless a genuinely independent interactive region requires
  it.

## Signature visualization: Funds Map

`FundsMap` makes the affordability arithmetic visible as a segmented band:
money promised to goals, money budgeted but not spent, a purchase under
consideration, and money still available. Each segment has text and a distinct
visual treatment, so colour is never the only cue. On narrow screens the
labels stack instead of collapsing into tiny marks.

The component never calculates financial truth. It receives integer-pesewa
figures already returned by the server and only derives presentation widths.

## Navigation

Desktop uses a 256px surface sidebar with rounded navigation items and a short
ultramarine active indicator. The account/settings block is quiet and compact.
Mobile uses a surface header and safe-area-aware bottom navigation. All six
destinations remain available; Afford receives emphasis through placement and
colour rather than a floating gimmick.

## Route patterns

- **Dashboard:** availability hero and Funds Map first, compact KPI cards, then
  insights, spending and accounts in a responsive grid.
- **Afford:** large price composer, decisive verdict, Funds Map and auditable
  arithmetic.
- **Transactions:** one filter surface, calm rows, distinct money-direction
  icons and right-aligned figures.
- **Budgets:** month overview, rounded progress tracks with pace marker, then
  category rows/cards.
- **Goals:** responsive goal cards with saving-toned progress and clear actions.
- **Salo:** focused conversation column, separate coach avatar, useful starter
  prompts and a stable composer.
- **Settings:** grouped section surfaces with a sticky desktop sub-navigation.
- **Auth/onboarding:** asymmetric brand field plus a focused elevated form; the
  mobile form remains single-column.

## Motion

- Hover and focus transitions: 140–180ms.
- Surface entry: opacity plus 4–8px translation, 180–240ms.
- Progress and Funds Map: 400–550ms ease-out.
- Button press: subtle scale to 0.98.
- Never animate financial values by counting.
- Respect `prefers-reduced-motion` and keep interactions interruptible.

## Accessibility and mobile

- Minimum coarse-pointer target: 44px.
- Phone gutter: 16px; safe areas apply to fixed chrome.
- Financial state never relies on colour alone.
- Charts and segmented graphics expose text equivalents and accessible labels.
- Loading, empty and error states appear on every data route.
- Focus is visible in both themes; contrast is checked for normal text and
  finance-semantic colours.
- Test every route at 390px and 1440px in light and dark.

## Implementation boundaries

- Theme tokens and app-owned overrides live in `app/assets/css/main.css`.
- Shared product components live in `app/components/`.
- Vendored primitives in `app/components/ui/` are never hand-edited.
- Lucide remains the single interface icon set; the logo and coach avatar are
  authored product SVGs.
- No component derives balances or invents money. Finance invariants in
  `.agent/PROJECT.md` remain binding.
