# Stateful Illustration System (S-43) Implementation Plan

## Overview

Bind the existing static Calm Garden illustration (`HomeHeroSprig`) to `deriveHomeSessionState()`'s live session state so the home hero and desktop rail show one of six state-driven variants (`idle`, `energy_choice`, `work`, `break`, `return`, `closure`) instead of one hardcoded sprig — while guaranteeing, by construction and by test, that no illustration ever renders on a S-39 wedge gate.

## Current State Analysis

- `HomeHeroSprig` (`src/lib/design/illustrations/home-hero-sprig.tsx:5-16`) takes no props and composes `CalmGardenBlob` + `CalmGardenSprig` (also prop-less beyond `className`/`data-testid`) into one static, `aria-hidden` graphic.
- It renders in exactly two places: the home hero header (`src/app/_components/home-shell.tsx:98`, unconditional for guest + authenticated) and the desktop rail's reserved slot (`src/app/_components/pomodoro-dashboard.tsx:807-811`, `data-testid="home-rail-illustration"`, authenticated-only, `hidden lg:flex` — S-41's slot, never wired to state).
- `deriveHomeSessionState()` (`src/lib/home/home-session-state.ts:320-327`) is already computed once per render via `useMemo` in `PomodoroDashboardBody` (`pomodoro-dashboard.tsx:501-525`) and returns `HomeSessionState = "idle" | "steering" | "active_work" | "break" | "returning"` — a 5-value taxonomy, one short of S-43's 6 target variants.
- `narrativeLatestEnergy: EnergyLevel | null` (`use-pomodoro-cycle.ts:3681`) is already exposed at dashboard-body level, outside any gate.
- Sibling pure-derivation functions `shouldShowWorkFocusShell` (`src/lib/design/work-focus-shell.ts`) and `shouldShowBreakAtmosphere` (`src/lib/design/break-atmosphere.ts`) establish the codebase's pattern for gate-aware derived UI state: pure function, `wedgeGateActive` as an explicit input, co-located `.test.ts`, consumed by a shell component via a `data-*` attribute + CSS tokens (S-31/S-33 "shell wash" precedent, `roadmap.md` Done log lines 220-221).
- Wedge gates (7 files: `check-in-overlay.tsx`, `cycle-complete-overlay.tsx`, `wind-down-overlay.tsx`, `session-closure-overlay.tsx`, `task-suggestion-card.tsx`, `kickoff-duration-chips.tsx`, `overlay-shell.tsx`) have zero illustration imports today; S-39's plan explicitly excluded "Calm Garden rebrand work."
- No test today pins this boundary — it holds by omission, not by assertion.
- `matchMedia("(prefers-reduced-motion: reduce)")` is an established pattern (`use-pomodoro-cycle.ts:312-314`; `motion-reduce:` Tailwind variants, e.g. `home-shell.tsx:92`).

## Desired End State

The home hero and desktop rail illustration render one of six visually distinct Calm Garden variants (tint + pose, same primitives) that update within ≤200ms (crossfade) of `deriveHomeSessionState()` output changing, or instantly under `prefers-reduced-motion`. Session closure briefly shows a `closure` variant on hero/rail *after* the gate dismisses, never during it. No wedge gate file imports or renders the illustration component — enforced by an automated test, not just convention.

### Key Discoveries:

- `deriveHomeSessionState()`'s 5-value `HomeSessionState` plus `narrativeLatestEnergy` plus one new transient "recently closed" flag are sufficient to resolve all 6 variants — no new parallel state enum needed (research.md Open Question 1).
- `steering` is confirmed non-gate ("Session steering (energy + focus) is inline — not a conductor gate," `transition-conductor.ts:5`), so `energy_choice` is safe territory.
- Guest mode: hero gets full variant treatment (already unconditional); rail has no illustration slot for guests today (`GuestContextRail` has none) — out of scope to add one.

## What We're NOT Doing

- Not adding a rail illustration slot to `GuestContextRail` (no such slot exists; S-41 didn't spec one).
- Not tinting `idle`/`break`/`return`/`closure` by energy — only `work`/`energy_choice` per research.md Open Question 2.
- Not commissioning new SVG artwork — variants reuse `CalmGardenBlob`/`CalmGardenSprig` with tint (CSS var swap) and pose (transform/opacity) differences only.
- Not touching any of the 7 wedge gate files or `overlay-shell.tsx` except to add the guardrail test that proves they stay untouched.
- Not implementing Phase A (overlay scrims) as new scope beyond what's needed to keep the hero/rail state-bound — Phase A in the roadmap doc is "absorb deferred S-28 phase 2 overlay scrims"; this plan scopes strictly to the hero/rail Phase B acceptance criteria plus the minimum scrim absorption already implied by "state-bound Calm Garden on hero/rail," per S-43's own unknown #1 ("Phase A scrim scope vs hero/rail-only Phase B — owner: implementer. Block: no") — resolved here as hero/rail-only, since roadmap Acceptance lists rendering constraints exclusively in hero/rail terms and Phase A's overlay scrims are not gate controls but are also not named as a hero/rail-adjacent surface anywhere in code; expanding beyond hero/rail is deferred to avoid scope creep on an already six-variant slice.
- Not adding Framer Motion or any animation dependency — CSS-only crossfade, matching `home-shell.tsx:92`'s existing `transition-colors duration-300 motion-reduce:transition-none` idiom.

## Implementation Approach

Add one new pure derivation module (`src/lib/design/illustration-variant.ts`) that maps `HomeSessionState` + `narrativeLatestEnergy` + a new `recentlyClosedSession` boolean to an `IllustrationVariant` union (`"idle" | "energy_choice" | "work" | "break" | "return" | "closure"`), mirroring `work-focus-shell.ts`/`break-atmosphere.ts` exactly (pure function, `wedgeGateActive`-aware, co-located Vitest test). Parameterize `HomeHeroSprig` with a `variant: IllustrationVariant` prop; extend `CalmGardenBlob`/`CalmGardenSprig` with tint/pose props keyed by variant rather than new components. Apply the S-31/S-33 "shell wash" convention: variant maps to a `data-illustration-variant` attribute plus CSS custom-property tokens, transitioned via `transition-colors`/`transition-opacity` + `motion-reduce:transition-none` — zero new dependencies, one idiom reused three times in this codebase already. Wire both render sites (`home-shell.tsx`, `pomodoro-dashboard.tsx`) to pass the derived variant down from a single shared owner. **Confirmed during plan review**: `HomeShellContent` (`home-shell.tsx:65-116`) renders `<HomeHeroSprig />` directly at line 98 and renders `<PomodoroDashboard />` (which wraps `PomodoroDashboardBody`) as a **sibling** at line 111 — they are not in a parent/child relationship, so `PomodoroDashboardBody` cannot own the single derivation and hand it to the hero via props (a child cannot pass data up/across to a sibling). The actual shared ancestor is `HomeShellContent` itself. Phase 2 therefore computes `resolveIllustrationVariant()` in `HomeShellContent`: lift the same session-state inputs (`deriveHomeSessionState()`'s inputs, `narrativeLatestEnergy`, `recentlyClosedSession`) up via a shared hook/context (e.g. a small `useHomeIllustrationVariant()` hook colocated with `illustration-variant.ts`, called once in `HomeShellContent`, or exposing the already-computed value from `usePomodoroCycle()`/equivalent state that `HomeShellContent` can also read) and pass the resolved variant down as a prop to `HomeHeroSprig` (line 98) and as a new prop into `PomodoroDashboard` → `PomodoroDashboardBody` → the rail's `HomeHeroSprig` (lines 807-811), rather than having `PomodoroDashboardBody` compute it independently. This preserves "one derivation, two consumers" but moves the owner to the actual common ancestor. Lock the "never on gates" boundary with a new guardrail test that statically asserts none of the 7 gate files import from `src/lib/design/illustrations/`.

## Critical Implementation Details

**Timing & lifecycle**: The `closure` variant must derive from a state that exists *after* the `session_closure` gate dismisses, not from gate visibility itself (illustrations must never watch gate state directly to decide to render, since that would make them state-coupled to gate lifecycle rather than session lifecycle). Follow the existing `showBreakTransitionLine`/`showInFlowSummary` pattern in `DeriveHomeSessionStateInput` — a short-lived boolean set on gate dismissal and cleared after a timeout/next state change — for the new `recentlyClosedSession` input, so `closure` is a transient overlay resolved by `resolveIllustrationVariant()` before falling back to `state`, never a 6th `HomeSessionState` value threaded through module-priority logic.

**State sequencing**: The variant derivation must run downstream of the already-committed `pomodoro.state`/`homeIa.state` (per S-34 optimistic-transition constraint) — compute it in the same `useMemo`/render pass as `deriveHomeSessionState()`, never inside `use-pomodoro-cycle.ts`'s optimistic mutation path. This guarantees illustration crossfade never gates or delays the ≤200ms optimistic check-in/start transitions.

## Phase 1: Pure illustration-variant derivation (domain logic)

### Overview

Add `resolveIllustrationVariant()` as a pure, framework-free function mapping session state + energy + closure-recency to one of 6 `IllustrationVariant` values, plus the `recentlyClosedSession` input threaded through `DeriveHomeSessionStateInput`. No React, no UI components — this phase must not import anything from `src/app/_components/` or `src/lib/design/illustrations/`.

### Changes Required:

#### 1. Illustration variant type + resolver

**File**: `src/lib/design/illustration-variant.ts` (new)

**Intent**: Define `IllustrationVariant` union and `resolveIllustrationVariant(input)` pure function mapping `HomeSessionState`, `narrativeLatestEnergy: EnergyLevel | null`, `recentlyClosedSession: boolean`, and `wedgeGateActive: boolean` to a variant, following the exact shape of `shouldShowWorkFocusShell`/`shouldShowBreakAtmosphere`.

**Contract**: `resolveIllustrationVariant(input: ResolveIllustrationVariantInput): IllustrationVariant`. Resolution order: if `recentlyClosedSession` → `"closure"`; else map `state` (`steering→energy_choice`, `active_work→work`, `returning→return`, `break→break`, `idle→idle`). `wedgeGateActive` is accepted as an input and, when true, freezes/does not newly resolve `closure` (defensive practice per research.md Architecture Insights, since gate opening mid-transition should not compete visually) — document this as a 1-line comment, not new branching logic, since illustrations are structurally outside gate render trees already.

#### 2. `recentlyClosedSession` input threading

**File**: `src/lib/home/home-session-state.ts`

**Intent**: Add `recentlyClosedSession: boolean` to `DeriveHomeSessionStateInput` so the dashboard body can compute it once alongside the rest of session state, mirroring the existing `showBreakTransitionLine`/`showInFlowSummary` transient-flag pattern. This field is passed through, not consumed by `resolveSessionState`/module-priority logic (those stay 5-value) — it only feeds `resolveIllustrationVariant()` downstream.

**Contract**: New optional-with-default field on the existing input type; `HomeSessionState` union itself stays unchanged at 5 values (per research.md Open Question 1 resolution).

### Success Criteria:

#### Automated Verification:

- [ ] Unit tests pass: `pnpm vitest run src/lib/design/illustration-variant.test.ts`
- [ ] Unit tests pass: `pnpm vitest run src/lib/home/home-session-state.test.ts`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`

#### Manual Verification:

- [ ] None — this phase is pure logic with no UI surface; covered entirely by automated tests.

**Routing**: tdd (pure state-derivation logic, no UI).

**BDD acceptance** (maps to roadmap Outcome "state-bound Calm Garden... six variants bound to home session state"):
- Given `deriveHomeSessionState()` returns `"steering"`, when `resolveIllustrationVariant()` is called with that state, then it returns `"energy_choice"`.
- Given `recentlyClosedSession` is `true`, when `resolveIllustrationVariant()` is called regardless of `state`, then it returns `"closure"`.
- Given `state` is `"active_work"` and `narrativeLatestEnergy` is `"FOCUSED"`, when resolved, then the variant carries an energy tint marker scoped only to `work`/`energy_choice` variants (not `idle`/`break`/`return`/`closure`).

---

## Phase 2: Component wiring — variant-aware illustration primitives

### Overview

Parameterize `CalmGardenBlob`, `CalmGardenSprig`, and `HomeHeroSprig` with a `variant: IllustrationVariant` prop (tint/pose only, same viewBox/markup shape); wire both render sites (`home-shell.tsx`, `pomodoro-dashboard.tsx`) to pass the variant computed once in `PomodoroDashboardBody` via the Phase 1 resolver. Apply the S-31/S-33 shell-wash convention (`data-illustration-variant` attribute + CSS custom-property tokens + `transition-colors`/`transition-opacity` + `motion-reduce:transition-none`) for the crossfade.

### Changes Required:

#### 1. Variant-aware SVG primitives

**File**: `src/lib/design/illustrations/calm-garden-blob.tsx`, `src/lib/design/illustrations/calm-garden-sprig.tsx`

**Intent**: Accept a `variant: IllustrationVariant` prop; map variant to a `data-illustration-variant` attribute on the root SVG element so CSS (new tokens) can drive fill/stroke color per variant without branching JSX per variant. Pose differences (e.g. `work` upright/alert, `break` softened/lower opacity, `return` mid-transition tilt) via a small variant→className lookup, not new SVG paths.

**Contract**: `CalmGardenBlob({ variant, className?, "data-testid"? })`, `CalmGardenSprig({ variant, className?, "data-testid"? })` — `variant` required (no default), preserving `aria-hidden` behavior unchanged.

#### 2. `HomeHeroSprig` variant prop + crossfade

**File**: `src/lib/design/illustrations/home-hero-sprig.tsx`

**Intent**: Accept `variant: IllustrationVariant`, forward to both primitives, add the crossfade transition classes (`transition-colors transition-opacity duration-200 motion-reduce:transition-none`, ≤200ms per acceptance criteria) on the wrapping `div`.

**Contract**: `HomeHeroSprig({ variant: IllustrationVariant })` — breaking change to the existing zero-prop signature; both call sites updated in this same phase.

#### 3. CSS variant tokens

**File**: `src/styles/globals.css`

**Intent**: Add `[data-illustration-variant="..."]` token rules (fill/stroke CSS custom properties per variant), following the existing `--color-surface-break`/`--color-energy-steady-bg`/`--color-accent-break` token convention already used inside `calm-garden-blob.tsx`/`calm-garden-sprig.tsx`.

**Contract**: One rule block per of the 6 variants; no new token *names* invented beyond what's needed — reuse existing `--color-*` tokens where the variant's intended mood already has one (e.g. `break` reuses `--color-surface-break`).

#### 4. Wire `HomeShellContent` as single derivation owner, thread variant into `PomodoroDashboardBody`

**Files**: `src/app/_components/home-shell.tsx`, `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: **Verified render tree (plan review)**: `HomeShellContent` renders `<HomeHeroSprig />` (hero, line 98) and `<PomodoroDashboard />` (line 111, wraps `PomodoroDashboardBody`, rail illustration at lines 807-811) as siblings — `PomodoroDashboardBody` is not an ancestor of the hero and cannot be the sole owner as originally drafted. Instead: compute `resolveIllustrationVariant()` in `HomeShellContent` (or a hook it calls, e.g. `useHomeIllustrationVariant()`, colocated with `illustration-variant.ts`), sourcing the same session-state inputs currently available inside `PomodoroDashboardBody`'s `useMemo` (~line 501-525) — `narrativeLatestEnergy` and `recentlyClosedSession` need to be readable at `HomeShellContent`'s level too (via the same hook `usePomodoroCycle()`/onboarding/data-mode providers `HomeShellContent` already has access to, or lifted further if not). Pass the resolved variant as a prop into `HomeHeroSprig` at line 98 directly, and as a new prop through `PomodoroDashboard` → `PomodoroDashboardBody` → the rail's `HomeHeroSprig` (lines 807-811) instead of having `PomodoroDashboardBody` recompute it.

**Contract**: One `useMemo`/hook-wrapped variant value computed in `HomeShellContent` (the true common ancestor), consumed by both hero and rail sites via props — never two independent `resolveIllustrationVariant()` calls with potentially divergent inputs. If threading `narrativeLatestEnergy`/`recentlyClosedSession` up to `HomeShellContent` proves awkward (e.g. they currently only exist inside `usePomodoroCycle()` called within `PomodoroDashboardBody`'s tree), the implementer should surface them via the same provider/hook layer `HomeShellContent` already consumes (`DataModeProvider`, `OnboardingProvider`) rather than reaching down into a sibling's internals.

#### 5. `recentlyClosedSession` flag source

**File**: `src/hooks/use-pomodoro-cycle.ts` (or `pomodoro-dashboard.tsx` local state, per implementer's discretion during Phase 2 — both are valid per the `showBreakTransitionLine`-style precedent which lives as hook-exposed state)

**Intent**: Set `recentlyClosedSession = true` when the `session_closure` gate transitions from visible to dismissed; clear it on next `deriveHomeSessionState()`-relevant state change (mirroring `showInFlowSummary`'s clear-on-next-transition behavior) so `closure` is genuinely transient, not sticky.

**Contract**: Boolean, gate-dismissal-triggered, self-clearing — no new persisted/server state.

### Success Criteria:

#### Automated Verification:

- [ ] Unit tests pass: `pnpm vitest run src/lib/design/illustrations/`
- [ ] Unit tests pass: `pnpm vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- [ ] Type checking passes: `pnpm typecheck`
- [ ] Linting passes: `pnpm lint`
- [ ] Build succeeds: `pnpm build`

#### Manual Verification:

- [ ] Hero and rail illustration visibly change tint/pose when moving through idle → energy_choice → work → break → return → closure in a live authenticated session.
- [ ] Crossfade feels smooth (~200ms) with motion enabled; swap is instant with `prefers-reduced-motion: reduce` emulated in devtools.

**Routing**: implement (component wiring — React props, hook integration, CSS tokens; not pure logic, not browser-automation-verifiable at unit level).

**BDD acceptance** (maps to roadmap Outcome "state-bound Calm Garden on hero/rail"; PRD Secondary Success Criteria "Serene Pastel and Calm Garden visuals are cohesive on home... surfaces"):
- Given a user is in an authenticated idle session, when they start a work cycle, then the hero and rail illustration crossfade from the `idle` tint/pose to the `work` tint/pose within 200ms.
- Given `prefers-reduced-motion: reduce` is set, when the session state changes, then the illustration swaps instantly with no transition animation.
- Given a user dismisses the session closure gate, when the gate closes, then the hero/rail illustration briefly shows the `closure` variant before settling back to `idle`.

---

## Phase 3: Guardrail — illustrations never render on wedge gates

### Overview

Lock the "not on gates" boundary (roadmap.md S-43 row, S-39's explicit exclusion) with an automated test that fails the build if any wedge gate file starts importing/rendering the illustration component — turning today's accidental-by-omission boundary into an enforced one.

### Changes Required:

#### 1. Gate-illustration exclusion guardrail test

**File**: `src/lib/design/illustrations/no-illustrations-on-gates.test.ts` (new)

**Intent**: Statically assert that none of the 7 wedge gate/gate-primitive files (`check-in-overlay.tsx`, `cycle-complete-overlay.tsx`, `wind-down-overlay.tsx`, `session-closure-overlay.tsx`, `task-suggestion-card.tsx`, `kickoff-duration-chips.tsx`, `overlay-shell.tsx`, all under `src/app/_components/`) contain an import from `~/lib/design/illustrations` (barrel) or any of its individual module paths. Read each file's source text and regex/string-match for the illustration import path — no need to execute or render the components.

**Contract**: One test file, one `describe.each`/loop over the 7 known gate file paths, asserting `readFileSync(path).includes("design/illustrations")` is `false` for each. Fails loudly (naming the offending file) if the boundary is ever crossed.

### Success Criteria:

#### Automated Verification:

- [ ] New guardrail test passes: `pnpm vitest run src/lib/design/illustrations/no-illustrations-on-gates.test.ts`
- [ ] Full unit suite passes: `pnpm vitest run`
- [ ] Type checking passes: `pnpm typecheck`

#### Manual Verification:

- [ ] None — this is a static-analysis guardrail, fully automated by design.

**Routing**: tdd (new automated test asserting an invariant; no new UI or user-facing behavior).

**BDD acceptance** (maps directly to roadmap Acceptance line "Render on home hero and desktop rail only — never on S-39 gate controls"):
- Given the 7 wedge gate/gate-primitive source files, when scanned for illustration imports, then zero matches are found and the test passes.
- Given a future change accidentally imports `HomeHeroSprig` (or any illustration primitive) into any gate file, when the guardrail test runs, then it fails with a message naming the offending file.

---

## Phase 4: E2E verification — state-bound illustration on hero/rail, absent from gates

### Overview

Browser-level verification that the illustration variant actually changes as a user moves through real session states, that it's `aria-hidden` (not exposed to assistive tech, text/status remains canonical per acceptance criteria), and that axe accessibility scans remain clean.

### Changes Required:

#### 1. Illustration state-binding E2E spec

**File**: `e2e/stateful-illustration.spec.ts` (new)

**Intent**: Using existing helpers (`e2e/helpers/check-in.ts`'s `completeCheckIn`, `e2e/helpers/idle-cycle.ts`'s `ensureIdleCycle`) and `page.getByTestId("home-hero-sprig")` / `page.getByTestId("home-rail-illustration")`, assert the illustration's `data-illustration-variant` attribute changes value across idle → energy_choice → work → break transitions in an authenticated session, and that it stays `aria-hidden="true"` throughout.

**Contract**: New spec file following `e2e/seed.spec.ts` conventions (`getByTestId`/`getByRole` only, worker-scoped `storageState`, no `waitForTimeout`). Not added to the CI belt (`pnpm test:e2e:belt`) initially — runs in the full catalog (`pnpm test:e2e`) per research.md's E2E-conventions note, unless later promoted.

#### 2. Accessibility regression check

**File**: `e2e/accessibility.spec.ts` (existing — extend or confirm coverage)

**Intent**: Confirm the existing axe-core scan (`pnpm test:e2e:a11y`) still passes with variant-aware illustrations in place — no new violations introduced by the `data-illustration-variant` attribute or CSS token changes.

**Contract**: No structural change expected; this is a verification run, not new assertions, unless axe surfaces a genuine finding.

### Success Criteria:

#### Automated Verification:

- [ ] New E2E spec passes: `pnpm exec playwright test e2e/stateful-illustration.spec.ts`
- [ ] Accessibility scan passes: `pnpm test:e2e:a11y`
- [ ] Full belt suite still passes (no regression from wiring changes): `pnpm test:e2e:belt`

#### Manual Verification:

- [ ] Visually confirm on a real authenticated run: hero/rail illustration is present, state-bound, and never appears mid-gate (check-in, cycle-complete, wind-down, session-closure overlays all show zero illustration).

**Routing**: e2e (browser-level state-transition and accessibility verification; feature is fully built by end of Phase 2).

**BDD acceptance** (maps to roadmap Outcome + "Illustrations aria-hidden; text/status canonical"):
- Given an authenticated user starts a work cycle, when the illustration is inspected via `getByTestId`, then its `data-illustration-variant` attribute equals `"work"` and it remains `aria-hidden="true"`.
- Given the check-in gate is open, when the page is scanned for the illustration testid, then it is not rendered inside the gate's DOM subtree (only in hero/rail, structurally outside the gate).
- Given axe-core scans the home page across variant states, when the scan completes, then no new accessibility violations are reported.

---

## Testing Strategy

### Unit Tests:

- `resolveIllustrationVariant()`: all 6 variant outcomes, energy-tint scoping to `work`/`energy_choice` only, `recentlyClosedSession` precedence over `state`.
- `deriveHomeSessionState()` regression: existing 21 cases still pass unchanged (5-value `HomeSessionState` untouched).
- Guardrail: 7-file static-import-scan test (Phase 3).
- Component smoke tests for `HomeHeroSprig`/`CalmGardenBlob`/`CalmGardenSprig` with `variant` prop required (extends the currently-thin coverage noted in research.md).

### Integration Tests:

- `pomodoro-dashboard.test.tsx`: variant prop flows from `deriveHomeSessionState()` + `narrativeLatestEnergy` + `recentlyClosedSession` into the rail's `HomeHeroSprig` call.

### Manual Testing Steps:

1. Log in, observe hero/rail illustration at idle.
2. Trigger session steering (energy/focus card) — confirm `energy_choice` variant.
3. Start a work cycle — confirm `work` variant, energy-tinted if `narrativeLatestEnergy` is set.
4. Transition to break — confirm `break` variant, no energy tint.
5. Return to an idle cycle with a continuable task — confirm `return` variant.
6. Complete session closure gate — confirm brief `closure` variant on dismissal, settling to `idle`.
7. Step through all 4 true wedge gates (check-in, cycle-complete, wind-down, session-closure) — confirm zero illustration presence in each gate's visible surface.
8. Toggle OS/browser `prefers-reduced-motion` — confirm instant swap, no crossfade animation.

## Performance Considerations

Crossfade is CSS-only (`transition-colors`/`transition-opacity`, ≤200ms), computed downstream of committed state per the S-34 constraint — no risk of delaying the optimistic check-in/start transitions since the illustration derivation is a separate `useMemo` read, not part of the mutation path.

## Migration Notes

Not applicable — no persisted data model changes; `recentlyClosedSession` is ephemeral client state, not stored server-side.

## References

- Research: `context/changes/stateful-illustration-system/research.md`
- State derivation precedent: `src/lib/design/work-focus-shell.ts`, `src/lib/design/break-atmosphere.ts`
- Shell-wash CSS precedent: `src/app/_components/home-shell.tsx:92`; roadmap.md Done log S-31/S-33 (lines 220-221)
- Render sites: `src/app/_components/home-shell.tsx:98`, `src/app/_components/pomodoro-dashboard.tsx:807-811`
- Session state source: `src/lib/home/home-session-state.ts:320-327`
- Wedge gate do-not-touch list: `src/app/_components/{check-in-overlay,cycle-complete-overlay,wind-down-overlay,session-closure-overlay,task-suggestion-card,kickoff-duration-chips,overlay-shell}.tsx`
- Roadmap detail: `context/foundation/roadmap-references/items/S-43.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Pure illustration-variant derivation (domain logic)

#### Automated

- [x] 1.1 Unit tests pass: `pnpm vitest run src/lib/design/illustration-variant.test.ts` — 6bddea1
- [x] 1.2 Unit tests pass: `pnpm vitest run src/lib/home/home-session-state.test.ts` — 6bddea1
- [x] 1.3 Type checking passes: `pnpm typecheck` — 6bddea1
- [x] 1.4 Linting passes: `pnpm lint` — 6bddea1

### Phase 2: Component wiring — variant-aware illustration primitives

#### Automated

- [x] 2.1 Unit tests pass: `pnpm vitest run src/lib/design/illustrations/` — 989663f
- [x] 2.2 Unit tests pass: `pnpm vitest run src/app/_components/pomodoro-dashboard.test.tsx` — 989663f
- [x] 2.3 Type checking passes: `pnpm typecheck` — 989663f
- [x] 2.4 Linting passes: `pnpm lint` — 989663f
- [x] 2.5 Build succeeds: `pnpm build` — 989663f

#### Manual

- [x] 2.6 Hero and rail illustration visibly change tint/pose across idle → energy_choice → work → break → return → closure in a live authenticated session
- [ ] 2.7 Crossfade feels smooth (~200ms) with motion enabled; instant swap with `prefers-reduced-motion: reduce`

### Phase 3: Guardrail — illustrations never render on wedge gates

#### Automated

- [x] 3.1 New guardrail test passes: `pnpm vitest run src/lib/design/illustrations/no-illustrations-on-gates.test.ts` — bffdacb
- [x] 3.2 Full unit suite passes: `pnpm vitest run` — bffdacb
- [x] 3.3 Type checking passes: `pnpm typecheck` — bffdacb

### Phase 4: E2E verification — state-bound illustration on hero/rail, absent from gates

#### Automated

- [x] 4.1 New E2E spec passes: `pnpm exec playwright test e2e/stateful-illustration.spec.ts`
- [x] 4.2 Accessibility scan passes: `pnpm test:e2e:a11y`
- [x] 4.3 Full belt suite still passes: `pnpm test:e2e:belt`

#### Manual

- [ ] 4.4 Visually confirm on a real authenticated run: illustration present, state-bound, never mid-gate
