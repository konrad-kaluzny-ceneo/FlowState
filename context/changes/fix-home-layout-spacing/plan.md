# Home Layout Composition Contract + Navbar + Hero Removal — Implementation Plan

## Overview

Fix wave 2 from the post-MVP defect register: rebuild the home layout so it stops looking "rozjechana". Three coupled defects land as one change: **D-06** — an app navbar with the brand mark linking to `/`, visible on all pages including `/auth/*`, replacing the floating fixed header (which also fixes the mobile header-overlap defect); **D-07** — removal of the home hero section (title + taglines), with the product-voice contract amended; **D-01** — the layout composition contract from [frame.md](frame.md): empty regions contribute no gaps, spacing hierarchy wired from DESIGN.md tokens, width constraints owned by zones instead of 17 individual components. A new geometry-based Playwright belt (desktop + mobile viewport) guards the class of defect the current structural tests cannot see.

## Current State Analysis

From [frame.md](frame.md) (hypotheses 1–3 all STRONG) and [research.md](research.md), verified at commit `a7b0756`:

- **Header**: `src/app/layout.tsx:77` renders `<header className="fixed top-0 right-0 z-50 p-4">` with `UserMenu` (authenticated) or `GuestHeaderControls` (guest). Zero responsive handling; overlaps content below `lg`. All 6 routes (home + 4 auth pages) inherit it. No e2e test selects its controls.
- **Hero**: `src/app/_components/home-shell.tsx:102-117` — `HomeHeroSprig` + `h1` "FlowState" + purpose header + tagline. The i18n keys `Home.appName/purposeHeader/tagline` are used only here. Asserted by `home-shell.test.tsx:143-175` (3 blocks) and `e2e/smoke.spec.ts:19` (heading "FlowState"). `product-voice.md` anchors its 5-second purpose test on `Home.purposeHeader`.
- **Regions**: all four `HomeLayoutRegion`s render unconditionally (`pomodoro-dashboard.tsx:939,956,961,986`) inside `gap-8` columns; `home-inventory-zone` (:956) is always empty by design; primary region empties during `active_work` with recap hidden — empty regions double gaps state-dependently at every width.
- **Spacing**: flat `gap-8` (2rem) at 5 nesting levels (`home-shell.tsx:100`; `pomodoro-dashboard.tsx:110,905,935,938`). `DESIGN.md:78` prescribes `section-gap: 1.5rem`; the token is wired nowhere in `globals.css` (colors only in `@theme`).
- **Widths**: 17 home-surface components self-cap at `max-w-lg`/`max-w-md`; only 4 add `lg:max-w-none` — ragged left edges on desktop (full inventory in research.md §3 and the gap-agent report tables).
- **Tests**: no test asserts gap classes (safe to change); tests DO assert region testids (`pomodoro-dashboard.test.tsx:1421-1432`) and hero elements. Playwright runs Desktop Chrome 1280×720 only.
- **Illustration plumbing**: `HomeIllustrationVariantProvider` is mounted in `HomeShell` (`home-shell.tsx:134`), consumed by the hero (to be removed) and the desktop rail (`pomodoro-dashboard.tsx:877-882`, stays). The dashboard publishes the variant upstream (`pomodoro-dashboard.tsx:596-613`).

## Desired End State

- Every page shows a static (in-flow) full-width navbar: sprig + "FlowState" wordmark linking to `/` on the left; language switch, theme toggle, and (authenticated) user name + sign-out on the right; compact below `lg` (user name hidden, controls may wrap). Nothing overlaps content at any width because the bar occupies real layout space.
- The home page starts directly with content (offline/guest banners, then the workbench); no hero.
- Home sections share one left edge at every width; gaps between sections are uniformly `1.5rem` (token-driven); zone-level gaps (page container, grid columns) stay `2rem`. No state of `deriveHomeSessionState` produces a doubled gap.
- `npm run test`, `npm run typecheck`, `npm run check`, and the Playwright belt (now including a 375×812 mobile project with geometry assertions) are green.

### Key Discoveries:

- All 6 routes share the root layout — one navbar placement covers D-06 entirely (`src/app/layout.tsx:34-91`).
- `HomeHeroSprig` takes `variant`/`energyTint` as props (`src/lib/design/illustrations/home-hero-sprig.tsx:13-35`) — but its wrapper hardcodes `h-12 w-20`; the navbar mark should compose `CalmGardenSprig`/`CalmGardenBlob` primitives directly at navbar scale instead.
- The illustration provider lives in `HomeShell`, NOT the root layout — the navbar cannot consume it and must not try (static idle pose only).
- Auth pages each render `<main className="flex min-h-screen items-center justify-center …">` — an in-flow navbar above them creates viewport overflow unless the vertical-centering strategy changes (see Critical Implementation Details).
- Tailwind v4 `@theme` `--spacing-<name>` tokens generate `gap-<name>` / `space-y-<name>` utilities — wiring `section-gap` is one CSS line plus class renames.
- `task-list.tsx:837` already uses `space-y-6` = 1.5rem — the DESIGN.md section-gap value — so the two-tier scale converges with what the densest component already does.

## What We're NOT Doing

- **D-04 illustration visibility** (size/contrast revision, scrims) — fix wave 5, after this change. We only preserve the rail mount and add the navbar mark at whatever visibility the current tokens give.
- **D-10 status-vocabulary unification** — wave 4. No copy changes beyond deleting hero keys and amending product-voice's purpose-test section.
- **Overlay surfaces** — `overlay-shell.tsx`, `TabReturnCatchUp` wrappers keep their own `max-w-*`; wedge/overlay geometry is out of scope (lessons.md: change transition surfaces with highest caution).
- **Timer/session behavior** — no changes to `use-pomodoro-cycle`, module derivation logic in `home-session-state.ts`, or S-40's priority matrix. We only make rendering reflect the matrix.
- **Other DESIGN.md tokens** (`overlay-padding`, `row-padding-*`) — deliberately not wired now (decision: two-tier section-gap only).
- **Transient banners** (`OfflineBanner`, `GuestBanner`) keep their own `max-w-lg` — they are alerts, not layout sections; documented exception to zone-owned widths.

## Implementation Approach

Four phases, each independently green. Phase 1 installs the navbar (so branding exists before the hero dies), Phase 2 removes the hero and amends the voice contract, Phase 3 rebuilds the composition contract (tokens → zone widths → conditional regions), Phase 4 adds the geometry belt asserting the final state at two viewports. Phases 1+2 and Phase 3 touch disjoint code and could reorder if needed, but the belt (4) must come last.

## Critical Implementation Details

**Illustration context boundary** — `HomeIllustrationVariantProvider` is mounted in `HomeShell` (`home-shell.tsx:134`); the navbar renders in the root layout OUTSIDE that provider. The navbar mark must be a static composition of the CalmGarden primitives (idle pose, no energy tint) — importing `useHomeIllustrationVariant` in the navbar will throw or silently default. After hero removal, the provider and the dashboard's publish path (`pomodoro-dashboard.tsx:596-613`) must remain intact for the rail sprig.

**Viewport height accounting** — home (`home-shell.tsx:96`) and all 4 auth pages use `min-h-screen` on their `<main>` for vertical centering. With an in-flow navbar, that yields navbar-height of overscroll on every page. Restructure once in the root layout: `<body>` becomes a `flex min-h-screen flex-col` column, navbar is the first row, and each page `<main>` drops `min-h-screen` for `flex-1` (5 files). Verify no page regains a phantom scrollbar at 1280 and 375.

**Region-visibility parity** — Phase 3 renders regions conditionally. The `hasContent` booleans must be derived from the *same* expressions that gate the children (`dayMemoryVisible`, `moduleInZone(...)`, `timerZone`, `pomodoro.overrideAcknowledgement`, `dayPlan`, `recapPanel`) — not re-derived from state independently, or regions will flicker out of sync with S-40's matrix. Mobile-only children wrapped in `lg:hidden` still count as content (they are visible below `lg`).

**Testing note** — jsdom cannot measure geometry (S-41 research), which is why Phase 4 uses Playwright bounding boxes. For logged-in belt runs use `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` from `.env` per lessons.md — never hardcode credentials.

## Phase 1: App Navbar Replaces Fixed Header

### Overview

Introduce `AppNavbar` in the root layout across all 6 routes; delete the fixed top-right header. This alone fixes the mobile overlap defect and delivers D-06.

### Changes Required:

#### 1. New navbar component

**File**: `src/app/_components/app-navbar.tsx` (new)

**Intent**: Full-width static bar in document flow. Left: brand link to `/` — CalmGarden sprig mark (static idle pose, ~`h-6 w-8` scale, `aria-hidden`) + "FlowState" wordmark. Right: `HeaderPreferenceControls`; when authenticated also user name (hidden below `lg`: `hidden lg:inline`) and the sign-out button. Controls container may `flex-wrap` so narrow widths grow the bar instead of overflowing.

**Contract**: Props `{ scope: OnboardingScope; userName: string | null }` (same data the layout already derives). Rendered element is `<header data-testid="app-navbar">` with NO `fixed`/`sticky`/z-index — it must occupy layout space. Brand link: `<Link href="/">` with accessible name "FlowState" from a new `Navbar.brand` i18n key (en + pl). Styling uses semantic tokens only (`border-border-subtle`, `bg-*` tokens or transparent over the shell gradient); horizontal padding `px-4` to match the page container. Reuse `UserMenu`'s sign-out logic — either by rendering `UserMenu`/`GuestHeaderControls` inside the bar or by lifting their internals; keep `data-testid="language-switch"` and `data-testid="theme-toggle"` untouched (unit tests select them).

#### 2. Root layout swap

**File**: `src/app/layout.tsx`

**Intent**: Replace the fixed header block (lines 77-83) with `<AppNavbar>`; restructure `<body>` as a `flex min-h-screen flex-col` column so pages can size with `flex-1`.

**Contract**: `AppNavbar` receives the already-computed `userName`/`scope`. The old `<header className="fixed top-0 right-0 z-50 p-4">` is deleted, not hidden. `UserMenu`/`GuestHeaderControls` imports move or stay depending on §1's composition choice.

#### 3. Page mains stop double-counting the viewport

**Files**: `src/app/_components/home-shell.tsx` (line 96), `src/app/auth/sign-in/page.tsx`, `src/app/auth/sign-up/page.tsx`, `src/app/auth/forgot-password/page.tsx`, `src/app/auth/reset-password/page.tsx`

**Intent**: Swap `min-h-screen` for `flex-1` on each page `<main>` so navbar + page fill exactly one viewport (auth cards stay vertically centered via the existing `items-center justify-center`).

**Contract**: No other class changes on these mains in this phase.

#### 4. Navbar tests

**File**: `src/app/_components/app-navbar.test.tsx` (new)

**Intent**: Component tests — brand link points to `/` with accessible name "FlowState"; guest variant shows preference controls without name/sign-out; authenticated variant shows name + sign-out; no `fixed` class on the header element.

**Contract**: Same render harness as `user-menu.test.tsx` (ThemeProvider + NextIntl wrappers).

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Lint/format passes: `npm run check`
- E2E belt passes: `npm run test:e2e:belt` (existing specs; smoke still finds "FlowState" — heading removal happens in Phase 2)

#### Manual Verification:

- At 375px width: navbar controls do not overlap any content on home (guest + authenticated) and on `/auth/sign-in`; the bar wraps or compacts gracefully
- At 1280px: navbar reads as one calm row; brand left, controls right; both themes look correct
- No page shows a scrollbar when content fits the viewport (auth pages especially)
- Sign-out from the navbar works and lands on `/auth/sign-in`

**Implementation Note**: After completing this phase and all automated verification passes, pause for manual confirmation before proceeding.

---

## Phase 2: Hero Removal + Voice-Contract Amendment

### Overview

Delete the home hero (D-07); the navbar from Phase 1 now carries the brand. Amend `product-voice.md` so the contract stays truthful.

### Changes Required:

#### 1. Remove the hero block

**File**: `src/app/_components/home-shell.tsx`

**Intent**: Delete the `<header className="space-y-2 text-center">` block (lines 102-117) with its `HomeHeroSprig`, `h1`, purpose header, and tagline; drop the now-unused `HomeHeroSprig` import and the `useHomeIllustrationVariant` call that only fed the hero (line 81). Add an `sr-only` `h1` ("FlowState") so the home document keeps a heading outline.

**Contract**: `HomeIllustrationVariantProvider` (line 134) and everything the rail consumes MUST stay. `OfflineBanner` and `GuestBanner` remain as the first children of the container.

#### 2. i18n cleanup

**Files**: `messages/en.json`, `messages/pl.json`

**Intent**: Delete `Home.purposeHeader` and `Home.tagline`. Delete `Home.appName` only if nothing references it after Phase 1 (the navbar uses `Navbar.brand`); the `sr-only` h1 may reuse `Navbar.brand`.

**Contract**: No other keys in the `Home` namespace change.

#### 3. Test updates

**Files**: `src/app/_components/home-shell.test.tsx`, `e2e/smoke.spec.ts`

**Intent**: Delete the three hero assertion blocks (lines 143-175); keep the `lg:max-w-7xl` container test. In smoke, replace the visible-heading assertion (line 19) with the navbar brand link (`getByRole("link", { name: "FlowState" })`).

**Contract**: `src/lib/design/illustrations/home-hero-sprig.tsx` and its test file are NOT deleted — the rail still renders the component.

#### 4. Product-voice amendment

**File**: `context/foundation/product-voice.md`

**Intent**: Update the copy-zones table row for `Home.purposeHeader` (owner surface removed) and rewrite the 5-second purpose test to state that the answer to "co teraz?" is now delivered by the first card in the primary region (energy question / day memory / kickoff), with the navbar carrying brand only. Record the D-07 decision reference and date.

**Contract**: Amendment only — do not delete the 5-second test itself.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type checking passes: `npm run typecheck`
- Lint passes: `npm run check`
- No orphaned i18n keys: grep for `purposeHeader|tagline` in `src/` returns nothing
- E2E belt passes: `npm run test:e2e:belt`

#### Manual Verification:

- Home (guest + authenticated) opens directly with banners/workbench — no title block, no leftover vertical hole where the hero was
- Rail illustration still crossfades through session states (idle → work → break) on desktop
- PL and EN locales both render without missing-message warnings in the console

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: Layout Composition Contract

### Overview

D-01 proper: wire the spacing token, make zones own widths, and stop empty regions from rendering. This phase touches only the home composition layer + the 17 inventory components' width classes.

### Changes Required:

#### 1. Wire the section-gap token

**File**: `src/styles/globals.css`

**Intent**: Add the DESIGN.md spacing token to the `@theme` block so Tailwind v4 generates utilities.

**Contract**: `--spacing-section: 1.5rem;` (name: `section`, so `gap-section` / `space-y-section` exist). This is the only token wired in this change.

#### 2. Two-tier gap application

**Files**: `src/app/_components/home-shell.tsx` (line 100), `src/app/_components/pomodoro-dashboard.tsx` (lines 110, 905, 935, 938)

**Intent**: Zone level keeps `gap-8` (2rem): the home-shell container, the dashboard root wrapper, and the workbench grid (column gap). Section level becomes `gap-section` (1.5rem): `HomeLayoutRegion`'s internal gap (:110) and the left-column wrapper between regions (:938). Optionally rename `task-list.tsx:837`'s `space-y-6` to `space-y-section` (same rendered value, token traceability).

**Contract**: Rendered result — 2rem between page-level blocks and between grid columns; 1.5rem between cards/sections within a column. The 62/38 grid definition and `lg:items-start` are untouched (S-41).

#### 3. Zone-owned widths

**Files**: `src/app/_components/pomodoro-dashboard.tsx` (HomeLayoutRegion, lines 99-116) plus the width-capped inventory components: `session-steering-card.tsx` (:30, :85), `timer-panel.tsx` (:127), `task-list.tsx` (:837), `kickoff-duration-chips.tsx` (:35), `task-archive-view.tsx` (:130), `focus-budget-prompt.tsx` (:83), `day-memory-line.tsx` (:43), `daily-recap-panel.tsx` (:128), `home-focus-summary.tsx` (:80), `guest-context-rail.tsx` (:16), and the inline wrappers in `pomodoro-dashboard.tsx` (:669, :679, :734, :969)

**Intent**: `HomeLayoutRegion` gains the width contract (`w-full max-w-lg lg:max-w-none` alongside its existing classes); every listed component/wrapper drops its own `max-w-lg` and `lg:max-w-none`, keeping `w-full`. One left edge per column, at every width, owned in one place.

**Contract**: Exceptions (keep own `max-w-lg`): `OfflineBanner` (`home-shell.tsx:60`) and `GuestBanner` — transient alerts outside regions. Overlays are untouched. Components must remain visually identical below `lg` (region cap replaces self cap at the same 32rem value).

#### 4. Conditional regions + delete inventory-zone

**File**: `src/app/_components/pomodoro-dashboard.tsx` (lines 934-989)

**Intent**: Delete the always-empty `home-inventory-zone` block (:956-959). For primary, secondary, and context-rail regions: compute `hasContent` from the exact child-gating expressions and skip rendering the region when false — no region, no phantom gap.

**Contract**: Booleans mirror child conditions verbatim (see Critical Implementation Details). The rail keeps `hidden lg:flex` when rendered. Region testids (`home-primary-region`, `home-secondary-region`, `home-context-rail`) are unchanged when present; `home-inventory-zone` disappears from the codebase including its `HomeLayoutRegionTestId` type member.

#### 5. Test updates

**Files**: `src/app/_components/pomodoro-dashboard.test.tsx` (and `home-shell.test.tsx` if it asserts gaps)

**Intent**: Remove `home-inventory-zone` assertions (:1421-1432 area); add assertions that (a) primary region is absent in an `active_work`-with-recap-hidden state, (b) regions carry the width contract classes, (c) a region present in one state contains its expected children (existing `expectInsideRegion` helper keeps working).

**Contract**: Do not weaken existing region-composition assertions — adapt them to conditional presence.

### Success Criteria:

#### Automated Verification:

- Unit tests pass: `npm run test`
- Type checking passes: `npm run typecheck` (inventory-zone testid type member removed cleanly)
- Lint passes: `npm run check`
- No self-capped widths remain: grep for `max-w-lg` in the 14 listed component files returns only the documented exceptions
- E2E belt passes: `npm run test:e2e:belt`

#### Manual Verification:

- Desktop 1280px, authenticated idle: day-memory bar, energy card, and task list share one left edge and fill the 62% column; rail blocks share one edge in the 38% column
- Mobile 375px: single column, uniform 24px rhythm between sections, no doubled gap anywhere
- Walk the states (idle → steering → work → break → return): no state shows a hole where an empty region used to be; timer/wedge flows unaffected
- Both themes: spacing reads calm, not cramped ("space to breathe" voice check)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Visual-Rhythm Belt

### Overview

Add the missing oracle class: geometry assertions at two viewports, so this defect family can never again pass a green CI.

### Changes Required:

#### 1. Mobile Playwright project

**File**: `playwright.config.ts`

**Intent**: Add a `mobile-chromium` project with viewport 375×812, scoped via `testMatch` to the new layout spec (avoid doubling the whole belt's runtime).

**Contract**: Existing `chromium` / `guest-chromium` projects unchanged.

#### 2. Layout-rhythm spec

**File**: `e2e/layout-rhythm.spec.ts` (new)

**Intent**: Bounding-box assertions on the authenticated home (sign-in via existing API helpers + `E2E_TEST_EMAIL`/`E2E_TEST_PASSWORD` pattern) and guest home:

- navbar's box bottom ≤ first content element's box top (no overlap), both viewports
- left edges of `day-memory-line`, the energy card, and `task-list` equal within 1px, both viewports
- vertical gaps between adjacent sections in the primary/secondary column ≈ 24px (±2px tolerance)
- `document.documentElement.scrollWidth <= window.innerWidth` at 375 (no horizontal scroll)

**Contract**: Runs in both the desktop `chromium` project and the new mobile project (spec must not assume one viewport). Use existing `data-testid` selectors; add no new testids unless a section lacks one. Guard flake with Playwright auto-waiting on visible cards before measuring.

### Success Criteria:

#### Automated Verification:

- New spec passes on desktop: `npx playwright test e2e/layout-rhythm.spec.ts --project=chromium`
- New spec passes on mobile: `npx playwright test e2e/layout-rhythm.spec.ts --project=mobile-chromium`
- Full belt passes: `npm run test:e2e:belt`
- Lint/typecheck pass: `npm run check && npm run typecheck`

#### Manual Verification:

- Intentionally re-adding `max-w-lg` to one card locally makes the alignment assertion fail (oracle actually bites)
- Belt runtime increase is acceptable (mobile project runs one spec only)

---

## Testing Strategy

### Unit Tests:

- `app-navbar.test.tsx`: brand link, guest vs authenticated variants, no fixed positioning
- `home-shell.test.tsx`: hero assertions removed; container width test kept; provider still mounted
- `pomodoro-dashboard.test.tsx`: conditional region presence per session state; region width-contract classes; inventory-zone gone

### Integration Tests:

- Existing belt (smoke, guest-trial, guest-merge, account-recovery, accessibility) — updated smoke heading assertion is the only expected diff

### Manual Testing Steps:

1. 375px: guest home, authenticated home, sign-in — navbar never overlaps; no horizontal scroll
2. 1280px authenticated idle: one left edge per column; 24px rhythm; rail intact with illustration
3. Run a full pomodoro beat (start → work → break → return) — no layout jumps from regions appearing/disappearing mid-transition
4. Toggle dark theme and PL/EN on the navbar from an auth page — controls work outside the home shell

## Performance Considerations

None material: the navbar is static server-rendered markup; conditional regions remove DOM rather than add it. No new client JS beyond what `UserMenu` already ships.

## Migration Notes

No data or API changes. Single-PR change; revert = revert the PR. The deleted `home-inventory-zone` testid type member is the only "API" removal, and it's internal.

## References

- Frame brief: `context/changes/fix-home-layout-spacing/frame.md` (root-cause hypotheses, composition-contract statement)
- Research: `context/changes/fix-home-layout-spacing/research.md`
- Defect register + binding decisions: `context/changes/mvp-defect-intake/change.md` (uncommitted on `main` — reconcile before merge)
- Design contract: `DESIGN.md:74-78` (spacing tokens)
- Prior slices: S-40 (`context/archive/2026-06-27-home-ia-reset/`), S-41 (`context/archive/2026-06-29-desktop-calm-workbench/`), S-43 (`context/archive/stateful-illustration-system/`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: App Navbar Replaces Fixed Header

#### Automated

- [x] 1.1 Unit tests pass: `npm run test`
- [x] 1.2 Type checking passes: `npm run typecheck`
- [x] 1.3 Lint/format passes: `npm run check`
- [x] 1.4 E2E belt passes: `npm run test:e2e:belt`

#### Manual

- [x] 1.5 375px: navbar overlaps nothing on home (guest + auth) and /auth/sign-in
- [x] 1.6 1280px: navbar layout correct in both themes
- [x] 1.7 No phantom scrollbar on any page
- [x] 1.8 Navbar sign-out works → /auth/sign-in

### Phase 2: Hero Removal + Voice-Contract Amendment

#### Automated

- [ ] 2.1 Unit tests pass: `npm run test`
- [ ] 2.2 Type checking passes: `npm run typecheck`
- [ ] 2.3 Lint passes: `npm run check`
- [ ] 2.4 No orphaned i18n keys (`purposeHeader|tagline` grep clean)
- [ ] 2.5 E2E belt passes: `npm run test:e2e:belt`

#### Manual

- [ ] 2.6 Home opens directly with content; no hero hole
- [ ] 2.7 Rail illustration still state-driven on desktop
- [ ] 2.8 PL + EN render without missing-message warnings

### Phase 3: Layout Composition Contract

#### Automated

- [ ] 3.1 Unit tests pass: `npm run test`
- [ ] 3.2 Type checking passes: `npm run typecheck`
- [ ] 3.3 Lint passes: `npm run check`
- [ ] 3.4 Width-cap grep clean outside documented exceptions
- [ ] 3.5 E2E belt passes: `npm run test:e2e:belt`

#### Manual

- [ ] 3.6 1280px: one left edge per column; rail aligned
- [ ] 3.7 375px: uniform 24px rhythm, no doubled gaps
- [ ] 3.8 State walk shows no holes or layout jumps
- [ ] 3.9 Both themes pass the "space to breathe" check

### Phase 4: Visual-Rhythm Belt

#### Automated

- [ ] 4.1 layout-rhythm spec passes on chromium
- [ ] 4.2 layout-rhythm spec passes on mobile-chromium
- [ ] 4.3 Full belt passes: `npm run test:e2e:belt`
- [ ] 4.4 Lint + typecheck pass

#### Manual

- [ ] 4.5 Oracle bites on an injected width regression
- [ ] 4.6 Belt runtime increase acceptable
