---
name: Jara Finance
description: A susu collector's tally card for money you have already promised.
colors:
  stock: "oklch(0.945 0.014 122)"
  stock-dark: "oklch(0.235 0.016 168)"
  ink: "oklch(0.225 0.014 155)"
  card: "oklch(0.985 0.008 120)"
  susu-green: "oklch(0.42 0.065 168)"
  susu-green-foreground: "oklch(0.965 0.012 120)"
  shell: "oklch(0.315 0.038 168)"
  shell-foreground: "oklch(0.95 0.012 120)"
  shell-muted: "oklch(0.72 0.025 135)"
  shell-border: "oklch(0.38 0.035 168)"
  secondary: "oklch(0.915 0.016 125)"
  secondary-foreground: "oklch(0.3 0.03 165)"
  muted: "oklch(0.925 0.014 125)"
  muted-foreground: "oklch(0.455 0.016 150)"
  accent: "oklch(0.895 0.028 140)"
  accent-foreground: "oklch(0.28 0.032 165)"
  rule: "oklch(0.855 0.016 125)"
  stroke: "oklch(0.8 0.018 125)"
  ring: "oklch(0.42 0.075 168)"
  income-green: "oklch(0.46 0.1 158)"
  stamp-oxblood: "oklch(0.45 0.14 25)"
  caution-ochre: "oklch(0.52 0.105 72)"
  saving-indigo: "oklch(0.44 0.085 258)"
  chart-1: "oklch(0.45 0.09 168)"
  chart-2: "oklch(0.6 0.115 70)"
  chart-3: "oklch(0.47 0.125 25)"
  chart-4: "oklch(0.46 0.08 258)"
  chart-5: "oklch(0.68 0.085 145)"
  chart-6: "oklch(0.5 0.075 320)"
typography:
  display:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "clamp(2.75rem, 6vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1
    letterSpacing: "-0.025em"
  headline:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "2.25rem"
    fontWeight: 600
    lineHeight: 1.1
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
  body:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.45
    letterSpacing: "normal"
  label:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    lineHeight: 1.35
    letterSpacing: "normal"
  figure:
    fontFamily: "Archivo, ui-sans-serif, system-ui, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.025em"
    fontFeature: "tabular-nums, ss01"
rounded:
  sm: "2px"
  md: "2px"
  lg: "4px"
  xl: "4px"
spacing:
  hairline: "1px"
  rule-rhythm: "32px"
  cell-gap: "4px"
  inline: "8px"
  stack: "12px"
  gutter: "16px"
  section: "24px"
  page-x-mobile: "16px"
  page-x-desktop: "40px"
  rail-width: "224px"
  content-max: "1024px"
components:
  button-primary:
    backgroundColor: "{colors.susu-green}"
    textColor: "{colors.susu-green-foreground}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
    typography: "{typography.label}"
  button-primary-hover:
    backgroundColor: "oklch(0.42 0.065 168 / 0.9)"
    textColor: "{colors.susu-green-foreground}"
  button-outline:
    backgroundColor: "{colors.stock}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "8px 16px"
    height: "36px"
  button-outline-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  button-ghost-hover:
    backgroundColor: "{colors.accent}"
    textColor: "{colors.accent-foreground}"
  input-field:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
    height: "36px"
    typography: "{typography.body}"
  input-amount:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0px"
    padding: "0 0 6px 0"
    typography: "{typography.headline}"
  card-panel:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.lg}"
    padding: "24px 0"
  badge:
    backgroundColor: "{colors.susu-green}"
    textColor: "{colors.susu-green-foreground}"
    rounded: "{rounded.sm}"
    padding: "2px 8px"
    typography: "{typography.label}"
  ledger-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "0px"
    padding: "10px 0"
    typography: "{typography.body}"
  nav-rail-item:
    backgroundColor: "{colors.shell}"
    textColor: "{colors.shell-muted}"
    rounded: "0px"
    padding: "10px 12px"
    typography: "{typography.label}"
  nav-rail-item-active:
    backgroundColor: "{colors.shell-foreground}"
    textColor: "{colors.shell}"
  tally-cell-open:
    backgroundColor: "{colors.card}"
    textColor: "{colors.stroke}"
    rounded: "0px"
    size: "1fr square"
  tally-cell-struck:
    backgroundColor: "{colors.stamp-oxblood}"
    textColor: "oklch(0.975 0.01 25)"
    rounded: "0px"
  tally-cell-taken:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.stock}"
    rounded: "0px"
  progress-track:
    backgroundColor: "{colors.card}"
    textColor: "{colors.susu-green}"
    rounded: "0px"
    height: "12px"
---

# Design System: Jara Finance

## Overview

**Creative North Star: "The Susu Collector's Tally Card"**

Jara is drawn as the thing Ghanaian savers already trust: the susu collector's
card, pale ruled stock marked by hand, with cells struck in stamp ink for money
that has already been promised. The page is not a dashboard of panels on a grey
background; it is one ruled sheet (`.stock-ruled`, a 32px repeating hairline
drawn behind the content in `app/layouts/default.vue`) with a deep susu-green
shell laid beside it to carry navigation. Nothing floats. Every mark is ink on
stock: hairline rules, square corners, flat fills, and figures set in tabular
Archivo so a column of money never reflows as digits change.

The density is a ledger's density. Groups of figures are ruled columns, lists
are ruled rows, and the arithmetic itself is drawn — the signature `TallyField`
renders the affordability subtraction as a field of equal cells where struck,
hatched, solid and open each carry a *shape* as well as a colour. Light is the
default because the use scene decides it: a phone held at a stall in hard
equatorial sun. Dark is the same card read at 9pm, and it is the card in
negative — the stock darkens, every mark goes light, and the shell inverts
direction to become the lightest, greenest band on screen rather than a hole cut
into an already dark page.

Confirmed rejections, all visible in the build: no shadows (every vendored
`shadow-sm`/`shadow-xs` is suppressed), no pills (the vendored badge's
`rounded-full` is squared), no gradient text, no decorative glass, no second
icon set, no third-party font host at runtime.

**Key Characteristics:**
- Pale green-grey ruled stock, never cream, never pure white
- One deep susu-green shell, the only surface that is not stock
- Oxblood stamp ink for money already promised
- Hairline rules and square corners (2px radius); nothing floats on a shadow
- One family, Archivo, for UI and figures alike, with tabular numerals everywhere money appears
- The subtraction is drawn as countable cells, not stated as a hero metric

## Colors

A ledger palette: cool green-grey stock, deep susu green for structure, and
three inks that each mean exactly one thing about money.

### Primary
- **Susu Green** (`{colors.susu-green}`): The institution's own colour. Primary
  buttons, the hatched "budgeted, not yet spent" cell, the default progress
  fill, and the focus ring. In dark it lifts to a pale green mark on dark stock.
- **Shell Green** (`{colors.shell}`): The nav rail at `md` and up and the
  six-item bottom tab bar below it, with `shell-foreground`, `shell-muted` and
  `shell-border` as its own self-contained text/hover set. This is the one
  surface in the app that is not stock, which is what makes the stock read as a
  card laid on a table.

### Secondary
- **Stamp Oxblood** (`{colors.stamp-oxblood}`): The collector's stamp ink.
  Money out, and the struck cell, are the same colour because spent money and
  promised money are both gone. Also the destructive role.
- **Income Green** (`{colors.income-green}`): Money in. Distinct from susu green
  so structure and direction never get confused.

### Tertiary
- **Caution Ochre** (`{colors.caution-ochre}`): A state colour meaning caution
  and nothing else — the `tight` verdict, a budget running ahead of its month, a
  warning insight, and the text selection highlight. Its light value is set
  deliberately dark so it clears 4.5:1 on stock at body size (measured 4.80 on
  stock, 5.41 on card), because the remainder figure beside a "Tight" verdict is
  set in it.
- **Saving Indigo** (`{colors.saving-indigo}`): A goal contribution, which is
  neither earnings nor spending and has to sit beside both in the tally.

### Neutral
- **Ruled Stock** (`{colors.stock}`): The page field. Cool pale green-grey.
- **Card Stock** (`{colors.card}`): Marginally lighter than the page; bounded
  panels and the open tally cell in light mode only.
- **Ledger Ink** (`{colors.ink}`): Body text, and the solid "this purchase" cell.
- **Muted Ink** (`{colors.muted-foreground}`): Hints, units, secondary lines.
- **Rule** (`{colors.rule}`) and **Stroke** (`{colors.stroke}`): The hairline
  between rows and the heavier border on inputs and open cells.

### Named Rules
**The One Job Rule.** Ochre means caution, app-wide. It is never a category
mark, never decoration, never a second accent. The tally's "budgeted" cell is
hatched in susu green precisely so ochre keeps this one job.

**The Never-Colour-Alone Rule.** Money direction and cell state always carry a
second channel — a sign (`+`/`−`), a word, or a shape (strike, hatch, solid,
open). Remove all colour and the screen still answers the question.

**The Inverted Shell Rule.** In light, the shell is darker than the stock. In
dark, it inverts and becomes the lightest, most saturated green band. The shell
is always the surface that is not stock; which direction that takes is the
theme's business.

**The Token-Only Chart Rule.** Categorical colour comes only from the six-step
`chart-N` ramp, read off the document at runtime by `SpendingDonut`. `chart-1`
and `chart-5` are separated by lightness, not hue, because two greens at the
same lightness were indistinguishable at swatch size.

## Typography

**Display Font:** Archivo (with `ui-sans-serif, system-ui, sans-serif`)
**Body Font:** Archivo
**Label/Mono Font:** Archivo, with `font-variant-numeric: tabular-nums`

**Character:** One family does everything. Archivo is a grotesque with the
squared, slightly condensed shapes of forms and stamped stock; set tight and
bold it makes a one-word verdict read from arm's length, and set at 14px with
tabular figures it makes a column of cedis line up like a ledger. `ss01` is on
app-wide via the body rule.

### Hierarchy
- **Display** (700, 44px→60px, 1.0, tight): The affordability verdict — one
  word, "Yes" / "Tight" / "Not yet". It is the only display-size type in the app.
- **Headline** (600, 36px→44px, tabular): The amount being typed into the price
  field, and `MoneyAmount size="xl"` for the one figure a screen is about.
- **Title** (600, 24px→30px, tight): Page titles in `PageHeader`.
- **Body** (400, 14px, 1.45): Nearly everything. Explanatory paragraphs cap at
  roughly 65ch (`max-w-sm` / `max-w-xl` in practice).
- **Label** (500–600, 12–14px, no letter-spacing, sentence case): Section
  headings inside a page, ledger row labels, nav items. The tab bar's label is
  10px.
- **Figure** (600, 20px, tabular, tight): `MoneyAmount size="lg"`, the figure a
  sentence turns on.

### Named Rules
**The One Family Rule.** Archivo, four weights (400/500/600/700), latin subset,
served from the app's own origin via `@nuxt/fonts`. No display face, no mono
face, no system font stack doing real work.

**The Tabular Money Rule.** Every figure that represents money is set with
`tabular-nums`, and every one of them renders through `MoneyAmount`. A money
figure typed as raw text in a template is a bug, not a style choice.

**The Sentence Case Rule.** Headings, labels and nav items are sentence case and
unspaced. There are no uppercase eyebrows, kickers or letter-spaced micro-labels
anywhere in the build, and none should be added.

## Layout

One centred column of ruled stock, max 1024px, with 16px page gutters on phone
and 40px from `md`. The shell takes a fixed 224px rail from `md` up (the main
field is inset by exactly that), and below `md` it splits into a sticky green
header and a fixed six-column bottom tab bar, with 112px of bottom padding
reserved under the content so the tab bar never covers the last row.

The vertical rhythm is 32px: `.stock-ruled` draws a hairline every 32px behind
the content, and ledger rows are built to sit on it (10px vertical padding plus
a hairline bottom border). Spacing inside a row is 8–12px; between sections it
is 24–32px. Nothing in the content area has its own background except genuinely
bounded panels.

Responsive behaviour is a re-flow, never a re-design: the afford screen is one
column on phone and a 5-column grid at `lg` (tally field 3, figures 2). The
tally field itself re-grids — 8 columns on phone, 10 at `sm`, 7 at `lg` — so the
cells stay square and countable at every width.

## Elevation & Depth

There are no shadows. Depth is tonal and linear: the shell against the stock,
the card a half-step lighter than the page, and hairline rules doing the
separating that a shadow would otherwise do. The vendored shadcn-vue primitives
ship `shadow-sm`/`shadow-xs` baked in, and they are suppressed at the bottom of
`app/assets/css/main.css` by a rule that sits **outside every cascade layer** —
un-layered declarations win over layered utilities, so this beats the shipped
class without `!important` and without repeating `shadow-none` at every call
site. The same block squares the badge's hardcoded `rounded-full`.

### Named Rules
**The Ink-On-Stock Rule.** Nothing floats. If an element needs to separate from
what is behind it, it gets a rule, a border, or a different ground — never a
shadow, and never a hard offset shadow.

**The Un-Layered Override Rule.** `app/components/ui/` is vendored and
CLI-regenerated; it is never hand-edited. The sanctioned way to bend a vendored
primitive to this world is an un-layered `[data-slot='…']` rule at the bottom of
`main.css`, with a comment saying which baked-in style it is undoing.

## Shapes

Square by default. `--radius` is 2px, and the whole Tailwind radius scale
collapses onto it (`sm`/`md` = 2px, `lg`/`xl` = 4px), so a corner is carved
rather than rounded. The recurring silhouettes are the cell (an aspect-square
box with a 1px border, gapped 4px from its neighbours), the ruled row (a
hairline bottom border, no box), and the band (the shell, full-bleed and
flat-edged). Emphasis is a heavier rule, not a rounder box: a total line and the
price field both close with a 2px foreground rule rather than a box or a fill.
Dashed borders mark absence — the empty state and the empty tally.

The brand mark (`SaloMark`) is authored SVG in adinkra stamp grammar: two
diagonal inked quarters with a coin annulus masked out of their junction,
two-fold rotational symmetry, one `currentColor` path so it sits on shell, on
stock, and in either theme without a variant. It resolves at 16px and ships as
`favicon.svg`, `icon-32.png`, `icon-512.png` and `apple-touch-icon.png`.

## Components

### Buttons
- **Shape:** Square-cornered (2px), 36px tall at default, 32px at `sm`.
- **Primary:** Susu green ground, pale stock text, 16px horizontal padding, 14px
  medium label.
- **Hover / Focus:** Ground drops to 90% opacity on hover; focus-visible draws a
  3px ring in the susu-green ring token. No lift, no shadow, no transform.
- **Outline / Ghost:** Outline is stock ground with a hairline border; ghost is
  bare. Both hover to the pale `accent` wash. Link variant underlines at a 4px
  offset.
- **Quick-amount buttons** (afford screen): bordered square chips of tabular
  figures; the chosen one inverts to foreground ink on stock.

### Cards / Containers
- **Corner Style:** 4px.
- **Background:** Card stock, a half-step from the page.
- **Shadow Strategy:** None; see Elevation & Depth.
- **Border:** Hairline rule.
- **Internal Padding:** 24px vertical.
- **Use:** Only for genuinely bounded panels — a form, an editor. A card is
  never the page's structure and is never nested.

### Inputs / Fields
- **Style:** Transparent ground, hairline `stroke` border, 2px corners, 36px
  tall, 12px horizontal padding. The caret is income green.
- **Amount field:** No box at all — a 2px foreground rule under a 36–48px
  tabular figure with a muted `GH₵` set beside it. The rule turns ring-green on
  focus-within.
- **Focus:** 3px ring plus border shift to ring green.
- **Error:** Destructive border and ring via `aria-invalid`; error text sits in
  a bordered oxblood-washed strip, not a toast.

### Navigation
- **Rail (`md`+):** 224px of shell green, mark and wordmark at top, six items
  plus Settings pinned at the foot. Items are 14px medium in `shell-muted`;
  hover fills `shell-border`; the active item inverts fully to a pale ground with
  shell-green text. Focus draws an inset 2px ring in `shell-foreground`.
- **Tab bar (below `md`):** Six equal columns of shell green, 20px icon over a
  10px label, safe-area padded. Active state is a 2px top border plus full-value
  text — a stamped tab, not a pill.
- **Icons:** `lucide-vue-next` only, imported per icon, 16–20px. The brand mark
  is authored SVG and is used for the coach rather than a sparkle glyph. Insight
  severities use three distinct silhouettes (OctagonAlert / TriangleAlert /
  Info) so they differ by shape and not only by hue.

### Tally Field (signature)
The affordability subtraction drawn as a field of equal cells, one cell per unit
of what you hold. The unit is chosen from a round-cedi ramp (GH₵10 → GH₵5,000)
so the field stays countable — the first unit that brings the field under 40
cells wins, which lands around 28 in practice — and the chosen unit is named in
the heading ("Your month, one cell per GH₵200"). Four states, each a shape as
well as a colour:
- **Struck** — oxblood ground with an X stroke drawn in its own foreground:
  promised to goals.
- **Hatched** — `.cell-hatched`, a 135° susu-green repeating hatch: budgeted but
  not yet spent.
- **Taken** — solid foreground ink: what the purchase under consideration would
  take. It is the heaviest mark on the field because it is the only quantity the
  user is deciding about.
- **Open** — page ground with a `stroke` border: yours.

Cells stamp in with a staggered fade-and-zoom capped at 520ms total, under
`motion-safe:`. The whole field is one `role="img"` with a sentence-long label
that counts each state. The same four swatches reappear at 12px beside the
figures column, which is what ties the drawing to the arithmetic.

### Ledger Row (`StatTile`)
A label on the left, a figure on the right, a hairline underneath — a column of
them adds up. It is explicitly not a tile: a row of equal boxes each holding an
icon, a label and a number reads as four unrelated facts. (The filename is
historical.)

### Money (`MoneyAmount`)
The only way money renders. Tones: `auto` (sign-derived), `income`, `expense`,
`warning`, `saving`, `neutral`. Sizes `sm`/`base`/`lg`/`xl` map to 14/16/20/44px,
the upper two at 600 weight and tight tracking. Always tabular.

### Progress Bar
A 12px-tall square track with a hairline border and a flat fill — susu green,
or saving indigo, or ochre when ahead of pace, or oxblood when over. The
optional pace rule is a 2px foreground tick standing proud of the track at both
ends, so "spending faster than the month is passing" is visible rather than only
stated.

## Do's and Don'ts

### Do:
- **Do** render every money figure through `MoneyAmount`, with `tabular-nums`.
- **Do** structure a group of figures as ruled rows or ruled columns (hairline
  `border-b`, 10px padding, on the 32px rhythm), not as a grid of cards.
- **Do** keep square corners (2px; 4px only for a bounded panel).
- **Do** give every state a shape as well as a colour — a sign, a word, a
  strike, a hatch.
- **Do** keep ochre for caution only, and take categorical colour only from
  `chart-1`…`chart-6`.
- **Do** bend a vendored shadcn-vue primitive with an un-layered
  `[data-slot='…']` rule at the bottom of `main.css`, never by editing
  `app/components/ui/`.
- **Do** treat dark mode as the same card in negative, with the shell inverting
  to the lightest band.
- **Do** set the one figure a screen is about at display or headline size and
  leave the rest at body size.

### Don't:
- **Don't** put anything on a shadow — ambient, elevation, or hard offset.
- **Don't** use a pill: no `rounded-full` chips, badges, toggles or avatars.
- **Don't** express income or expense with a raw colour utility instead of the
  `--income` / `--expense` tokens.
- **Don't** make cards the page structure, and never nest one inside another.
- **Don't** add uppercase kickers, eyebrows, or letter-spaced micro-labels above
  a heading.
- **Don't** add a second icon set, a glyph that restates a word already on
  screen, or the four-point AI sparkle.
- **Don't** add a second font family, a display face, or a runtime third-party
  font host.
- **Don't** use gradient text, glass, blur or decorative texture; the only
  texture in this world is the 32px ruling and the 135° hatch.
