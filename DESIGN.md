---
name: Jara Finance
description: A quiet, editorial financial companion that makes the next money decision clear.
colors:
  paper: "#f7f4ee"
  surface: "#fffdf9"
  tint: "#efeae0"
  ink: "#1d2a27"
  muted: "#5b6762"
  teal: "#14574f"
  teal-deep: "#0f433d"
  teal-soft: "#e1ece8"
  champagne: "#c9a46a"
  champagne-ink: "#7a5c28"
  clay: "#9c4a32"
  dark-paper: "#121a18"
  dark-surface: "#1a2421"
  dark-ink: "#ece6da"
  dark-teal: "#5bbfaf"
  dark-champagne-ink: "#dcbc82"
typography:
  serif: "Fraunces, Iowan Old Style, Palatino Linotype, Georgia, serif"
  sans: "Instrument Sans, ui-sans-serif, system-ui, sans-serif"
  display: "Fraunces 400 / clamp(3.6rem, 12.5vw, 8rem)"
  page-title: "Fraunces 400 / clamp(2rem, 4.4vw, 3rem)"
  section-title: "Fraunces 400-500 / clamp(1.5rem, 2.6vw, 1.85rem)"
  body: "Instrument Sans 400 / 1rem"
  label: "Instrument Sans 500 / 0.78rem, uppercase, 0.12em tracking"
radius:
  control: "10px"
  card: "18px"
  sheet: "20px"
  pill: "999px"
---

# Design System: Jara Finance

## Creative North Star: Modern Financial Minimalism

Jara is a quiet place to make a pressured decision: what is safe to do next? The
interface reads like a well-set letter, not a trading floor. Warm paper holds
generous space; a deep teal carries action and income; ink carries everything
else. Sections are separated by space and hairlines, not by boxes. Figures are
large, set in a serif, and always traceable.

The direction was chosen from five design previews (v1, "Modern Financial
Minimalism", was picked; the previews have since been removed). Its rules now
live in `app/assets/css/v1.css`. Where this document and that file differ, fix
whichever is wrong and keep them in step.

Avoid: neon, glow edges, pure black, gradient text, decorative glass, ruled
paper and stamp metaphors, the former ultramarine and Archivo "Calm Signal"
system, and any red-alarm treatment of spending.

## Brand identity

Jara owns the open-loop `J` mark (`JaraMark`): a circular path with an opening at
the upper right. The open path means room to move; the loop means one complete
view of money. It is authored SVG, uses `currentColor`, and is set in teal beside
a Fraunces "Jara" wordmark (weight 500, tight tracking). The loop's end dot uses
the `--aqua` token.

Jara and Salo are different identities. `JaraMark` appears in product chrome,
auth and favicons. Salo, the coach, uses a compact conversational avatar. Never
label the app Salo or use the Jara mark as the coach avatar.

## Colour

`app/assets/css/main.css` is the source of truth; every token has a light and a
dark value. Existing shadcn token names are kept.

| Role | Light | Dark |
|---|---|---|
| Page (`background`) | `#f7f4ee` paper | `#121a18` deep green-ink |
| Surface (`card`) | `#fffdf9` | `#1a2421` |
| Text (`foreground`) | `#1d2a27` ink | `#ece6da` |
| Secondary text (`muted-foreground`) | `#5b6762` | `#a3aea8` |
| Primary / income | `#14574f` teal | `#5bbfaf` lifted teal |
| Expense | `#1d2a27` ink | `#ece6da` |
| Saving / warning | `#7a5c28` champagne-ink | `#dcbc82` |
| Destructive | `#9c4a32` clay | `#e59273` |
| Champagne (decorative only) | `#c9a46a` | `#b8985f` |

Rules:

- **Direction is sign and label, never colour alone.** Expenses render in ink
  with a minus sign; income in teal with a plus sign or "in" label. There are no
  red alarms for spending.
- **Champagne is used sparingly** (a rule, a tick, a track in "watch" state) and
  never as text colour. Text that needs a champagne feel uses champagne-ink.
- Clay is for destructive actions and "over" states, always with words.
- **Chart ramp** (`--chart-1..6`): teal, bronze, slate blue, plum, sage, rust.
  Every series also carries a label or direct end-label.
- **Light is the default.** Dark mode is opt-in from the theme menu in the app bar (Light / Dark /
  System, saved on the device); the operating system's preference alone does
  not switch it. Dark is a warm deep-green ink, never pure black, with a lifted
  teal and softened champagne.

Contrast, audited with a script (WCAG 2.x), light / dark: text on page 13.5 /
14.2; text on surface 14.6 / 12.8; muted text on page 5.4 / 7.7, on surface
5.8 / 7.0, on tint 4.9 / 6.4; primary on surface 8.3 / 7.2; primary-foreground
on primary 8.3 / 8.2; champagne-ink on page 5.6 / 9.7; destructive on page
5.6 / 7.3; input border on page 3.4 / 4.9 (3:1 for UI). All text pairs clear
AA (4.5:1).

## Typography

Both families are self-hosted through `@nuxt/fonts` (Google provider, Latin
subset); no runtime third-party font host is introduced.

- **Fraunces** (400, 500): the wordmark, page titles, section titles, and large
  figures. Exposed as `--font-serif` and the `.font-display` helper. The
  optical-size axis is not available through the module's Google provider, so
  nothing relies on `font-variation-settings`; display sizes use size and
  tracking (-0.02em to -0.035em) instead.
- **Instrument Sans** (400, 500, 600): interface text, labels, controls.
  `--font-sans`.
- Display figure 58-128px; page title 32-48px; section title 24-30px; body
  16px; secondary 14px; eyebrow label 12.5px uppercase with 0.12em tracking.
- Money uses tabular, lining numerals (`.tabular`) and is rendered only through
  `MoneyAmount`.

## Shape, surfaces and depth

- Nearly borderless. Panels are a surface-coloured block with a 1px hairline
  ring at about 5% ink and a faint shadow (`--surface-shadow`); hover raises
  the ring slightly. No divider under every title.
- Lists and ledgers use hairline rules (12% ink) between rows, with no outer
  box.
- Radius: controls 10px, cards 18px, sheets 20px on the open edge. Pills
  (999px) for primary buttons, chips and status only.
- Inputs are a single underline (`.j-field`, `.j-search`) that thickens to teal
  on focus; the add, goal, contribution and account forms all use it.
- Do not nest cards.

## Signature visualization: Funds Map

`FundsMap` makes the affordability arithmetic visible as a segmented band: money
promised to goals, money budgeted but unspent, the purchase under consideration,
and money still available. Each segment has text and a distinct treatment, so
colour is never the only cue. It never calculates financial truth: it receives
integer-pesewa figures from the server and derives only presentation widths.

## Navigation

v1's four destinations plus Jara's Afford: **Dashboard · Transactions ·
Budgets · Insights · Afford**. The theme menu and Settings are icons. Salo is
not a destination; see below. Goals are managed on
`/goals` but belong to Budgets (the nav marks Budgets active there), as in v1's
"Budgets and goals" screen.

- **Desktop:** a sticky 68px top bar on translucent paper with a bottom
  hairline: mark and wordmark at left, the six items centred (active item has an
  ink underline that draws in), the "Add transaction" pill and Settings at right.
  Content sits in a single 1040px column with fluid gutters
  (`clamp(20px, 5vw, 48px)`).
- **Phone (under 860px):** a 56px header with the mark, the Add pill and
  Settings, and v1's flat bottom tab bar — Dashboard, Transactions, Budgets,
  Insights — plus "More" (Afford, Settings) in a sheet. Safe-area aware,
  each tab at least 60px tall; the active tab uses teal.

## Route patterns

Dashboard, Transactions, Budgets and Insights were ported from the v1 preview
screens rule for rule, through the `.j-*` classes in `app/assets/css/v1.css`.
The other pages are composed from the same parts.

- **Dashboard:** name and date, range switch, the serif "available" figure with
  a champagne currency symbol, the stacked band, one insight as a pull quote,
  income and spending with a six-month chart, where it went, recent rows, and
  the budget and goals sentences.
- **Transactions:** search first, text toggles and selects, months with In/Out
  totals, rows opening a detail sheet. Add is a sheet.
- **Budgets:** the month as a sentence and track, each category with a pace tick
  and its status in words ("Comfortably within", "Nearly there", "Past the
  limit"), a −/+ stepper that saves, then savings goals as rings.
- **Insights:** the shape of the month, this month beside last, and notes.
  Observations only; never predictions.
- **Goals:** each goal as a hairline row with its ring, moved versus planned,
  the monthly figure and "Add money"; create and contribute in sheets.
- **Afford:** an underlined serif price field, a one-word verdict and sentence,
  `FundsMap`, then the arithmetic as a hairline sum.
- **Month switching:** Home and Budgets show one month at a time with a
  `‹ October 2026 ›` switcher (`MonthSwitcher`), kept in the URL as `?month=`
  so the plain address always means now. Home goes back freely and stops at the
  current month; Budgets also reaches 12 months ahead, and offers to copy the
  previous month's limits into an empty month (editor opens pre-filled; nothing
  saves until the person does). A transaction's month is its date: Edit on the
  detail sheet changes the date, and the form says which month it moves to.
- **Salo:** a round icon fixed at the bottom-right of every signed-in page (above
  the tab bar on phones) that opens a 400px panel; on phones the panel fills the
  space between header and tab bar. Salo's replies sit against a champagne rule,
  the user's in a tint bubble; starter questions as serif rows, varying by page;
  underlined composer. The thread persists across pages (`useSalo`).
- **Settings and auth:** serif sections with hairline rows and underlined
  fields; auth pairs the wordmark with a focused form.

## Motion

- Hover and colour transitions 160-250ms; underline draws 250-300ms.
- Page entry is opacity only, about 500ms. Tracks and rings ease out over
  400-900ms. Sheets fade and slide, 250ms.
- Easing `cubic-bezier(0.22, 0.61, 0.36, 1)`.
- Never animate financial values by counting.
- Respect `prefers-reduced-motion`; interactions stay interruptible.

## Accessibility and mobile

- Targets are at least 44px on coarse pointers; phone gutters 16-20px; fixed
  chrome respects safe areas.
- Money direction and status never rely on colour alone.
- Charts and segmented graphics expose text equivalents and `aria-*` labels.
- Loading, empty and error states exist on every data route.
- Focus is a visible 2px primary outline with offset, in both themes.
- Body text meets 4.5:1 and UI boundaries 3:1 in light and dark.
- Check every route at 390px and 1440px in light and dark.

## Implementation boundaries

- Tokens live in `app/assets/css/main.css`; the v1 editorial layer (`.j-*`)
  lives in `app/assets/css/v1.css`.
- Shared product components live in `app/components/`.
- `app/components/ui/` is vendored and never hand-edited; there is no shadcn
  sheet. Sheets use `app/components/SideSheet.vue`.
- Lucide remains the single interface icon set; the mark and coach avatar are
  authored SVGs.
- No component derives balances or invents money; the invariants in
  `.agent/PROJECT.md` remain binding.
