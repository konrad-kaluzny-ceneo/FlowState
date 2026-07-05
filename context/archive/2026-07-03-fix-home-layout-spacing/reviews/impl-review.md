<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: Home Layout Composition Contract + Navbar + Hero Removal

- **Plan**: context/changes/fix-home-layout-spacing/plan.md
- **Scope**: Full plan — Phases 1–4 of 4 (commits `4bde5d8`, `8a1a53a`, `72af0e9`, `1679121`, epilogue `393bd2b`; base `a7b0756`)
- **Date**: 2026-07-04
- **Verdict**: APPROVED
- **Findings**: 0 critical · 1 warning · 4 observations
- **Merge-readiness confidence**: 90/100

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | WARNING (F1) |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Verification evidence (re-run during this review)

| Check | Result |
|---|---|
| `npm run typecheck` | PASS |
| `npm run check` (biome, 431 files) | PASS |
| `npm run test` (vitest) | PASS — 145 files, 1156 tests |
| `npx playwright test e2e/layout-rhythm.spec.ts --project=chromium --project=mobile-chromium` | PASS — 2/2 in 15.2s |
| Full e2e belt | Not re-run in review; recorded green per phase in plan Progress (SHAs) |
| Width-cap grep (14 listed files) | Clean — remaining `max-w-lg` only in documented exceptions (`HomeLayoutRegion` contract itself, dashboard root `lg:max-w-7xl` container, `OfflineBanner`, `GuestBanner`) |
| Orphaned i18n grep (`appName|purposeHeader|tagline` in src) | Clean — only the S-40 matrix key (see F3) and negative test assertions |
| en.json / pl.json symmetry | `Navbar.brand` added to both; same 3 `Home` keys deleted from both |

## High-risk spot verification (requested focus)

**`hasContent` booleans (`pomodoro-dashboard.tsx:921-939`) — EXACT MATCH, no mismatch found.**

- Primary (`:921`): `dayMemoryVisible` ‖ `steering-in-primary && steeringCards != null` ‖ `nextFocus-in-primary && (kickoffDurationChips ∨ breakSuggestionCard ∨ kickoffSuggestionCard) != null` ‖ `timerZone === "primary"` ‖ `archive-in-primary && taskArchive != null` — each term mirrors the child gate at `:978-991` verbatim. `timerZone === "primary"` implies `timerShown` implies `timerPanel != null` (`:646-652`, `:723`), so the timer term is exact by construction.
- Secondary (`:931`): `statusLines != null` ‖ `timerZone === "secondary"` ‖ `steering-in-secondary && steeringCards != null` ‖ `overrideAcknowledgement != null` ‖ `dayPlan != null` (wrapper gate) ‖ `recapPanel != null` (wrapper gate) ‖ `inventory-in-secondary && taskInventory != null` ‖ `archive-in-secondary && taskArchive != null` — mirrors `:997-1017` verbatim, including the `lg:hidden` mobile-only wrappers counting as content per the plan's Critical Implementation Details.
- `dayMemoryVisible` hoisting (`:633`): `state !== "active_work" && !recapLoading && dayMemoryHasContent` exactly mirrors `DayMemoryLine`'s internal `if (isLoading || !dayMemory.hasContent) return null` (`day-memory-line.tsx:35`); both sides call the same `formatDayMemory` with the same inputs and both locales come from `useLocale()`. Rendered output is byte-identical to pre-change (the component previously returned null in exactly those states).
- Context rail left unconditional is safe by construction: authenticated rail always contains the illustration div (`:891`); `GuestContextRail` always renders two blocks + banner. `hidden lg:flex` retained.

**S-40 / S-43 / overlays / auth — no damage found.**

- `home-session-state.ts` untouched (module routing intact); rendering still reads the matrix via `moduleInZone`/`moduleVisible`.
- Illustration plumbing: `HomeIllustrationVariantProvider` still mounted in `HomeShell` (`home-shell.tsx:114`); the dashboard's `usePublishHomeIllustrationVariant(homeIllustration)` publish (`pomodoro-dashboard.tsx:614`) and rail `HomeHeroSprig` render (`:891-896`) are untouched. The navbar correctly composes `CalmGardenSprig` statically (idle, `aria-hidden` via the SVG itself) outside the provider — it never calls `useHomeIllustrationVariant`.
- No overlay/wedge file touched: `overlay-shell.tsx`, `transition-conductor`, `use-pomodoro-cycle`, `TabReturnCatchUp`, `WedgeSyncRecovery`, `MidCycleCompletionPrompt` render paths all unchanged in the diff (lessons.md dismiss-oracle rule not triggered).
- Auth: `layout.tsx` keeps the try/catch around `auth.getSession()`; `UserMenu` sign-out logic unchanged (only the name span gained `hidden lg:inline`, per plan); auth pages changed only `min-h-screen` → `flex-1`.

## Findings

### F1 — Phase 4 oracle narrower than planned (guest home + energy-card edge dropped)

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: e2e/layout-rhythm.spec.ts:23
- **Detail**: Plan Phase 4 intent: bounding-box assertions on "the authenticated home … **and guest home**", left edges of "`day-memory-line`, **the energy card**, and `task-list`", and gaps "between adjacent sections". Implemented: a single authenticated test (the `./fixtures` auth fixture; the spec never runs guestless — `guest-chromium` excludes it by testMatch), edge check on day-memory vs task-list only, and one region-to-region gap measurement. The guest home's layout (GuestBanner + guest rail geometry) has no geometry oracle, and this narrowing is not documented in the plan, commit message, or an adaptation note — unlike the other five documented adaptations, which all check out.
- **Fix A ⭐ Recommended**: Add a second test in the same spec using the base (unauthenticated) Playwright `test` for the guest home — navbar clearance + no horizontal overflow + task-list/banner edge — and include `session-energy-card` in the edge assertion when present. Strength: closes the planned oracle gap with ~20 lines; the spec already handles both viewports. Tradeoff: slightly longer belt (2 more test executions). Confidence: HIGH — guest smoke helpers already exist (`clearOnboardingKeys` works guestless). Blind spot: guest idle state may not show `day-memory-line`, so the guest test needs its own anchor elements.
- **Fix B**: Document the narrowing as a plan addendum (authenticated-only oracle; guest layout shares the same zone components so drift is unlikely). Strength: zero code. Tradeoff: guest-only regressions (e.g., GuestBanner width exception interacting with zone caps) stay invisible to CI. Confidence: MEDIUM. Blind spot: guest rail uses its own `GuestRailBlock` widths — exactly the kind of per-component cap this change was eliminating.
- **Decision**: PENDING

### F2 — Region-emptiness invariant test covers 4 states, not the full matrix

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/app/_components/pomodoro-dashboard.test.tsx:1461
- **Detail**: The `hasContent` booleans are hand-mirrored and guarded only by a comment plus the "never renders an empty layout region" test, which walks 4 pomodoro states (idle ×2, running, break). States like steering/energy-choice, return-handoff, and completed are not walked, so a future child-gate edit that desyncs a boolean in those states would pass unit CI (the Playwright belt would likely catch the resulting gap only if it changes measured geometry). Also, the planned assertion "(a) primary region absent in active_work-with-recap-hidden" was implemented as this weaker presence-implies-non-empty invariant rather than a direct absence assertion.
- **Fix**: Extend the state table in the invariant test with the remaining `deriveHomeSessionState` inputs and add one direct `queryByTestId("home-primary-region") === null` assertion for the active_work/no-day-memory state.
- **Decision**: PENDING

### F3 — Dead `purposeHeader` module key survives in the S-40 matrix

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Architecture
- **Location**: src/lib/home/home-session-state.ts:4 (+ :61,196,216,233,259,278; test :129)
- **Detail**: `HomeModuleKey` still contains `purposeHeader` and five states still route it to `"secondary"`, but after D-07 no renderer consumes it (it was already only statically rendered by the hero pre-change). Leaving it is consistent with the plan's "What We're NOT Doing" (no `home-session-state.ts` changes), so this is not drift — but it is now provably dead vocabulary that will mislead future matrix readers.
- **Fix**: Remove the key from the matrix in a follow-up change (touches S-40 tests; deliberately out of scope here).
- **Decision**: PENDING

### F4 — `expectOutsidePrimaryRegion` helper is vacuous when the region is absent

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/app/_components/pomodoro-dashboard.test.tsx:1068
- **Detail**: The documented "helpers tolerate absent regions" adaptation makes `expectOutsidePrimaryRegion` return silently when `home-primary-region` is missing — the "X is not inside primary" assertion then passes without checking X's actual placement. Callers that expect X to exist elsewhere still assert that separately, so today's coverage holds, but the helper's name now overstates what it proves.
- **Fix**: When the region is absent, assert the testId exists somewhere in the document before returning, or rename to reflect the tolerance.
- **Decision**: PENDING

### F5 — AppNavbar branches on `userName` truthiness, not `scope.mode`

- **Severity**: ℹ️ OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/app/_components/app-navbar.tsx:37
- **Detail**: `userName ? <UserMenu/> : <GuestHeaderControls/>` — an authenticated session whose user has neither `name` nor a usable `email` prefix (or an empty-string name) would render guest controls with an authenticated `scope`, hiding sign-out. `layout.tsx` makes this practically unreachable today (email is required at sign-up), so this is a robustness note, not a defect.
- **Fix**: Branch on `scope.mode === "authenticated"` and pass `userName ?? ""` to `UserMenu`, or leave as-is with a comment.
- **Decision**: PENDING

## Notes on flake risk for the new belt (requested focus)

- **Viewport handling is correct**: the custom auth fixture builds its context via `browser.newContext({ storageState })`, which bypasses project `use` context options — the spec compensates with `page.setViewportSize(test.info().project.use.viewport ?? 1280×720)` before navigation (`layout-rhythm.spec.ts:28-32`). Verified live: passes on both `chromium` and `mobile-chromium`.
- **Concurrency**: worker count is capped at `AUTH_POOL_SIZE` (4) and each concurrent worker maps to a distinct auth slot, so the desktop and mobile runs of this spec use different accounts — no same-account layout churn mid-measurement.
- **Residual risks (accepted, low)**: pooled e2e accounts accumulate one `Rhythm probe <timestamp>` task per run (day-memory count text changes, geometry stable); the navbar-clearance assertion has a 0.5px epsilon which is safe because the navbar is in-flow, not overlapping; the overflow check compares `scrollWidth` to `innerWidth` (scrollbar-inclusive), which is the lenient direction.
