---
date: 2026-07-02T15:31:33+02:00
researcher: Claude (10x-research, S4 of ship-slice-base)
git_commit: 68511afab511d0b7188b9d1781bd1cbafdad8e03
branch: claude/great-darwin-21f5c8
repository: FlowState
topic: "S-43 stateful-illustration-system — state-bound Calm Garden illustrations on home hero/rail"
tags: [research, codebase, illustrations, calm-garden, home-session-state, wedge-gates, s-43, s-28]
status: complete
last_updated: 2026-07-02
last_updated_by: Claude (10x-research)
---

# Research: S-43 stateful-illustration-system — state-bound Calm Garden illustrations on home hero/rail

**Date**: 2026-07-02T15:31:33+02:00
**Researcher**: Claude (10x-research, S4 of ship-slice-base)
**Git Commit**: 68511afab511d0b7188b9d1781bd1cbafdad8e03
**Branch**: claude/great-darwin-21f5c8
**Repository**: FlowState

## Research Question

For roadmap slice S-43 (`stateful-illustration-system`, S-28 phase 2): where do the Calm Garden illustrations from S-28 phase 1 currently live, how are "hero" and "desktop rail" structured post S-40/S-41, what session-state signal already exists to bind illustration variants to, and what must stay untouched (S-39 wedge gates) — so a plan can add a 6-variant state-bound illustration without inventing new domain concepts or regressing gate accessibility.

## Summary

The Calm Garden illustration system (S-28 phase 1, PR #160) lives entirely in `src/lib/design/illustrations/` as four static, prop-less (or `className`-only) React SVG components: `CalmGardenBlob`, `CalmGardenSprig`, `HomeHeroSprig` (composition of the first two), and `EmptyGardenBed` (separate empty-state composition, used only in `empty-active-tasks-guide.tsx`, not part of hero/rail scope). None of these accept a state/variant prop today — they render the identical static graphic everywhere.

`HomeHeroSprig` is rendered in **two places** with **zero differentiation**: the home hero header (`src/app/_components/home-shell.tsx:98`) and the desktop rail's already-reserved illustration slot (`src/app/_components/pomodoro-dashboard.tsx:807-811`, `data-testid="home-rail-illustration"` — this is the exact "mode/illustration slot" S-41 promised but never filled with state logic). S-43's job is to make both sites consume a session-state-driven variant instead of the one hardcoded sprig.

The best-grounded state signal is `src/lib/home/home-session-state.ts`'s `deriveHomeSessionState()`, a pure function already computed once per render in `pomodoro-dashboard.tsx` (~line 501-525) and returning `HomeSessionState = "idle" | "steering" | "active_work" | "break" | "returning"`. This is a **5-value** taxonomy; S-43's acceptance criteria in `S-43.md` specify **6** variants: `idle, energy_choice, work, break, return, closure`. Four map cleanly (`steering→energy_choice`, `active_work→work`, `returning→return`, `idle→idle`, `break→break`); `closure` has no `HomeSessionState` equivalent because session closure today is only reachable via the `session_closure` wedge gate (`SessionClosureOverlay`), which S-43 must never decorate. This mapping gap is resolved below (see Open Questions).

Wedge gates (F-07 conductor + S-39 accessibility) are cleanly separated from illustrations today: zero illustration imports exist in any of the 6 gate-relevant files (`check-in-overlay.tsx`, `cycle-complete-overlay.tsx`, `wind-down-overlay.tsx`, `session-closure-overlay.tsx`, `task-suggestion-card.tsx`, `kickoff-duration-chips.tsx`) or the shared `overlay-shell.tsx` primitive. S-39's own plan explicitly excluded "Calm Garden rebrand work." This boundary must be preserved by construction — the plan should treat these files as an explicit do-not-touch list.

Test coverage baseline is thin: one Vitest smoke test (`empty-garden-bed.test.tsx`), no dedicated tests for `HomeHeroSprig`/`CalmGardenBlob`/`CalmGardenSprig`, and **no Playwright E2E spec asserts on the illustration at all** (only incidental comments mentioning the rail in unrelated specs). `home-session-state.test.ts` (275 lines, 21 cases) is the strongest existing precedent for how a pure state-derivation function should be tested — a new `resolveIllustrationVariant`-style pure function should follow the same co-located-Vitest-test pattern, mirroring `work-focus-shell.ts`/`.test.ts` and `break-atmosphere.ts`/`.test.ts`.

## Detailed Findings

### Illustration primitives (S-28 phase 1 baseline)

- `src/lib/design/illustrations/index.ts` — barrel: `CalmGardenBlob`, `CalmGardenSprig`, `EmptyGardenBed`, `HomeHeroSprig`.
- `src/lib/design/illustrations/calm-garden-blob.tsx:7-46` — `CalmGardenBlob({ className?, "data-testid"? })`. `viewBox="0 0 120 80"`, 3 ellipses colored via CSS vars (`--color-surface-break`, `--color-energy-steady-bg`, `--color-accent-break`), `aria-hidden="true"` inline.
- `src/lib/design/illustrations/calm-garden-sprig.tsx:7-39` — `CalmGardenSprig({ className?, "data-testid"? })`. `viewBox="0 0 48 48"`, stroke-based line art, `text-accent-break`, `aria-hidden="true"` inline.
- `src/lib/design/illustrations/home-hero-sprig.tsx:5-16` — `HomeHeroSprig()`, **no props at all**. Composes blob + sprig absolutely positioned, wraps in `aria-hidden` `pointer-events-none` div, `data-testid="home-hero-sprig"`.
- `src/lib/design/illustrations/empty-garden-bed.tsx` — `EmptyGardenBed()`, no props. Used only by `empty-active-tasks-guide.tsx` for the empty-task-list state — **not** hero/rail, out of S-43 scope but a naming-adjacent surface to be aware of.
- No shared/exported `viewBox` constant or shared `aria-hidden` wrapper component — each SVG duplicates the attribute. No `variant` prop precedent anywhere in this directory; state-binding is new work, not an extension of an existing prop.
- No Storybook config/stories anywhere in the repo.

### Render sites — hero and rail

- **Hero**: `src/app/_components/home-shell.tsx:21` imports `HomeHeroSprig`; rendered at line 98 inside `<header>`, above `<h1>{t("appName")}</h1>` — always mounted regardless of auth/session state.
- **Rail**: `src/app/_components/pomodoro-dashboard.tsx:59` imports `HomeHeroSprig`; rendered at lines 807-811:
  ```tsx
  const authenticatedContextRail = (
      <>
          <div className="w-full" data-testid="home-rail-illustration">
              <HomeHeroSprig />
          </div>
          {recapPanel}
          {dayPlan != null ? <HomeFocusSummary .../> : null}
      </>
  );
  ```
  This `data-testid="home-rail-illustration"` div is the exact reserved "(1) mode/illustration slot" from S-41's acceptance criteria (`S-41.md` line 16) — it exists and is populated, but with a static, non-state-aware component. Guest mode renders `GuestContextRail` instead (line 830) — **no illustration in guest rail today**; worth an explicit decision in planning (guest rail scope currently: sign-in value prop, activation hint, empty-state guidance — no mode/illustration slot per S-41's guest block spec).
- Desktop workbench grid: `pomodoro-dashboard.tsx:863-918`, `data-testid="home-workbench-grid"`, `lg:grid-cols-[minmax(0,62fr)_minmax(0,38fr)]` (decision column ~62%, rail ~38%, matches S-41's "<~40%" constraint). Rail region wrapper: `<HomeLayoutRegion className="hidden lg:flex" testId="home-context-rail">` (lines 915-917) — i.e., rail (and therefore the illustration slot) is **desktop-only** (`hidden lg:flex`), consistent with S-43's "desktop rail" wording; below `lg` breakpoint there is currently no rail illustration surface, only the hero one.

### Session-state derivation — the state signal to bind to

`src/lib/home/home-session-state.ts` — pure function, no React hooks, `HOME_MODULE_KEYS`/`HomeModulePriorities` (S-40's module priority matrix) plus:

```ts
export type HomeSessionState =
    | "idle"
    | "steering"
    | "active_work"
    | "break"
    | "returning";

export function deriveHomeSessionState(
    input: DeriveHomeSessionStateInput,
): DeriveHomeSessionStateOutput // { state: HomeSessionState; modules: HomeModulePriorities }
```

Resolution order (`resolveSessionState`, lines 147-163): `active_work` (via `shouldShowWorkFocusShell`) → `break` → `returning` (`continueTaskId != null`, idle cycle) → `steering` (`showSessionEnergy || showSessionFocus`, gate-enabled) → else `idle`.

Called once per render inside `PomodoroDashboardBody` (`pomodoro-dashboard.tsx:501-525`), wrapped in a `useMemo`, fed by `usePomodoroCycle()` outputs (`pomodoro.state`, `pomodoro.cycleKind`, `wedgeGateActive`, `pomodoro.showSessionEnergy`, `pomodoro.showSessionFocus`, `continueTaskId`, etc.) — i.e., **already computed at the exact component level (`PomodoroDashboardBody`) that renders both the hero-adjacent rail block and could pass a derived variant down**. This is the "home-voice.ts" S-40 references in its unknowns — it is this file, not a separate one (a real but unrelated `src/lib/voice/home-purpose.ts` exists for copy strings only).

Co-located test: `src/lib/home/home-session-state.test.ts` (275 lines, 21 cases, 3 `describe` blocks) — strongest existing template for testing a new derivation/mapping function.

**Sibling pure-derivation precedent** (same pattern, good template for a new `resolveIllustrationVariant`):
- `src/lib/design/work-focus-shell.ts` — `shouldShowWorkFocusShell({ cycleKind, state, wedgeGateActive })`, returns boolean; explicitly checks `wedgeGateActive` to suppress itself during gates.
- `src/lib/design/break-atmosphere.ts` — `shouldShowBreakAtmosphere(...)`, same shape.
Both have co-located `.test.ts` files and both key off `wedgeGateActive` to auto-suppress during gate overlays — the same technique S-43 should reuse to guarantee illustrations never render "hot" during a gate, independent of any manual do-not-touch discipline in the gate files themselves.

### Energy check-in state (S-05 Focused/Steady/Fading)

- Domain type: `src/lib/domain/energy-level.ts` — `EnergyLevel = "FOCUSED" | "STEADY" | "FADING"`.
- UI type: `src/app/_components/energy-selector.tsx:5-7` — `CheckInEnergyUi = "focused" | "steady" | "fading"`, `CheckInEnergy = "FOCUSED" | "STEADY" | "FADING"`.
- Exposed on the pomodoro hook's public return as `narrativeLatestEnergy: EnergyLevel | null` (`src/hooks/use-pomodoro-cycle.ts`, set at line ~2699 on check-in confirm, restored from server stats ~line 1091/1105, returned at line 3681). **Already accessible at dashboard-body level**, outside any gate (used at line 496-499 for `getBreakReentryLine`, line 3634 for `buildInFlowSummary`) — this is the concrete candidate for S-28 phase 2's deferred unknown "energy-state tint on scrim."
- `showSessionEnergy`/`showSessionFocus` (hook return, line 3686-3687: `sessionEnergyPending && kickoffEligible` / `sessionFocusPending && kickoffEligible`) drive whether the pre-session `SessionEnergyCard`/`SessionFocusCard` (`src/app/_components/session-steering-card.tsx`) is currently open — this is what feeds `HomeSessionState: "steering"`. Per `transition-conductor.ts:5` comment: **"Session steering (energy + focus) is inline — not a conductor gate."** This is important: `steering`/`energy_choice` is *not* one of the F-07/S-39 blocking gates and is therefore safe territory for illustration binding, unlike the four true conductor gates.

### Wedge gates — confirmed do-not-touch boundary (F-07 + S-39)

- Conductor: `src/lib/wedge/transition-conductor.ts` — `resolveWedgeBeat()`, `GATE_PRIORITY = ["session_closure", "wind_down", "check_in", "cycle_complete"]` (lines 53-58, highest priority first). Consumed/wired in `pomodoro-dashboard.tsx`.
- Gate overlay components (flat in `src/app/_components/`, no `overlays/` subfolder):
  - `check-in-overlay.tsx` (+ `.test.tsx`)
  - `cycle-complete-overlay.tsx` (+ `.test.tsx`)
  - `wind-down-overlay.tsx` (+ `.test.tsx`)
  - `session-closure-overlay.tsx` (+ `.test.tsx`)
  - `task-suggestion-card.tsx` (inline, suggestion accept/override gate; + `.test.tsx`)
  - `kickoff-duration-chips.tsx` (inline, kickoff/intention-readiness gate; + `.test.tsx`)
  - Shared primitive: `overlay-shell.tsx` (`OverlayScrim`, `OverlayCard`; + `.test.tsx`)
- Grep across all of the above for `Garden`/`Illustration` imports: **zero matches**. Repo-wide, illustration imports exist in exactly 3 `src/app/_components/*` files: `pomodoro-dashboard.tsx` (hero/rail, in scope), `pomodoro-dashboard.test.tsx`, and `empty-active-tasks-guide.tsx` (+ test) for the unrelated `EmptyGardenBed` empty state.
- S-39's own archived plan (`context/archive/2026-06-26-accessible-wedge-gates/plan.md:33`) explicitly states: **"No visual redesign or Calm Garden rebrand work"** was out of scope — confirming this was deliberately deferred to S-43, not an oversight.
- S-39.md's gate enumeration (line 17): "cycle complete, intention/readiness, check-in, suggestion accept/override, closure" — matches the 6 files above one-for-one (intention/readiness = `kickoff-duration-chips.tsx`, suggestion accept/override = `task-suggestion-card.tsx`).

### S-34 optimistic transition path (motion must not delay this)

S-34 (`optimistic-wedge-transitions`, roadmap status: done) lives inside `src/hooks/use-pomodoro-cycle.ts`:
- Comment anchor ~line 2647-2648: `// NFR 200ms: authenticated wedge check-in → break/suggestion (S-34); start/interrupt (B-03).`
- `captureWedgeTransitionSnapshot()` / `rollbackOptimisticCheckInTransition(snapshot)` (~lines 2649-2686) implement optimistic-update-then-rollback around `continueAfterCheckIn`.
- Also covers cycle start: `allocateOptimisticCycleId()`, `rollbackOptimisticStart()`, `useOptimisticStart = mode === "authenticated"`.
- **Implication for S-43**: the illustration variant swap (≤200ms crossfade) must be a side-effect that *reacts to* the already-committed `pomodoro.state`/`homeIa.state`, not something that gates or delays the synchronous `setState` calls inside this hook. Concretely: derive the illustration variant in a `useEffect`/`useMemo` downstream of `deriveHomeSessionState()`'s output, never upstream of or interleaved with the optimistic mutation calls.

### Motion / reduced-motion precedent

- `matchMedia("(prefers-reduced-motion: reduce)")` pattern already used in `src/hooks/use-pomodoro-cycle.ts:312-314` (guards `startCycleEndTabPulse`) and in `src/styles/globals.css` (`motion-reduce:` Tailwind variants, e.g. `home-shell.tsx:92` — `transition-colors duration-300 motion-reduce:transition-none`). Directly reusable for S-43's "instant swap under `prefers-reduced-motion`" requirement — no new pattern needs inventing.

### Test coverage baseline

- **Unit (Vitest)**: only `src/lib/design/illustrations/empty-garden-bed.test.tsx` exists (smoke test — render + `getByTestId`). No test file for `HomeHeroSprig`, `CalmGardenBlob`, or `CalmGardenSprig`. `home-session-state.test.ts` is the strongest nearby precedent (21 cases).
- **E2E (Playwright)**: zero specs assert on the illustration, `home-hero-sprig`, or `home-rail-illustration` testids. Only incidental unrelated comments mention "context rail" in `guest-trial.spec.ts:20`, `guest-merge-on-sign-in.spec.ts:27`, `daily-work-timing-recap.spec.ts:70`.
- **E2E conventions to follow** (per `e2e/seed.spec.ts` canonical exemplar and `e2e/fixtures.ts`/`e2e/helpers/*`):
  - `page.getByTestId(...)` / `getByRole` only — no CSS/XPath locators, no `waitForTimeout`.
  - Worker-scoped `storageState` auth pool via `e2e/global-setup.ts`; guest specs run in separate `guest-chromium` project.
  - `e2e/helpers/check-in.ts` exports `completeCheckIn(page, energy, options?)` — the exact helper to reuse for any new spec exercising the `energy_choice` variant transition.
  - `e2e/helpers/idle-cycle.ts` (`ensureIdleCycle`, `dismissKickoffReadinessIfVisible`) for setup/teardown.
  - Two tiers: `pnpm test:e2e:belt` (12 tests, CI gate) vs `pnpm test:e2e` (~27, full catalog) — a new illustration spec likely starts outside the belt (`@skip-belt` or full-catalog-only) unless later promoted.
  - Separate `pnpm test:e2e:a11y` (`@axe-core/playwright`, `e2e/accessibility.spec.ts`) — since S-43 illustrations must be `aria-hidden`, this scan should be unaffected, but worth a explicit assertion that axe still passes after the change.
  - Vitest and Playwright configs are fully isolated (different directories/scripts) — pure variant-mapping logic gets Vitest coverage under `src/lib/design/illustrations/` or `src/lib/home/`; DOM presence/crossfade behavior on hero/rail gets Playwright coverage in `e2e/`.

## Code References

- `src/lib/design/illustrations/index.ts` — barrel export of all 4 illustration components
- `src/lib/design/illustrations/calm-garden-blob.tsx:7-46` — blob primitive, no variant prop
- `src/lib/design/illustrations/calm-garden-sprig.tsx:7-39` — line-art primitive, no variant prop
- `src/lib/design/illustrations/home-hero-sprig.tsx:5-16` — static hero composition, no props
- `src/lib/design/illustrations/empty-garden-bed.tsx` — unrelated empty-state illustration (out of S-43 scope)
- `src/lib/design/illustrations/empty-garden-bed.test.tsx` — only existing illustration test
- `src/app/_components/home-shell.tsx:21,98` — hero render site
- `src/app/_components/pomodoro-dashboard.tsx:807-811` — rail render site, `data-testid="home-rail-illustration"` reserved slot
- `src/app/_components/pomodoro-dashboard.tsx:501-525` — `deriveHomeSessionState()` call site (useMemo)
- `src/app/_components/pomodoro-dashboard.tsx:863-918` — S-41 workbench grid, rail region wrapper (`hidden lg:flex`)
- `src/lib/home/home-session-state.ts:17-22` — `HomeSessionState` union (5 values)
- `src/lib/home/home-session-state.ts:320-327` — `deriveHomeSessionState()` entry point
- `src/lib/home/home-session-state.test.ts` — test template precedent (21 cases)
- `src/lib/design/work-focus-shell.ts` / `.test.ts` — sibling pure-derivation pattern, checks `wedgeGateActive`
- `src/lib/design/break-atmosphere.ts` / `.test.ts` — sibling pure-derivation pattern
- `src/lib/domain/energy-level.ts` — `EnergyLevel = "FOCUSED" | "STEADY" | "FADING"`
- `src/app/_components/energy-selector.tsx:5-7` — UI-cased energy type
- `src/hooks/use-pomodoro-cycle.ts:3681,3686-3688` — `narrativeLatestEnergy`, `showSessionEnergy`, `showSessionFocus` exposed on hook return
- `src/hooks/use-pomodoro-cycle.ts:2647-2686` — S-34 optimistic check-in transition (must not be delayed by illustration motion)
- `src/hooks/use-pomodoro-cycle.ts:312-314` — `prefers-reduced-motion` precedent
- `src/lib/wedge/transition-conductor.ts:1-6,8-13,53-58` — F-07 conductor, `WedgeGate` union, `GATE_PRIORITY`, explicit comment that steering is inline/not a gate
- `src/app/_components/check-in-overlay.tsx`, `cycle-complete-overlay.tsx`, `wind-down-overlay.tsx`, `session-closure-overlay.tsx`, `task-suggestion-card.tsx`, `kickoff-duration-chips.tsx`, `overlay-shell.tsx` — the 7 do-not-touch gate/gate-primitive files
- `e2e/helpers/check-in.ts` — `completeCheckIn(page, energy, options?)` helper
- `e2e/seed.spec.ts` — canonical E2E exemplar

## Architecture Insights

- **State derivation is centralized and pure.** `deriveHomeSessionState()` is a single-source-of-truth pure function already computed at the right component level. S-43 should add a second pure function (e.g. `resolveIllustrationVariant(state: HomeSessionState, energy: EnergyLevel | null, closureActive: boolean): IllustrationVariant`) rather than duplicating state logic inside the illustration components themselves — matches the existing `work-focus-shell.ts`/`break-atmosphere.ts` pattern exactly.
- **Gate suppression is done via `wedgeGateActive`, not via component omission.** The two sibling derivation functions (`shouldShowWorkFocusShell`, `shouldShowBreakAtmosphere`) both take `wedgeGateActive` as an input and return `false` when a gate is up. Because illustrations are never imported into gate files at all, and because the hero/rail illustration slot is structurally outside the gate-render block in `pomodoro-dashboard.tsx`, S-43 does not strictly need a `wedgeGateActive` check to satisfy the "never on gates" requirement — but adding one anyway (to freeze the variant rather than crossfade while a gate is open) may be good defensive practice for the ≤200ms crossfade requirement, since a gate opening mid-transition should not visually compete with the illustration.
- **"Steering" ≠ a conductor gate.** The transition-conductor module has a code comment stating session steering (energy + focus) is deliberately inline, not part of `GATE_PRIORITY`. This means the `energy_choice` variant is bindable to a genuinely non-gate surface, consistent with S-43's constraint.
- **Guest mode has no rail illustration slot today.** `GuestContextRail` (rendered instead of `authenticatedContextRail` when `dataMode !== "authenticated"`) does not include any illustration block. S-43's roadmap doc doesn't explicitly scope guest — the hero illustration in `home-shell.tsx` is unconditional (both guest and authenticated see it), but the rail slot is authenticated-only by existing code structure, not by any illustration-specific decision.
- **Session closure has no `HomeSessionState` value.** Closure/session-end is only reachable via the `session_closure` wedge gate (highest-priority gate in `GATE_PRIORITY`). S-43 wants a `closure` illustration variant on hero/rail — this must be triggered by something other than gate visibility (since illustrations can't watch gate state to render on-gate), most plausibly a short post-closure "afterglow" window on the hero/rail once the gate dismisses and before returning to `idle`, similar to how `showBreakTransitionLine`/`showInFlowSummary` already model brief post-transition copy states in `home-session-state.ts`.

## Historical Context (from prior changes)

- `context/archive/2026-06-23-wellness-illustration-foundation/plan.md` — S-28 phase 1 plan: confirms `home-hero-sprig.tsx` and `empty-active-tasks-guide.tsx` as the exact phase-1 deliverables, and that "Phase 2 overlays deferred" (per `change.md` notes) — i.e., overlay-scrim work explicitly pushed to S-43 Phase A.
- `context/archive/2026-06-26-accessible-wedge-gates/plan.md:33` — S-39 explicitly excluded "visual redesign or Calm Garden rebrand work," confirming the boundary is intentional, not a gap to be "fixed."
- `context/foundation/roadmap-references/items/S-28.md` — records phase 2 unknowns still open: "energy-state tint on overlay scrim (Focused/Steady/Fading) or neutral pastel only?" and "include first-run onboarding overlay in atmosphere scope or overlay/auth only?" — both owner: user, block: no. S-43's own doc narrows Phase B to hero/rail only (not overlay/auth), effectively answering the second one implicitly; the energy-tint question remains genuinely open (see below).
- `context/foundation/roadmap-references/items/S-43.md` — canonical acceptance criteria: Phase A absorbs deferred S-28 phase 2 overlay scrims; Phase B is the state-to-variant map for `idle, energy_choice, work, break, return, closure`; render hero/rail only, never gates; `aria-hidden`; ≤200ms crossfade; instant swap under reduced motion; must not delay S-34.
- `context/foundation/roadmap-references/items/S-40.md`, `S-41.md` — source of the `HomeSessionState` taxonomy and the reserved rail illustration slot respectively; both status `done`.
- `context/foundation/prd.md` — PRD v3's "New capabilities" list includes "[new] Calm Garden illustration system on home accent, atmosphere, and empty states" (Secondary Success Criteria: "Serene Pastel and Calm Garden visuals are cohesive on home, wedge overlay scrims, and auth surfaces") — this is the umbrella product commitment S-28+S-43 jointly deliver; PRD does not itself define state variants (that's S-43-specific, added in expand batch 7, not present in the PRD verbatim).

## Related Research

- `context/archive/2026-06-23-wellness-illustration-foundation/plan-brief.md`, `plan.md`, `reviews/` — S-28 phase 1 implementation record.
- `context/changes/roadmap-ux-ui-story-expand/research.md`, `expand-refinement-summary.md` — S-43's own lineage/source research from the roadmap-expand batch that created this slice.

## Open Questions

1. **Resolved: 6-variant taxonomy maps onto the existing 5-value `HomeSessionState` plus one new derived flag, not a new state enum.** Rationale: `HomeSessionState` (`idle | steering | active_work | break | returning`) is a mature, tested, single-source-of-truth type consumed by module-priority logic; inventing a parallel 6-value enum would create two sources of truth for "what mode is the app in." Map `steering→energy_choice`, `active_work→work`, `returning→return`, `idle→idle`, `break→break` directly. For `closure`, add a short-lived derived boolean (e.g. `recentlyClosedSession`, mirroring the pattern of `showBreakTransitionLine`/`showInFlowSummary` — brief post-transition flags already in `DeriveHomeSessionStateInput`) that a new `resolveIllustrationVariant()` wrapper checks *before* falling back to `state`, so `closure` is a transient overlay on top of `idle`, not a 6th `HomeSessionState` value threaded through module-priority logic that doesn't need it.

2. **Resolved: energy-state tint (S-28's deferred phase-2 unknown) should be scoped to the `work`/`energy_choice` variants only, using the already-exposed `narrativeLatestEnergy: EnergyLevel | null`.** Rationale: this value is already computed and exposed outside any gate (`use-pomodoro-cycle.ts:3681`), already drives copy elsewhere (`getBreakReentryLine`, `buildInFlowSummary`), and is the only energy signal that exists in the codebase — inventing a new energy-derivation path would duplicate `narrativeLatestEnergy`. Tinting `idle`/`break`/`return`/`closure` by energy is not grounded in any existing requirement or type and should be left neutral/pastel-only to avoid scope creep beyond S-43's stated acceptance criteria.

3. **Resolved: guest mode gets the hero variant treatment (already shared/unconditional) but no rail variant, since no rail illustration slot exists for guests today.** Rationale: `GuestContextRail` structurally has no illustration slot; S-41's guest rail spec (sign-in value prop, activation hint, empty-state guidance) doesn't include one either. Extending guest rail scope is a larger, unscoped UI change S-43's roadmap doc does not ask for — hero-only state-binding for guests keeps blast radius aligned with the slice's stated placement constraint.

4. **Open for `/10x-plan` (not blocking, low-risk):** exact crossfade implementation mechanism (CSS transition/`transition-colors`-style vs a small state machine holding "previous variant" during the ≤200ms window) — existing precedent in `home-shell.tsx:92` (`transition-colors duration-300 motion-reduce:transition-none`) suggests a CSS-only crossfade is idiomatic for this codebase and avoids adding animation library dependencies; recommend the plan default to CSS opacity crossfade with `motion-reduce:transition-none`, matching the established pattern, unless a concrete reason emerges to do otherwise.

5. **Open for `/10x-plan` (not blocking):** whether the 6 variants require genuinely distinct new SVG artwork (new sprig/blob shapes per state) or reuse `CalmGardenBlob`/`CalmGardenSprig` with only color/tint/pose (e.g. CSS transform) differences. The S-43 risk note explicitly warns against "stock sprig-only filler without state meaning," implying some visual differentiation beyond tint is expected, but the concrete art direction is a design decision for the plan/implementation phase, not research.
