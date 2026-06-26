# Stabilize E2E Belt Timer Flakiness — Implementation Plan

## Overview

Belt E2E specs that start **1-second work cycles** flake locally at 4 workers because `clickStartCycle` lets the client timer count on **real wall clock** until `advanceClockThroughFastWork` installs Playwright fake timers. Under `next dev --turbo` load, the cycle completes before assertions see `timer-panel-running`. This plan adds `ensureFakeClock` at the single UI-start choke point (`clickStartCycle`) and documents the contract — no product code changes.

## Current State Analysis

- E2E mode (`NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`) computes cycle expiry as `Date.now() + configuredDurationSec * 1000` in `src/hooks/use-pomodoro-cycle.ts` — Playwright controls `Date.now()` only after `page.clock.install()`.
- `e2e/helpers/work-cycle.ts` installs fake clock in `advanceClockThroughFastWork` / `advanceClockThroughFastBreak` (lines 190–212), **after** `clickStartCycle` has already started the cycle.
- Belt specs using Pattern A (inline `setWorkDurationSec(1)` → `clickStartCycle`) and Pattern B (`startFocusedWorkCycle(..., 1)`) share this race. Pattern C (API seed in `mindful-session-wind-down`) is unaffected.
- `ensureFakeClock` is idempotent per page (`WeakSet` guard, lines 22–36). Many specs already call `resetFakeClock` in `beforeEach`; adding clock install to `clickStartCycle` is safe for 30s/60s cycles too.
- CI on GHA (`next start`, 4 workers) stays green; failure reproduces with `set CI=true && pnpm test:e2e:belt` locally at default 4 workers on `next dev --turbo`. `E2E_WORKERS=1` passes (21/21).

### Key Discoveries:

- `clickStartCycle` (lines 110–117) is the choke point for all UI cycle starts — `startFocusedWorkCycle`, `e2e/helpers/wind-down.ts:startWorkCycleForMidCycleSwitches`, and inline spec calls all route through it.
- `configureFastPomodoroDurations` documents pairing with `ensureFakeClock` (line 45) but does not enforce it; it is unused in specs.
- `mindful-session-wind-down.spec.ts:startFastWorkCycle` has the same race but is `@skip-belt`; fixing `clickStartCycle` covers it for full-catalog runs without per-spec edits.

## Desired End State

- `clickStartCycle` guarantees Playwright fake timers are active **before** the Start Cycle click, so 1s E2E work cycles cannot expire on wall clock during helper/setup latency.
- `set CI=true && pnpm test:e2e:belt` passes **21/21** at **4 workers** on local `next dev --turbo` without `E2E_WORKERS=1` workaround.
- `e2e/README.md` documents the fake-clock-before-start contract for future spec authors.
- No changes to product timer logic, `FAST_WORK_CLOCK_MS`, or belt inventory.

## What We're NOT Doing

- Changing `cycleEndTimeMs` / `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` product semantics.
- Adding `resetFakeClock` to specs that lack it (helper fix is sufficient; idempotent with existing `beforeEach` calls).
- Updating `test-plan.md` §6.3 cookbook (README helpers note is enough for this narrow contract).
- Per-spec `ensureFakeClock` calls scattered outside the helper.
- Requiring full e2e catalog (`pnpm test:e2e`) as merge gate for this PR.

## Implementation Approach

Install fake clock at the **earliest shared UI-start boundary**: the first line of `clickStartCycle`, before dismiss overlays and the Start Cycle click. This centralizes the contract established in `fix-e2e-suggestion-ci` (`ensureFakeClock` once per page, `forgetFakeClock` on reload) and fixes all Pattern A/B belt specs in one diff. Add a brief JSDoc on `clickStartCycle` referencing `e2e-belt-timer-flakiness` so future bypasses are visible in code review.

## Critical Implementation Details

`ensureFakeClock` must run **before** `dismissFirstRunIfVisible` and the Start Cycle click — any delay after install but before click still uses fake `Date.now()` for the subsequent `cycle.create` handler. Do not call `page.clock.install()` again in specs that already ran `resetFakeClock` in `beforeEach`; the `WeakSet` guard makes the extra call a no-op.

## Phase 1: Helper choke-point fix

### Overview

Enforce fake clock installation inside `clickStartCycle` so every UI cycle start is deterministic under E2E client timer mode.

### Changes Required:

#### 1. `clickStartCycle` — install fake clock before start

**File**: `e2e/helpers/work-cycle.ts`

**Intent**: Guarantee Playwright controls `Date.now()` before any work cycle timer begins counting, closing the wall-clock race for 1s belt specs and all other callers of `clickStartCycle`.

**Contract**: At the start of `clickStartCycle(page)`, `await ensureFakeClock(page)` runs before `dismissFirstRunIfVisible`. Add a one-line JSDoc noting that E2E client timer mode requires fake clock before Start Cycle (`e2e-belt-timer-flakiness`). No signature change; `ensureFakeClock` remains exported for `advanceClockThroughFast*` and API-seed flows.

#### 2. `configureFastPomodoroDurations` comment alignment

**File**: `e2e/helpers/work-cycle.ts`

**Intent**: Keep helper documentation consistent now that `clickStartCycle` enforces the clock — callers no longer need a separate pre-start install for UI starts.

**Contract**: Update the line-45 JSDoc from “pair with ensureFakeClock + advanceClockThroughFast*” to state that `clickStartCycle` / `startFocusedWorkCycle` install the clock automatically; `advanceClockThroughFast*` still required for time advance.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes (no unit changes expected; confirms no import/syntax regressions)

#### Manual Verification:

- Reproduce pre-fix failure is not required if belt passes; optional spot-check: one Pattern A spec (`task-suggestion`) and one Pattern B spec (`pomodoro-cycle`) at 4 workers

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Documentation and belt verification

### Overview

Document the helper contract for spec authors and verify the belt merge gate at 4 workers on local dev server.

### Changes Required:

#### 1. `e2e/README.md` — fake-clock-before-start note

**File**: `e2e/README.md`

**Intent**: Prevent future specs from bypassing `clickStartCycle` for fast cycles or reintroducing the race by calling Start Cycle directly.

**Contract**: In the **Notes** section (near the existing `page.clock` bullet, ~line 127), add one bullet: UI cycle starts via `clickStartCycle` / `startFocusedWorkCycle` install Playwright fake timers before Start Cycle; for API-seeded RUNNING cycles, call `ensureFakeClock` before `advanceClockThroughFast*` (see `mindful-session-wind-down` / `seed-scenario`). Do not start sub-second work cycles without going through these helpers.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e:belt` — 21/21 at default 4 workers on Playwright-managed `next dev --turbo`
- `set E2E_WORKERS=4 && set CI=true && pnpm test:e2e:belt` — explicit 4-worker confirmation (redundant with default but documents intent)

#### Manual Verification:

- Belt list reporter shows no `timer-panel-running` vs `cycle-complete-overlay` mismatches on flaky specs (`task-suggestion`, `daily-work-timing-recap`, `daily-standing-capacity`, `pomodoro-cycle`, `seed` R7, `session-return-handoff`)
- Optional sanity: `set E2E_PRODUCTION_SERVER=1 && set CI=true && pnpm test:e2e:belt` if local prod build is already warm — not required for PR merge (CI already uses `next start`)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before closing the change.

---

## Testing Strategy

### Unit Tests:

- None required — E2E helper-only change with no production code touched.

### Integration Tests:

- None required.

### Manual Testing Steps:

1. On `main` (or branch without fix), optionally confirm flake: `set CI=true && pnpm test:e2e:belt` at 4 workers may show `cycle-complete-overlay` instead of `timer-panel-running` on fast-work specs.
2. After Phase 1, run belt once at 4 workers — expect 21/21.
3. After Phase 2 docs land, re-run belt to confirm no regressions.

## Performance Considerations

`page.clock.install()` once per page per test phase is already the established pattern (`resetFakeClock` in several `beforeEach` hooks). Moving install earlier adds negligible overhead; idempotent guard prevents double-install cost on subsequent `clickStartCycle` calls within the same test.

## Migration Notes

No data migration. No env var changes. CI workflow unchanged — this aligns local dev behavior with the determinism CI already enjoys via faster `next start`.

## References

- Related research: `context/changes/e2e-belt-timer-flakiness/research.md`
- Prior fake-clock work: `context/archive/2026-06-09-fix-e2e-suggestion-ci/`
- Belt cookbook: `context/foundation/test-plan.md` §6.3
- Helper: `e2e/helpers/work-cycle.ts:110-117` (`clickStartCycle`)
- E2E timer: `src/hooks/use-pomodoro-cycle.ts:136-151`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Helper choke-point fix

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm test` passes

#### Manual

- [ ] 1.4 Optional spot-check: Pattern A/B specs at 4 workers after helper change

### Phase 2: Documentation and belt verification

#### Automated

- [ ] 2.1 `set CI=true && pnpm test:e2e:belt` — 21/21 at 4 workers (dev server)
- [ ] 2.2 `set E2E_WORKERS=4 && set CI=true && pnpm test:e2e:belt` — explicit 4-worker confirmation

#### Manual

- [ ] 2.3 No `timer-panel-running` vs `cycle-complete-overlay` mismatches on previously flaky belt specs
- [ ] 2.4 Optional: `E2E_PRODUCTION_SERVER=1` belt sanity if prod build available
