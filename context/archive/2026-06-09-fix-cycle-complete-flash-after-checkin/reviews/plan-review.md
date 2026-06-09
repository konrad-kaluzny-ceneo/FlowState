<!-- PLAN-REVIEW-REPORT -->
# Plan Review: Fix Cycle Complete overlay flash after check-in

- **Plan**: `context/changes/fix-cycle-complete-flash-after-checkin/plan.md`
- **Mode**: Deep
- **Date**: 2026-06-09
- **Verdict**: SOUND
- **Findings**: 1 critical (fixed) · 4 warnings (fixed) · 1 observation (noted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| End-State Alignment | PASS |
| Lean Execution | PASS |
| Architectural Fitness | PASS |
| Blind Spots | PASS |
| Plan Completeness | PASS |

## Grounding

Grounding: 5/5 paths ✓, 3/3 symbols ✓, brief↔plan ✓

Verified paths: `src/hooks/use-pomodoro-cycle.ts`, `src/hooks/use-pomodoro-cycle.test.tsx`, `src/app/_components/pomodoro-dashboard.tsx`, `src/app/_components/cycle-complete-overlay.tsx`, `e2e/seed.spec.ts`.

Verified symbols: `continueAfterCheckIn` (`:1275`), `setAwaitingCheckIn(false)` at `submitCheckIn` `:1419`, `deriveCatchUpGate` in `src/lib/catch-up/derive-gate.ts`.

## Codebase verification (riskiest claims)

| Claim | Result | Evidence |
|-------|--------|----------|
| Flash root cause: `awaitingCheckIn` cleared before `state` leaves `"completed"` | Confirmed | `submitCheckIn` clears at `:1419`; `startBreakAfterWorkComplete` sets `"running"` at `:1129` |
| `continueAfterCheckIn` owns async window | Confirmed | `:1275–1309`; called from `submitCheckIn` `:1453` and `onWindDownKeepGoing` `:1593` |
| `confirmComplete` swallows errors (no throw) | Confirmed | `cycles.complete` catch at `:1212–1216` returns void |
| `pendingMarkTaskDone` early clear blocks retry | Confirmed | Cleared at `:1420` before `continueAfterCheckIn`; guard at `:1397` requires non-null |
| Keep-going path has `awaitingCheckIn === false` during transition | Confirmed | Wind-down branch clears check-in before `setAwaitingWindDown(true)` |

Blast radius: `usePomodoroCycle` return object (dashboard only consumer); no other importers of new flag expected.

## Auto-triage log

| ID | Severity | Action |
|----|----------|--------|
| F1 | CRITICAL | **Fixed** — defer `setPendingMarkTaskDone(null)` with `setAwaitingCheckIn(false)`; wind-down branch gets explicit clears |
| F2 | WARNING | **Fixed** — gate clears on observable break start (`stateRef` + break `cycleKind`), not bare `await confirmComplete` |
| F3 | WARNING | **Fixed** — catch-up section points to `setCatchUpFromExpiry` (~293) / `deriveCatchUpGate`; excludes `kickoffEligible` (~807) |
| F4 | WARNING | **Fixed** — `showCycleCompleteCatchUp` guard on `!isPostCheckInTransitioning` marked required for keep-going path |
| F5 | WARNING | **Fixed** — Test D asserts `pendingMarkTaskDone !== null` and second `submitCheckIn` retry |
| F6 | OBSERVATION | **Noted** — `e2e/pomodoro-cycle.spec.ts` exists; plan correctly keeps e2e optional |

## Findings

### F1 — Early `pendingMarkTaskDone` clear breaks check-in retry

- **Severity**: ❌ CRITICAL
- **Impact**: 🔬 HIGH — architectural stakes; think carefully before deciding
- **Dimension**: Blind Spots
- **Location**: Critical Implementation Details / Phase 1
- **Detail**: Plan deferred `setAwaitingCheckIn(false)` but left `setPendingMarkTaskDone(null)` at `submitCheckIn` ~1420. `submitCheckIn` guards on `pendingMarkTaskDone === null` (`:1397`), so a failed `confirmComplete` would show the check-in overlay but reject resubmit.
- **Fix**: Defer both clears into `continueAfterCheckIn` on observable break start; explicit clears in wind-down branch only.
- **Decision**: FIXED

### F2 — `confirmComplete` success must not be inferred from await resolution

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Blind Spots
- **Location**: Phase 1 contract
- **Detail**: `confirmComplete` catches API errors and returns without throwing (`:1212–1216`). Clearing gates after `await confirmComplete` would run even on failure.
- **Fix**: Gate clears on `stateRef.current === "running"` with break `cycleKind`.
- **Decision**: FIXED

### F3 — Catch-up section referenced wrong code path

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 1 §2 Catch-up snapshot
- **Detail**: Plan cited overlay-eligibility helper at ~807, which is `kickoffEligible`, not catch-up derivation.
- **Fix**: Point to `setCatchUpFromExpiry` (~293) and `deriveCatchUpGate`; document keep-going tab-return edge case.
- **Decision**: FIXED

### F4 — `showCycleCompleteCatchUp` guard was conditional

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: End-State Alignment
- **Location**: Phase 2
- **Detail**: On **Keep going**, `awaitingCheckIn` is false during `continueAfterCheckIn`. `showCycleCompleteCatchUp` only gates on `!awaitingCheckIn` (~121–125), so a `WORK_CONFIRM` catch-up banner could flash while the overlay is suppressed.
- **Fix**: Require `!isPostCheckInTransitioning` (and `!awaitingWindDown`) on `showCycleCompleteCatchUp`.
- **Decision**: FIXED

### F5 — Test D omitted retry contract

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Completeness
- **Location**: Phase 3 / Testing Strategy
- **Detail**: Testing Strategy promised error-path retry but Phase 3 Test D only asserted `awaitingCheckIn === true`.
- **Fix**: Assert `pendingMarkTaskDone !== null` and second `submitCheckIn` invokes `completeCycle`.
- **Decision**: FIXED

### F6 — E2E harness already exists

- **Severity**: 💡 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Lean Execution
- **Location**: Phase 3 optional E2E
- **Detail**: `e2e/pomodoro-cycle.spec.ts` and `e2e/mindful-session-wind-down.spec.ts` provide authenticated cycle-end coverage; deferred Vitest is the right primary layer.
- **Fix**: None required — plan already marks e2e optional.
- **Decision**: NOTED

## Triage summary

```
Fixed:     F1, F2, F3, F4, F5  (5)
Noted:     F6                 (1)

► Verdict after fixes: SOUND
```
