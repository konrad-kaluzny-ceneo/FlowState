# Phase 1 Test Rollout — Critical-Path Persistence & Timer Implementation Plan

## Overview

Ship test coverage for test-plan Phase 1 (risks **#1** and **#2**): prove that an active Pomodoro survives page refresh with correct tasks, phase, and user-visible remaining time, and that timer drift stays within ±2s when the tab is backgrounded (via hook-level visibility recalc and tick math — not jsdom-only fake timers or the E2E main-thread timer bypass).

This change adds **tests and cookbook documentation only** — no product behavior changes unless a test reveals a defect worth a follow-up change.

## Current State Analysis

FlowState recovers from **persisted cycle rows** (`startedAt`, `configuredDurationSec`, `state`, `kind`, `taskId`) plus task lists (Postgres for auth, `flowstate:guest-v1` for guests). `usePomodoroCycle` calls `recoverActiveCycle()` on mount and derives `endTime = startedAt + duration`; countdown UI is not stored separately.

Timer display uses a Web Worker with main-thread fallback; `visibilitychange` → `recalculateFromEndTime()` on refocus. Playwright sets `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1`, so current e2e does not exercise the Worker path.

### Key Discoveries:

- `src/hooks/use-pomodoro-cycle.ts:242-308` — recovery + visibility; `resetActiveCycleRecoveryForTests()` for Vitest isolation
- `src/server/api/routers/cycle.test.ts` — `getActive` integration exists; no multi-field refresh round-trip with task list
- `src/lib/repositories/guest-repositories.test.ts` — basic guest cycle persistence; no expired-on-recovery or missing `taskId`
- `src/hooks/use-pomodoro-cycle.test.tsx:463-498` — expired recovery + `endTime` on resume; **no** `visibilitychange` tests
- `e2e/guest-trial.spec.ts:32-37` — guest `reload` asserts running panel only
- `e2e/pomodoro-cycle.spec.ts` — full cycle with `page.clock`; **no** `reload`
- PRD ±2s NFR — **no** assertion in `src/` today
- `context/foundation/test-plan.md` §6.1–§6.3 — TBD until this phase ships

## Desired End State

After this plan completes:

1. **Risk #1:** Tests fail if refresh mid-active work cycle loses tasks, running phase, or remaining time beyond ±2s tolerance (auth: integration + hook + e2e; guest: hook + extended e2e).
2. **Risk #2:** Tests fail if visibility recalc or tick math allows >±2s error at cycle boundary on fallback path; limitation documented that production Worker throttle is covered by hook math + visibility, not a separate Worker e2e project.
3. **Cookbook:** `context/foundation/test-plan.md` §6.1, §6.2, §6.3, and §6.6 list reference tests, locations, and run commands for persistence and timer patterns.
4. Full suite green: `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e`.

## What We're NOT Doing

- Guest→account merge integrity (risk #5 / Phase 3)
- Mid-cycle task-done prompt (S-03 / risk #3)
- Check-in gate (S-05 / risk #7)
- CI gate wiring (test-plan Phase 4)
- Dedicated Playwright project without `E2E_MAIN_THREAD_TIMER` (deferred per cost × signal; cut-first if time tight)
- Session-timeout + stale RUNNING cycle (deferred to Phase 3)
- Product fixes to `getActive` session semantics unless a test failure forces a separate change
- Asserting internal save payloads or raw `setInterval` without worker/visibility path

## Implementation Approach

Follow test-plan **cost × signal**: cheapest layers first, targeted e2e only for gaps cheaper layers cannot close.

| Risk | Layers (in order) |
|------|-------------------|
| #1 | Integration (`createCaller` + DB fixture) → guest hook (`guest-repositories`) → auth/guest hook (`usePomodoroCycle`) → auth + guest e2e `reload` with countdown oracle |
| #2 | Unit (`getTimerTickResult` edge times) → hook (fallback timer + `visibilitychange` + controlled `Date.now`) — **no** Worker e2e |

Shared **countdown tolerance oracle** (mm:ss parse + wall-clock expected remaining ±2s) reused by hook assertions and Playwright `expect` helpers — avoids duplicating tolerance logic per file.

## Phase 1: Oracles & Cheap Layers

### Overview

Introduce reusable countdown assertions and extend unit, integration, and hook tests for both risks before any new browser specs.

### Changes Required:

#### 1. Countdown tolerance helper

**File**: `src/test-utils/countdown-tolerance.ts` (new)

**Intent**: Centralize parsing of `timer-countdown` mm:ss text and asserting remaining seconds within ±2s of an expected deadline derived from `startedAt` + `configuredDurationSec` (or explicit `endTime`).

**Contract**: Export `parseCountdownToSeconds(text: string): number`, `expectedRemainingSec(endTimeMs: number, nowMs?: number): number`, `assertCountdownWithinTolerance(actualText, endTimeMs, toleranceSec = 2)` for Vitest; export a thin Playwright wrapper in `e2e/helpers/countdown.ts` that reads `data-testid="timer-countdown"` and applies the same math. **Display vs wall clock:** `formatRemainingMs` uses `Math.ceil(ms/1000)` — hook tests assert `result.current.remainingMs` with ms tolerance (±2000ms), not parsed mm:ss from the hook return value. E2e/countdown-text assertions either use tolerance ≥3s or compute expected display via the same ceil rule as `formatRemainingMs` so boundary flakes do not false-fail.

#### 2. Timer tick math edge cases

**File**: `src/workers/timer-worker.test.ts` (extend) or co-located `timer-worker-logic.test.ts` if split

**Intent**: Lock ±2s boundary behavior for `getTimerTickResult` at `now = endTime`, `now = endTime - 2000`, `now = endTime + 2000`.

**Contract**: Cases assert `complete` vs `tick.remaining` magnitudes; no new production code.

#### 3. Cycle + task integration round-trip

**File**: `src/server/api/routers/cycle.test.ts` (extend)

**Intent**: Prove authenticated `getActive` returns the RUNNING cycle **with** linked task after `create`, matching what recovery needs — user-visible data shape, not Prisma internals.

**Contract**: **Extend** the existing `integration: create → getActive → complete` test (~line 442) with full recovery-field assertions (`taskId`, `task.title`, `startedAt`, `configuredDurationSec`, `state: RUNNING`) — do **not** add a second seeded-only `getActive` test; `getActive returns running cycle with task` (~240) already covers the seeded shape.

#### 4. Guest snapshot recovery edge cases

**File**: `src/lib/repositories/guest-repositories.test.ts` (extend)

**Intent**: Cover guest Risk #1 paths: active cycle survives read after write; expired RUNNING cycle (past `startedAt + duration`) still retrievable for hook to mark completed; cycle with missing `taskId` returns `task: null`.

**Contract**: Use `createGuestRepositories()` + controlled `startedAt` in snapshot helpers (adjust clock via stored ISO strings).

#### 5. Hook — visibility recalc (Risk #2)

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend)

**Intent**: Prove `recalculateFromEndTime` runs when tab becomes visible: after simulating background time advance on **fallback** path (`Worker` throws), remaining ms jumps to within ±2s of true deadline; optionally assert transition to `completed` when past `endTime`.

**Contract**: `document.dispatchEvent(new Event("visibilitychange"))` with `document.visibilityState` stubbed to `"visible"`; use existing `vi.useFakeTimers()` + fallback path test pattern (`uses fallback timer when Worker constructor throws`). Assert `result.current.remainingMs` within ±2000ms of `endTimeRef` deadline after simulated background advance — not parsed mm:ss (avoids `formatRemainingMs` ceil noise). Keep Worker constructor throwing so worker ticks do not race recalc.

#### 6. Hook — guest mode recovery (Risk #1 parity)

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend) **or** dedicated guest-mode wrapper test file if mocking becomes heavy

**Intent**: Render hook in guest data mode (repositories from snapshot) and assert recovery sets running state + countdown within tolerance after seeded localStorage.

**Contract**: Replace the hardcoded `useDataMode: () => "authenticated"` mock with `guest` + `useRepositories: () => createGuestRepositories()` (see `guest-repositories.test.ts`). Seed `flowstate:guest-v1` via `createGuestRepositories()` / snapshot helpers **before** `renderHook` so `cycles.getActive()` reads real guest storage — seeding alone does nothing while the mock still returns authenticated repos. Stub `api.useUtils` only if guest `countCompletedWork` / invalidate paths need it. Reuse `resetActiveCycleRecoveryForTests()`; assert `state === "running"` and remaining via helper (`remainingMs` or tolerance helper).

#### 7. Hook — expired while closed (Risk #1 edge)

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend existing `shows completed when recovered cycle already expired`)

**Intent**: Strengthen assertion: `completed` state **and** completion overlay trigger path (alarm/worker stop) without requiring e2e.

**Contract**: Extend expectations on `result.current.state` and side effects already partially covered at line ~463.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes including new/extended files under `src/test-utils/`, `src/workers/`, `src/server/api/routers/cycle.test.ts`, `src/lib/repositories/guest-repositories.test.ts`, `src/hooks/use-pomodoro-cycle.test.tsx`

#### Manual Verification:

- Review failing-test output once intentionally breaking `recalculateFromEndTime` to confirm visibility test catches drift (local only; revert before commit)

**Implementation Note**: Pause for manual confirmation after automated checks before Phase 2.

---

## Phase 2: Browser Proofs (Risk #1)

### Overview

Add authenticated mid-cycle reload e2e with countdown tolerance; extend guest reload e2e to assert countdown — still using `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` and `page.clock` where needed for stability.

### Changes Required:

#### 1. Authenticated reload e2e

**File**: `e2e/pomodoro-cycle.spec.ts` (extend) **or** `e2e/persistence-reload.spec.ts` (new, same auth project)

**Intent**: Start 15 min cycle, advance clock slightly (e.g. 30s), `page.reload()`, wait for `cycle.getActive`, assert task row visible, `timer-panel-running`, and `timer-countdown` within ±2s of expected remaining. **Clock/reload caveat:** install `page.clock` before start; if fake time does not survive `reload`, derive expected remaining from persisted cycle semantics (15 min preset minus elapsed) via the countdown helper rather than assuming clock offset persists — implementer validates once and documents chosen pattern in spec comments.

**Contract**: Uses authenticated storage state from F-02 fixture; `ensureIdleCycle` in `beforeEach`; capture `endTime` proxy via known `startedAt` from 15 min preset minus elapsed clock advance; use `e2e/helpers/countdown.ts`. After `page.reload()`, **re-wait** for a successful `cycle.getActive` network response (do not rely on `beforeEach`'s best-effort wait — it uses `.catch(() => {})`) before asserting `timer-panel-running` / countdown.

#### 2. Guest reload countdown

**File**: `e2e/guest-trial.spec.ts` (extend)

**Intent**: After `reload`, assert `timer-countdown` within tolerance (not only `timer-panel-running`).

**Contract**: Same 15 min + short `page.clock.runFor` before reload as existing test; guest banner still visible.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e` passes (full suite or targeted specs if scoped during iteration)
- `pnpm test` still passes (no regressions)

#### Manual Verification:

- None required if e2e passes in CI mode locally

**Implementation Note**: No Worker-disabled Playwright project in this phase.

---

## Phase 3: Cookbook & Closure

### Overview

Fill test-plan cookbook entries and mark Phase 1 rollout row ready for orchestrator `complete` after verification.

### Changes Required:

#### 1. Cookbook §6.1 — unit tests

**File**: `context/foundation/test-plan.md`

**Intent**: Replace TBD with persistence/timer unit guidance: location, naming, reference tests (`timer-worker.test.ts`, `countdown-tolerance` usage), run command.

**Contract**: §6.1 bullets for refresh-recovery math and timer tick patterns.

#### 2. Cookbook §6.2 — integration

**File**: `context/foundation/test-plan.md`

**Intent**: Document `createCaller` active-cycle + task pattern; reference `cycle.test.ts` extension.

**Contract**: §6.2 includes cross-user note pointing to Phase 3 for IDOR.

#### 3. Cookbook §6.3 — e2e reload

**File**: `context/foundation/test-plan.md`

**Intent**: Document auth + guest reload specs, countdown oracle, `CI=true` requirement, `page.clock` vs real-time note.

**Contract**: §6.3 references `e2e/pomodoro-cycle.spec.ts` / `guest-trial.spec.ts` and `e2e/helpers/countdown.ts`.

#### 4. Cookbook §6.6 — phase notes

**File**: `context/foundation/test-plan.md`

**Intent**: Record Phase 1 completion date, risks covered #1/#2, explicit limitation (no Worker e2e; session-timeout deferred).

**Contract**: Short subsection under §6.6.

#### 5. Change status

**File**: `context/changes/testing-critical-path-persistence-timer/change.md`

**Intent**: Set `status: implemented` when all Progress checkboxes are `[x]` (handled by `/10x-implement`).

**Contract**: `updated` stamp on ship.

### Success Criteria:

#### Automated Verification:

- `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e` all pass
- `context/foundation/test-plan.md` §6.1, §6.2, §6.3 no longer say "TBD — see §3 Phase 1"

#### Manual Verification:

- Spot-read cookbook entries for clarity (another contributor could add a test from §6 alone)

---

## Testing Strategy

### Unit Tests:

- `getTimerTickResult` at endTime ±2s boundaries
- `parseCountdownToSeconds` / tolerance helper edge cases (invalid format throws or fails clearly)

### Integration Tests:

- `cycle.getActive` with task join after create
- Guest repositories: active, expired, missing task

### Hook Tests:

- Auth recovery (existing + strengthened expired)
- Guest mode recovery
- Fallback timer + `visibilitychange` recalc within ±2s

### E2E:

- Auth: mid-cycle `reload` + countdown tolerance
- Guest: reload + countdown tolerance

### Manual Testing Steps:

1. Intentionally break visibility handler locally; confirm hook test fails (Phase 1 only)
2. Run full e2e suite with `CI=true` before marking Phase 3 complete

## Performance Considerations

New tests add negligible CI time; e2e reload specs reuse 15 min preset with `page.clock` — keep clock advance minimal (30s–2 min) to avoid timeout inflation.

## Migration Notes

None — test-only change.

## References

- Research: `context/changes/testing-critical-path-persistence-timer/research.md`
- Quality contract: `context/foundation/test-plan.md` (risks #1–#2, Phase 1 row)
- Timer architecture: `context/changes/first-pomodoro-cycle/research.md`
- Hook recovery: `src/hooks/use-pomodoro-cycle.ts:242-308`
- Guest reload e2e: `e2e/guest-trial.spec.ts:32-37`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Oracles & Cheap Layers

#### Automated

- [x] 1.1 `pnpm check` passes
- [x] 1.2 `pnpm typecheck` passes
- [x] 1.3 `pnpm test` passes (unit, integration, hook extensions)

#### Manual

- [x] 1.4 Visibility test fails when `recalculateFromEndTime` is broken (local sanity check, reverted)

### Phase 2: Browser Proofs (Risk #1)

#### Automated

- [x] 2.1 `set CI=true && pnpm test:e2e` passes (reload specs)
- [x] 2.2 `pnpm test` passes (no regressions)

### Phase 3: Cookbook & Closure

#### Automated

- [x] 3.1 Full verification: `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e`
- [x] 3.2 `test-plan.md` §6.1 / §6.2 / §6.3 / §6.6 updated (no Phase 1 TBD)

#### Manual

- [x] 3.3 Cookbook spot-read — another dev could add a test from §6 alone
