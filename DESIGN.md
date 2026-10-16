---
name: Maghapon Café
description: Warm, grounded, unhurried café ordering app — terracotta, rice-husk cream, and pandan green over deep coffee-brown ink, set in Fraunces and Geist Variable, built like a layered hearth.
colors:
  rust-600: "#bb3d03"
  rust-400: "#d6873e"
  cream-50: "#f4efe6"
  cream-0: "#fdfbf7"
  cream-200: "#d3cbbd"
  ink-700: "#602000"
  ink-900: "#2a1206"
  matcha-600: "#6b8f2e"
  matcha-700: "#5c7c25"
  clay-300: "#c0a080"
  hearth-950: "#1a0b02"
  open-600: "#2e7d32"
  border-ui: "#94877f"
  line: "rgba(42, 18, 6, 0.10)"
  paper: "#ffffff"
  line-strong: "rgba(42, 18, 6, 0.18)"
  line-light: "rgba(253, 251, 247, 0.12)"
typography:
  # The drift check guards colour values only — nothing verifies these numbers against the CSS, so
  # each one below was hand-measured on 2026-09-24 and cites the rule it came from. Re-measure
  # before trusting any of them.
  display:                        # .hero h1 — hero.css:29-36
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: "clamp(2.8rem, 7vw, 5.2rem)"
    fontWeight: 700
    lineHeight: 0.95
    letterSpacing: "-0.025em"
  headline:                       # h2 — base.css:50-52 with the h1–h4 group rule at :35-46
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: "clamp(1.6rem, 4vw, 2.5rem)"
    fontWeight: 700
    lineHeight: 0.95
  title:                          # h3 — base.css:53-55
    fontFamily: "'Fraunces', Georgia, serif"
    fontSize: "1.15rem"
    fontWeight: 700
    lineHeight: 0.95
  body:                           # body — base.css:11-19
    fontFamily: "'Geist Variable', system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
  label:                          # .field label and the nav/pill text — booking.css:33-36
    fontFamily: "'Geist Variable', system-ui, sans-serif"
    fontSize: "0.82rem"
    fontWeight: 600
    letterSpacing: "0.04em"
rounded:
  # `lg` is the CSS `--radius`; the code has no `md` step and no 14px radius anywhere.
  lg: "2rem"
  sm: "12px"
  xs: "10px"   # --radius-xs exists in the token file and is used by nothing — do not treat as live
  full: "999px"  # an inline literal in CSS (no token); it is the pill shape, not a scale step
spacing:
  xs: "0.5rem"
  sm: "0.75rem"
  md: "1rem"
  lg: "1.5rem"
  xl: "2rem"
components:
  button-primary:
    backgroundColor: "{colors.sinaing-rust}"
    textColor: "{colors.palay-bright}"
    rounded: "{rounded.full}"
    padding: "0.65rem 1.4rem"
    height: "44px"
  button-primary-hover:
    backgroundColor: "{colors.tuba-ink-deep}"
    textColor: "{colors.palay-bright}"
    rounded: "{rounded.full}"
    padding: "0.65rem 1.4rem"
    height: "44px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.palay-bright}"
    rounded: "{rounded.full}"
    padding: "0.65rem 1.4rem"
    height: "44px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.sinaing-rust}"
    rounded: "{rounded.full}"
    padding: "0.65rem 1.4rem"
    height: "44px"
  card:
    backgroundColor: "{colors.palay-bright}"
    rounded: "{rounded.lg}"
    padding: "1.6rem"
  input:
    backgroundColor: "#ffffff"
    textColor: "{colors.tuba-ink-deep}"
    rounded: "{rounded.sm}"
    padding: "0.55rem 0.8rem"
    height: "46px"
  price-chip:
    backgroundColor: "{colors.palay}"
    textColor: "{colors.tuba-ink-deep}"
    rounded: "{rounded.full}"
    padding: "0.3rem 0.75rem"
  status-pill:
    backgroundColor: "{colors.palay-bright}"
    textColor: "{colors.tuba-ink}"
    rounded: "{rounded.full}"
    padding: "0.35rem 0.8rem"
---

## Overview

**Creative North Star: "The All-Day Hearth"**

Maghapon Café is the always-lit kitchen corner of a Filipino neighborhood — the counter where the coffee pot is never empty, the terracotta tiles are warm underfoot, and nobody hurries you out. The name itself means "all day long" in Tagalog, and the design honors that promise: a site that feels like sitting down at 7 AM and still being welcome at 10 PM. Every surface, shadow, and typeface is chosen to feel like it has been lived on — worn, warm, and honest.

The personality is **warm · grounded · unhurried**. Warmth comes from the terracotta-and-cream palette and the editorial serif; groundedness comes from the deep coffee-brown ink and the physical, layered sense of depth; unhurriedness comes from generous spacing, soft motion, and a rhythm that never rushes the eye. The explicit anti-reference is generic coffee-chain minimalism — the beige-and-white, glass-and-steel sameness of international chains. Nothing here is sterile, corporate, or cold.

**Key Characteristics:**
- A hearth palette: terracotta fire, rice-husk cream, pandan green, coffee-brown ink — no grays, no cold blues.
- Editorial serif (Fraunces) for every heading; Geist Variable for reading and UI text.
- Everything is rounded and slightly soft — pills for controls, gently curved cards, warm shadows.
- The page is a countertop; drawers and panels are physical layers that slide over it.
- Motion is slow enough to feel deliberate: state changes at 0.2s, cards and buttons at 0.7s, reveals at 0.8s. Only the press squish is quicker (160ms). Reduced motion is always honoured.

> **Phase-0 note (2026-09-24).** This file drifted from the CSS it describes — it named Inter while
> the code loaded Geist, kept a `#e0e0e0` gray that the no-grays rule forbids, and claimed one
> breakpoint where the code has four. It is now reconciled, and `npm run build` fails if any colour
> value in the frontmatter `colors:` block disagrees with
> `src/styles/tokens/legacy-root.css` (guard check `token drift`). Two asset facts stated plainly,
> because the rest of this document speaks in font terms: the typefaces are self-hosted
> (`@fontsource/fraunces` static weights 400–700 and `@fontsource-variable/geist`, bundled into
> `dist/_astro/`), and **icons are a vendored SVG sprite (`public/icons.svg`, Phosphor MIT), not a
> font**. Nothing on this site is fetched from a CDN.

## Colors

The palette is food-adjacent and fire-lit: terracotta, rice-husk cream, and pandan green arranged over deep coffee-brown ink. Saturation is reserved for action; the page itself rests in warm neutrals.

### Primary

- **Sinaing Rust** (#bb3d03) — the fire of the palette. Used for primary buttons, limited badges, link hovers, and the small brand label. It marks action and rarity; it never decorates passively.
- **Rust Amber** (#d6873e) — the ember. Hover accents, hero emphasis, and focus rings. Slightly softer than Sinaing Rust, it is the color of light through a coffee cup.

### Secondary

- **Pandan** (#6b8f2e) — the one green, named for the leaf (`--matcha`). Marks seasonal items, success states, and form confirmations. Used sparingly so it always reads as a signal. *Phase 2 (A-3) adds `#5c7c25` as the accessible variant for text-on-cream; it is not in the token file yet, and until it is, pandan carries an unpassed contrast ratio.*

### Tertiary

- **Brown** (#c0a080) — a warm neutral accent that finishes the menu-card gradient (rust → amber → brown) and appears in supporting moments.

### Neutral

- **Palay** (#f4efe6) — rice-husk cream (`--cream`). This is the page background itself (`base.css:14`) and the quieter surface: price chips, icon buttons, the mobile status pill.
- **Palay Bright** (#fdfbf7) — `--cream-bright`, the raised cream: nav rail, cart panel, menu cards, booking CTA, and the text colour of a primary button. Surfaces lift off Palay by being *lighter*, not cooler — the old doc claimed a `#e0e0e0` "Palay Wash" for that job, which was a gray, broke the no-grays rule below, and was never a token. It is deleted here rather than renamed. Its decimal twin `rgba(224, 224, 224, …)` does survive in the CSS as an untokenised chrome background in exactly three places — `shell.css:207` (`.app-toolbar`), `shell.css:243` (`.mobile-topbar`) and `menu-card.css:237` (`.tabs`); see Elevation — so the gray was mis-described, not invented. The fourth blurred surface, the mobile bottom tab bar, is cream (`shell.css:272`) and is not part of that debt.
- **Palay Deep** (#d3cbbd) — `--cream-deep`, the pressed/hovered state of a cream surface and the deeper dividers.
- **Tuba Ink** (#602000) — `--ink`, coffee-brown body text; warm enough to never feel black-on-white.
- **Tuba Ink Deep** (#2a1206) — `--ink-deep`: headings, input text, the primary button's hover fill, and (at 0.88 alpha) the hero's scrim. The darkest warm tone actually in use.
- **Dark Hearth** (#1a0b02) — `--bg-dark`, the near-black brown of the footer, the only dark section on the site. The hero overlay is Tuba Ink Deep, not this.
- **Green** (#2e7d32) — `--green`: the status dot, open now.
- **Line** (rgba(42, 18, 6, 0.10)) — `--line`, hairline borders on light surfaces. ⚠ Alpha-composited onto its own surface this measures **1.22:1 on Palay** (#f4efe6) and **1.23:1 on Palay Bright** (#fdfbf7) — WCAG 2.x relative luminance with sRGB 2.4 gamma, computed on the float composite before rounding, so the two figures differ only at the second decimal and both sit far below the 3:1 UI-boundary floor the spec's §4.5/§A-2 sets. Today's card and input edges are therefore effectively decorative. Phase 2 gives the boundary role to `--border-ui` (`#94877f`, solid, same method: **3.04:1 on Palay**, **3.37:1 on Palay Bright**, 2.16:1 on Palay Deep — only the first two clear 3:1); until then this alpha is a known defect, not a target.
- **Line Strong** (rgba(42, 18, 6, 0.18)) — `--line-strong`, the border a card takes on hover.
- **Line Light** (rgba(253, 251, 247, 0.12)) — `--line-light`, hairline borders on dark surfaces and the outline button's edge.

### Named Rules

**The Fire Rule.** Sinaing Rust is the only saturated warm accent, and it is reserved for action: buttons, badges, links, and the brand mark. If a moment is not interactive or notable, it does not get the fire.

**The Palay Ground Rule.** Surfaces are always Palay or Palay Bright; text sits on cream, never on a saturated color. Saturated colors appear as fills on small elements (buttons, chips, dots) or as gradients behind imagery — never as a background behind body copy.

## Typography

- **Display Font:** Fraunces (Georgia, serif fallback) — an editorial serif with warmth and character, used for every heading. Self-hosted in **static weights** 400/500/600/700 (`@fontsource/fraunces`, imported at `Base.astro:3-6`); a variable Fraunces is not used and the static set is a frozen contract.
- **Body Font:** Geist Variable (system-ui, sans-serif fallback) — `--font-body`, self-hosted from `@fontsource-variable/geist` (`Base.astro:7`). It replaced Inter when Inter left the dependency tree; any remaining "Inter for reading" wording in this document is stale.

The pairing is the classic hearth recipe: a serif that feels like a menu board and a sans that feels like a receipt. Fraunces carries the personality; Geist stays out of the way. Phase 2 (spec §4.4, §5) renames `--font-body` to `--font-ui` and wraps it in the **Two Grounds** rule: `data-surface="editorial"` and `data-surface="app"` each declare their own type and colour scope, so an editorial page and the ordering chrome stop sharing one flat token set. The current scale and clamps carry over untouched.

### Hierarchy

- **Display** (700, clamp(2.8rem → 5.2rem), 0.95 line, −0.025em) — `.hero h1`, the hero headline only (`hero.css:29-37`). The one moment the serif is allowed to be enormous. A non-hero `h1` is slightly smaller: clamp(2.6rem → 4.6rem) (`base.css:47-49`).
- **Headline** (700, clamp(1.6rem → 2.5rem), 0.95) — `h2`, section headings (`base.css:50-52`).
- **Title** (700, 1.15rem, 0.95) — `h3` (`base.css:53-55`); the h1–h4 group at `base.css:35-46` sets weight, line-height, −0.02em tracking and `text-wrap: balance` for all of them. Card titles override smaller: 0.9rem on a full menu card (`menu-card.css:91-95`), 1.05rem on a compact one (`:178-181`).
- **Body** (400, 1rem, 1.65) — paragraphs and descriptions (`base.css:11-19`); comfortable leading for unhurried reading, capped at 65ch (`base.css:56-60`).
- **Label** (600, 0.82rem) — navigation, form labels, and small UI text (`booking.css:33-36`). Badges are the smallest label: 0.68rem, 700 weight, 0.08em tracking, sentence case (`menu-card.css:33-40`; the markup literally renders "Limited"/"Seasonal" and no `text-transform` is applied). The uppercase tier belongs to eyebrows: 0.72rem, 700, **0.18em**, uppercase (`story.css:152-159`).

### Named Rules

**The Fraunces-Only Rule.** The serif is for headings alone. Body copy, labels, buttons, and inputs are always Geist Variable. A serif sentence is a design error.

**The Unhurried Tracking Rule.** Body text never tightens below normal tracking. Labels may open up (0.08em on badges, up to 0.18em on the uppercase eyebrow — the widest tracking anywhere in the CSS) — the more important the moment, the more air between letters. Headings are the exception the rule has always carried: −0.02em at h1–h4, −0.025em on the hero (`base.css:44`, `hero.css:33`).

## Layout

The page is a three-zone app shell, not a document with a header on top: a sticky nav rail, the scrolling main column, and (on wide screens only) a persistent cart panel. Everything sits in one centered container capped at `--container` = **1280px** (`base.css:71-74`) with `padding: 0 clamp(1rem, 4vw, 2rem)`. Content columns are generous — hero copy sits in a 640px measure (`hero.css:26`), cards breathe in a 2–3 column grid that collapses to one column on phones (`responsive.css:3-27`).

The system has **four breakpoints, not one** — 360, 767, and 1024 are the live boundaries in `src/styles/` (media-query census: `max-width: 360px` ×1, `max-width: 767px` ×3, `min-width: 768px` ×2, `min-width: 1024px` ×4; the `prefers-reduced-motion` ×2 and `hover: hover` ×1 blocks are behaviour gates, not tiers):

- **≥1024px — three zones.** `.app-shell` is `220px 1fr` (`shell.css:3-7`); opening the order menu adds a third `340px` column (`.cart-panel-open`, `responsive.css:186-197`) and slides the fixed top-right `.global-controls` cluster aside by `calc(340px + 1.5rem)` so it never sits on the panel. This is the only width where the rail can collapse: `#rail-toggle` appears in the rail footer and `.rail-collapsed` narrows the first column to `80px` (`80px 1fr`, or `80px 1fr 340px` with the panel open), clipping brand copy and rail labels to visually-hidden text that stays readable to assistive tech (`responsive.css:200-247`).
- **768–1023px — two zones, drawer instead of panel.** The rail is always present and always expanded (no collapse at this width by design — the drawer already owns the cart here); the order menu opens as the right-side overlay drawer `#cart-drawer`, `width: min(420px, 100%)` with the `-20px 0 50px rgba(42, 18, 6, 0.3)` layer shadow (`cart-drawer.css:24-36`). Sticky content columns keep `margin-right: 288px` on `.tabs-inner` so the category chips clear the floating controls (`responsive.css:20-23`).
- **≤767px — pocket.** The rail is removed and replaced by a sticky 64px compact top bar (brand mini lockup; `min-height: var(--header-h)`) and a fixed 4-tab bottom bar (`Home / Menu / Book / Cart`, `height: calc(64px + env(safe-area-inset-bottom))`, `grid-template-columns: repeat(4, 1fr)`, z-index 80). Body gets `padding-bottom: 72px` so content clears it. The cart becomes a **bottom sheet**: the same drawer markup, re-anchored to the bottom edge, `max-height: 85vh`, top corners clipped by `var(--radius)`, sliding up from `translateY(110%)` — pure CSS, one set of ids and handlers (`responsive.css:250-266`, `:28-64`).
- **≤360px — the tight phone.** Not a layout change but a legibility one: top-bar gaps and padding tighten, the brand mark drops to 30px, and both status pills collapse to a 44×44 square whose text is visually hidden (`responsive.css:65-97`). This exists because at 320px brand + actions overran the 288px content box and the header wrapped.

There is no 320px slide-in navigation drawer any more — the hamburger drawer was deleted in the 2026-08-13 app-shell redesign, so any copy describing "navigation becomes a drawer from the right" is describing a component that no longer exists. The only drawer left in the code is the cart.

Spacing follows a quiet rem-based rhythm (0.5rem → 2rem steps) rather than a named scale: sections breathe with 2rem+ of vertical air, cards pad at 1.6rem, and tight clusters (badges, chips, icon buttons) sit at 0.5–0.75rem. Density is deliberately low — this is a site that does not rush you.

## Elevation & Depth

Depth is physical, not decorative: the page is the countertop, and drawers, panels, and menus are layers that slide over it. The cart drawer and mobile menu are real sliding surfaces with directional shadows; cards lift slightly when you reach for them. All shadows are warm — brown-tinted, never gray or black — so depth feels like lamplight rather than shadow.

### Shadow Vocabulary

Three tokens exist; two are live. Nothing here is guarded — the drift check compares colours, so re-measure against `src/styles/tokens/legacy-root.css:23-25` before quoting these.

- **Rest** — `--shadow: 0 16px 40px rgba(42, 18, 6, 0.08)`, 5 uses: `.booking-media img` (`booking.css:14`), `.booking-cta` (`responsive.css:279`), `.cart-btn:hover` (`shell.css:174`), `.global-controls .status-pill` (`shell.css:226`), `.story-media img` (`story.css:231`). The default depth of a surface sitting on the countertop.
- **Lift** — `--shadow-lift: 0 24px 56px rgba(42, 18, 6, 0.14)`, 5 uses: `.btn-primary:hover` (`button.css:31`), the hero's raised cream sheet `.order-surface > .container` (`hero.css:82`), `.menu-card:hover` (`menu-card.css:15`), `.info-card:hover` (`story.css:273`), `.testimonial-card:hover` (`testimonials.css:35`) — the moment a surface is picked up.
- **Soft** — `--shadow-soft: 0 8px 24px rgba(42, 18, 6, 0.06)` — **declared and used by nothing**. Treat it as dead weight pending Phase 2, not as a step in a scale.
- **Cart Layer** — `-20px 0 50px rgba(42, 18, 6, 0.3)` (`cart-drawer.css:35`), the right-side drawer sliding over the page; the bottom-sheet variant mirrors it upward as `0 -20px 50px rgba(42, 18, 6, 0.3)` (`responsive.css:261`). An inline literal with no token.
- **Panel Layer** — `-12px 0 32px rgba(64, 0, 0, 0.08)` (`responsive.css:113`), the ≥1024px cart column: ambient, not directional, because it is a zone rather than an overlay. Also inline.
- **Focus rings drawn as shadows** — `0 0 0 3px rgba(46, 125, 50, 0.18)` on the open dot and `0 0 0 3px rgba(187, 61, 3, 0.18)` on the closed dot (`shell.css:151,156`), `0 0 0 4px rgba(214, 135, 62, 0.12)` on a focused input (`booking.css:55`). Depth vocabulary, but they carry the pulse/announce job.

⚠ Six shadows still tint with `rgba(64, 0, 0, …)` — the decimal form of the `#400000` this document used to claim as a palette colour (`cart-drawer.css:87`, `menu-card.css:31,128,133`, `responsive.css:113`, `shell.css:229`). The token file has no such value; only the guard-visible tokens do. Same story for `rgba(128, 160, 64, …)`, the old pandan, still behind two confirmation washes (`booking.css:87,136`), and `rgba(224, 224, 224, …)`, the retired gray, still the background of the sticky chrome (`shell.css:207,243`, `menu-card.css:237`). These are untokenised literals, and the drift check cannot see them (it reads only the token file, and only hex): deleting them from this document removed a false *promise*, not the debt. Phase 2 owns that (spec §4.3, §4.5 invariant 4).

The retired **Menu Layer** (`-8px 0 24px rgba(30, 24, 18, 0.12)`) is gone entirely — no `rgba(30, 24, 18, …)` survives anywhere in `src/styles/`; it belonged to the navigation drawer that the app-shell redesign deleted.

### Named Rules

**The Warm Shadow Rule.** Every shadow in the system is brown-tinted. A gray or black shadow is a foreign object on this countertop. (This rule is about shadows. The untokenised `rgba(224, 224, 224, …)` chrome fills noted above — α .92 at `shell.css:207` and `:243`, α .95 at `menu-card.css:237` — are backgrounds, so they breach the neutrals half of the same Don't (`:292`), not this rule.)

**The Layer Rule.** Only true layers — drawers, panels, menus — cast directional shadows. Cards cast soft ambient shadows and lift on hover; nothing else floats.

## Shapes

The form language is worn terracotta: everything is rounded, warm, and slightly soft, as if handled daily. These are the radii the CSS actually has. **Nothing in this section is guarded** — the drift check compares colour values only — so every number and count below was measured across `src/styles/` on 2026-09-24:

- `--tmp-radius-container: 2rem` (`tokens/3-transitional.css:9`) — **20 uses**, the container radius: `.menu-card` (`menu-card.css:8`), `.booking-cta` (`responsive.css:277`), `.skeleton-card` (`:337`), story and admin surfaces. Cards are curved *a lot*; the old doc's "14px" was never in the code.
- `--r-md: 12px` (`tokens/1-primitive.css:38`) — **11 uses**, the quiet shape: `.field input, .field select` (`booking.css:42`), cart lines and qty steppers (`cart-drawer.css:112,132,154,319`), `.skeleton` (`responsive.css:328`), admin rows (`admin.css:32,153`).
- `--radius-xs: 10px` — **deleted, never ported, 0 reads.** It was the value the previous document published as the input radius while inputs were already 12px; Phase 2A deleted it with `legacy-root.css` rather than porting it.
- `999px` — **16 uses, and there is no token for it.** The pill: `.btn` (`button.css:10`), `.status-pill` (`shell.css:142`), `.price-chip` (`menu-card.css:111`), `.my-status` (`responsive.css:311`), rail nav links, chips, `.skip-link` (`base.css:94`).
- `50%` — **12 uses, also untokenised.** Circles: `.status-dot` (`shell.css:149`), `.btn .btn-icon` (`button.css:63`), `.cart-panel-close` (`responsive.css:135`), the drawer's close and stepper buttons (`cart-drawer.css:55,84,93,232,276,341`).
- Stray literals the scale does not cover, each inline at its site: `4px` on the focus outline (`base.css:81`), `8px` on the brand mark and footer badges (`shell.css:39`, `footer.css:23`), `16px` on the empty-state owl (`responsive.css:340`), `20px` on the testimonial card (`testimonials.css:18`), and `0 0 4px 0` on the quote block (`:30`).

Interactive controls keep a 44px minimum box (`.btn { min-height: 44px }`, `button.css:8`; `.tab-bar a/button { min-height: 44px }`, `shell.css:283`; the rail toggle and cart buttons are 44px). `.btn-sm`'s 40px was a known defect against the Phase-2 §4.5 floor of 44px and is resolved in 2A to 44px (`button.css:51`), grown alongside §5's two other sub-floor controls, `.tab-btn` (`menu-card.css:254`) and the drawer's `.cart-line-qty button` (`cart-drawer.css:274-275`) — the panel stepper already met the floor (`responsive.css:159-163`). Icon buttons are perfect circles (44px).

Borders are hairlines (1px) in the warm Line color on light surfaces, Line Strong on hover, and Line Light on dark surfaces — present enough to define edges, light enough to never feel like a cage. The menu-card media area is not a hard edge: it takes the card's own top corners with `var(--radius) var(--radius) 0 0` (`menu-card.css:137`, same trick on `.order-surface` at `hero.css:81` and the bottom sheet at `responsive.css:259`).

### Named Rules

**The Pill Rule.** If it is interactive, it is a pill or a circle. If it is a container, it is gently curved (`--radius`, 2rem). If it is a field, it is softly squared (`--radius-sm`, 12px). Sharp corners exist nowhere.

**The Soft Edge Rule.** Nothing in the system has a hard corner except where an image is intentionally clipped by a card. Even the darkest sections keep their rounded containers. *(Two honest exceptions in today's CSS, both structural rather than stylistic: the ≥1024px cart panel and the 768–1023px cart drawer are edge-to-edge layers with no radius at all — `responsive.css:105-114`, `cart-drawer.css:24-36` — and only the ≤767px bottom-sheet variant rounds its top corners. Phase 2 gives these the `--radius-container` scope value instead.)*

## Motion

There are **no duration tokens yet** — every value below is an inline literal, and nothing in the build guards them. Phase 2 (spec §4.3) introduces `--dur-*`, and §5.1 gives each surface scope its own floor: `--dur-ui: 180ms` on app ground, `260ms` on editorial ground. Easing is already a token: `--ease: var(--ease-out)` = `cubic-bezier(0.32, 0.72, 0, 1)` (`tokens/legacy-root.css:28-29`).

The real duration census across `src/styles/*.css`, most frequent first (counted 2026-09-24):

- **0.2s ×21** — the workhorse: chrome hovers, rail links, chips, input border/shadow focus (`booking.css:48`, `shell.css:118`).
- **0.7s ×15** — the unhurried step, and the second most common value in the codebase: `.btn` on all five transitioned properties (`button.css:16`) and the card family — `.menu-card` (`menu-card.css:10`), `.info-card` (`story.css:268`), `.testimonial-card` (`testimonials.css:17`), story media. This is what "deliberate" looks like in numbers; the old doc's "0.2–0.35s" range did not contain it.
- **0.8s ×3** — `[data-reveal]` scroll-in: opacity, transform and blur together (`motion.css:7`), staggered by 80/160/240/320/400ms per `nth-child` (`story.css:10-14`) — those are `transition-delay`s, not durations, and the transform delay is left at 0 so a hover lift stays instant.
- **0.35s** — the cart drawer's slide (`cart-drawer.css:34`); **0.3s** its scrim fade (`:19`); **0.4s** the menu-card photo zoom (`menu-card.css:146`); **0.25s** the rail-collapse arrow (`shell.css:128`).
- **160ms ×6** — the fastest motion in the app: the `scale(0.97)` press squish (`motion.css:53-68`) and small icon/stepper nudges (`cart-drawer.css:62,238`, `responsive.css:141`, `menu-card.css:225`).
- **1.4s / 1.8s / 2s** — looping states, not transitions: the skeleton shimmer (`responsive.css:327`), the Limited badge pulse (`menu-card.css:46`), the open-status dot pulse (`shell.css:153`).

Hover lifts exist only for a real pointer (`@media (hover: hover) and (pointer: fine)`, `motion.css:17`), and reduced motion is a hard reset, not a suggestion: `animation-duration`, `animation-iteration-count` and `transition-duration` are forced to `0.01ms !important` on every element, `[data-reveal]` shows with `opacity: 1; transform: none; filter: none; transition-delay: 0ms`, hover lifts are unregistered, and the skeleton animation is switched off (`motion.css:71-100`, `responsive.css:342-344`).

## Components

**Buttons.** Pill-shaped (`999px`, `button.css:10`), minimum 44px tall, 0.95rem/600, transitioning *all five* properties — transform, box-shadow, background, color, border-color — at **0.7s** on the standard ease (`button.css:16`). Hover raises them −2px, but only for a real pointer: the lift lives inside `@media (hover: hover) and (pointer: fine)` (`motion.css:17`), so touch devices never inherit a stuck transform. Pressing squishes to `scale(0.97)` at 160ms (`motion.css:53-68`). The primary button is Sinaing Rust with **Palay Bright** text (`button.css:23-26`), deepening to Tuba Ink Deep plus a Lift shadow on hover (`:28-32`). On dark sections, an outline button — transparent fill, Palay Bright text, `--line-light` hairline — brightens to a 12% Palay Bright wash and a 28% border (`:33-41`). A ghost button (Sinaing Rust text, 8% rust wash on hover) handles quiet secondary actions (`:42-49`). `.btn-sm` shrinks to 44px / 0.88rem (`:50-54`); `.btn-block` stretches full width (`:55-57`).

**Chips & Badges.** Price chips are pills in Palay with a Line border and Tuba Ink Deep price text, padding `0.3rem 0.75rem`, size note at 0.72rem (`menu-card.css:107-117`). Badges are the smallest labels in the system — 0.68rem, 700 weight, 0.08em tracking, **sentence case; there is no `text-transform` on `.badge`** (`menu-card.css:33-40`) — and each carries a meaning: Limited (Sinaing Rust fill, `pulse` ring at 1.8s, `:42-47`), Seasonal (Pandan fill, `:48-52`), Matcha (Palay Bright fill with a Pandan border, `:60-64`), and Star (Tuba Ink Deep at 0.72 alpha over imagery, `:53-59`).

**Cards.** Palay Bright surfaces with a Line border and `--radius` (`menu-card.css:3-12`, `story.css:263-267`); hover deepens the border to Line Strong and casts the Lift shadow (`menu-card.css:13-16`). Info cards pad at 1.6rem and lift 4px on the same 0.7s transition (`story.css:263-274`). Menu cards are tighter inside — the body block pads `1.2rem 1.2rem 1.3rem` (`menu-card.css:89`) — and clip a 4:3 media area at the top (`:18-20`): a rust → amber → brown gradient carrying a large Fraunces initial, with the item name as an `h3` overridden down to 0.9rem (`:91-95`; 1.05rem on a compact card, `:178-181`). Compact cards are the ordering-grid variant: same shell, smaller body, a 44px add button.

**Inputs.** White fields (`background: #fff`, `booking.css:44`), 46px minimum height, `--radius-sm` (12px), Line border, Tuba Ink Deep text at 0.95rem (`booking.css:38-48`). Focus is unmistakable: a 3px `var(--focus-ring)` outline offset 2px (which is `--rust-600` on a white ground, 5.55:1), a Sinaing Rust border, and a 4px amber ring (`:50-56`). Invalid fields go to `#c0392b` on `#fdf2f2` — two more untokenised hex literals, and the only red in the system. Labels sit above at 0.82rem/600 with **no tracking override** (`:33-36`). The 4px amber ring is the focus colour a third time — an untokenised halo at `booking.css:55` that stays byte-for-byte in 2A (the outline now carries the WCAG requirement; the halo is pure reinforcement) and retires into `--focus-halo` in 2B; no guard check can see it.

**Navigation.** There is no site header any more; the 2026-08-13 app-shell redesign replaced it, and the hamburger drawer with it. Desktop (≥768px) is the sticky **nav rail**: `220px` wide, full height, Palay Bright with a `--line` right border, carrying the brand lockup and the five rail links (Home / Order / Book a table / My orders / Rewards) as 44px pills with 22px sprite icons (`shell.css:3-24`, `:54-73`). At ≥1024px a `#rail-toggle` appears in the rail footer and collapses the rail to an 80px icon column, remembering the choice in `maghapon-rail-collapsed` (`responsive.css:200-247`). Mobile (≤767px) is a sticky 64px compact top bar plus a fixed 4-tab bottom bar (Home / Menu / Book / Cart, z-index 80, safe-area padded, active tab in Sinaing Rust) — `shell.css:233-246`, `:262-298`. The four `backdrop-filter` surfaces in `src/styles/` all blur the page behind them with `blur(10px)`, but they fill from two different families, and neither fill is a token. Three take the untokenised gray `rgba(224, 224, 224, …)`: the admin `.app-toolbar` (`shell.css:207`, α 0.92), the `.mobile-topbar` (`shell.css:243`, α 0.92) and the sticky category `.tabs` (`menu-card.css:237`, α 0.95). The fourth — the mobile bottom **tab bar** — is cream, not gray: `rgba(244, 239, 230, 0.96)` at `shell.css:272`, which is `--cream`/#f4efe6 at 0.96 alpha (`shell.css:262-275`, the fixed bottom bar with a `border-top`). So the no-grays rule is breached by exactly those three gray chrome sites, and the CSS offers no stated reason for the tab bar's different family — the observable split is top-edge sticky chrome (gray, `border-bottom`) versus the bottom bar (cream, `border-top`).

**Signature.** The status pill — "Open now" with a pulsing green dot (`--green`, 2s ring) or "Closed" with a rust dot (`shell.css:133-157`) — is no longer part of the chrome it used to sit in: it and the single order trigger form one fixed `.global-controls` cluster at the top right of every customer page at every width (z-index 60, `right: clamp(0.75rem, 3vw, 1.5rem)`, shifting to `calc(340px + 1.5rem)` when the ≥1024px cart panel opens) — `shell.css:216-230`, `responsive.css:193-196`. At ≤360px both status pills become 44px squares with visually hidden text (`responsive.css:78-96`). The cart/order button is a 44px circle with a 20px Sinaing Rust badge perched at −4px on its corner (`shell.css:158-166`, `:176-186`), and exactly one `#cart-open` exists in the DOM at a time — plus `#cart-open-tab` in the bottom bar — toggling the panel, the drawer, or the sheet according to width, never two surfaces at once.

## Do's and Don'ts

### Do:
- Do use warm, brown-tinted shadows — depth should feel like lamplight.
- Do keep every interactive control a pill or circle with at least 44px of touch target.
- Do set every heading in Fraunces and every body in Geist Variable.
- Do rest surfaces on Palay or Palay Bright and reserve Sinaing Rust for action and rarity.
- Do let drawers and panels slide as physical layers with directional shadows.
- Do honor reduced motion — instant transitions, no lingering pulses.
- Do keep spacing generous; this is an unhurried site.

### Don't:
- Don't use gray or black shadows, or cold blue-gray neutrals — they break the hearth.
- Don't put a saturated color behind body copy; text always sits on cream.
- Don't set body text in the serif, or headings in the sans.
- Don't use more than one saturated accent at a time — Pandan and Sinaing Rust never compete.
- Don't introduce sharp corners, glassy translucency, or corporate beige minimalism. *(Today's sticky chrome already breaches the translucency half of this line — `rgba(224, 224, 224, .92–.95)` + `blur(10px)` at `shell.css:207-208`, `:243-244` and `menu-card.css:237-238`. Phase 2 does not remove it; spec §5.4 item 2 replaces the outright ban with a scoped permission: sticky chrome only, naming `tab-bar` and the panel header, ≥92% opacity, max two elements per screen, off under `prefers-reduced-transparency` — rationale is `backdrop-filter` cost in Android WebView, not taste. Read against that scope today's CSS is only half-compliant: the α .92/.95 fills clear the opacity floor and the bottom `.tab-bar` is one of the two named surfaces, but `.mobile-topbar` and the menu page's sticky `.tabs` are not, and the mobile menu screen stacks three blurred elements against a cap of two. §5.4 is Phase 2's forward rule, not a grandfathering of these four sites.)*
- Don't rush the motion: the floor is the 160ms press squish, and nothing that moves a surface does so faster than that; state changes sit at 0.2s, cards and buttons at 0.7s, reveals at 0.8s, all on the standard ease.