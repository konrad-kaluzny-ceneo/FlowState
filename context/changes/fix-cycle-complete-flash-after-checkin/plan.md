# Fix Cycle Complete overlay flash after check-in — Implementation Plan

## Overview

Eliminate the production flash where the stale **Cycle Complete!** modal reappears after energy check-in submit until the break cycle starts. The fix closes the `awaitingCheckIn=false` + `state=completed` visibility gap without reordering the S-06 `confirmComplete` → suggestion-fetch chain.

## Current State Analysis

After S-05 introduced the check-in gate, `submitCheckIn` clears `awaitingCheckIn` immediately after the check-in API succeeds (`use-pomodoro-cycle.ts:1419`) while `state` remains `"completed"` until `startBreakAfterWorkComplete` calls `setState("running")` (`:1129`). The dashboard remounts `CycleCompleteOverlay` when `!awaitingCheckIn && !awaitingWindDown` (`pomodoro-dashboard.tsx:311`); the overlay renders when `state === "completed"` (`cycle-complete-overlay.tsx:30`).

S-16 solved the same class of gap for wind-down with a dedicated parent gate (`!awaitingWindDown`). B-04 is the missing post-check-in transition guard. The secondary `onWindDownKeepGoing` path reopens the gap because `awaitingCheckIn` was already cleared during the earlier check-in submit.

### Key Discoveries:

- Effective overlay visibility: `!awaitingCheckIn && !awaitingWindDown && state === "completed"` — no single boolean owns this.
- `continueAfterCheckIn` (`:1275–1309`) already owns the async window; S-06 ordering (`confirmComplete` then `fetchPostCheckInSuggestion`) is load-bearing and must not change.
- Existing unit test `"WORK cycle-end requires check-in before break starts"` (`use-pomodoro-cycle.test.tsx:752–811`) resolves mocks instantly inside one `act()`, masking the production flash window.
- Wind-down branch after check-in is unaffected today because `awaitingWindDown` suppresses the overlay; that exclusion must remain.

## Desired End State

After submitting energy at authenticated WORK cycle end, the user never sees the stale **Cycle Complete!** modal during the async break-start window. They either see the check-in overlay in a submitting state (normal path) or a calm timer-only transition (wind-down **Keep going** path) until `state === "running"` on a break cycle. Wind-down nudge flow after check-in is unchanged.

### Verification

- Unit tests assert no render window where `!awaitingCheckIn && !awaitingWindDown && !isPostCheckInTransitioning && state === "completed"` during `submitCheckIn` or `onWindDownKeepGoing` with deferred async mocks.
- Manual: submit energy on authenticated dashboard with throttled network — no Cycle Complete flash before break timer appears.

## What We're NOT Doing

- Reordering `confirmComplete` before `fetchPostCheckInSuggestion` (S-06 contract).
- Adding a new full-screen loading shell component (unless deferral + gate prove insufficient in manual QA).
- Changing guest or break cycle-end flows (no check-in gate today; no regression expected).
- Fixing unrelated catch-up z-order polish unless a test proves regression.

## Implementation Approach

**Hook-first, S-16 mirror:** Introduce `isPostCheckInTransitioning` scoped to `continueAfterCheckIn` lifecycle. Defer `setAwaitingCheckIn(false)` and `setPendingMarkTaskDone(null)` until break start is observable (`state === "running"` on a break cycle). Wind-down branch in `submitCheckIn` keeps immediate clears before `setAwaitingWindDown(true)` (refs already capture `markTaskDone`).

**Dashboard belt-and-suspenders:** Extend the `CycleCompleteOverlay` parent mount gate with `!isPostCheckInTransitioning`, matching the S-16 `awaitingWindDown` precedent.

## Critical Implementation Details

**State sequencing:** Remove the unconditional `setAwaitingCheckIn(false)` and `setPendingMarkTaskDone(null)` at `submitCheckIn` ~1419–1420. Move both clears into `continueAfterCheckIn`, executed only when break start is observable (`stateRef.current === "running"` with break `cycleKind`) — not merely when `await confirmComplete` resolves, because `confirmComplete` swallows errors and returns without throwing. On failure, leave `awaitingCheckIn === true` and `pendingMarkTaskDone !== null` so `submitCheckIn` can retry from `CheckInOverlay`.

**Wind-down exclusion:** In `submitCheckIn`, when wind-down nudge fires, explicitly call `setAwaitingCheckIn(false)` then `setAwaitingWindDown(true)` and return — do **not** enter `continueAfterCheckIn` or set `isPostCheckInTransitioning`.

**Keep-going path:** `onWindDownKeepGoing` already calls `continueAfterCheckIn`; the transition flag inside that helper covers this path without re-showing `CheckInOverlay`.

## Phase 1: Hook post-check-in transition guard

### Overview

Close the flash window at the source by synchronizing check-in gate flags with break-start state transitions inside `continueAfterCheckIn`, while preserving wind-down branching.

### Changes Required:

#### 1. Transition flag and deferred check-in clear

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Add `isPostCheckInTransitioning` state and manage it inside `continueAfterCheckIn` so any caller (`submitCheckIn` normal path, `onWindDownKeepGoing`) suppresses cycle-complete remount during async work. Defer clearing `awaitingCheckIn` until break is running.

**Contract**: New hook state `isPostCheckInTransitioning: boolean` (default `false`), exported on the hook return object alongside `awaitingCheckIn` / `awaitingWindDown`. In `continueAfterCheckIn`: set `isPostCheckInTransitioning(true)` at entry; run existing body unchanged (`setPendingSuggestion({ status: "loading" })` → `await confirmComplete` → `await fetchPostCheckInSuggestion`); **after** `await confirmComplete`, call `setAwaitingCheckIn(false)` and `setPendingMarkTaskDone(null)` only when break start succeeded — gate on `stateRef.current === "running"` and break `cycleKind` (`SHORT_BREAK` | `LONG_BREAK`); in `finally`, set `isPostCheckInTransitioning(false)`. Remove the unconditional `setAwaitingCheckIn(false)` and `setPendingMarkTaskDone(null)` at `submitCheckIn` ~1419–1420. In the wind-down branch (~1445), add explicit `setAwaitingCheckIn(false)` and `setPendingMarkTaskDone(null)` immediately before `setAwaitingWindDown(true)` (refs already capture `markTaskDone` / `workCycleId`).

#### 2. Catch-up snapshot (if applicable)

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Ensure tab-return catch-up derivation does not surface `WORK_CONFIRM` during the post-check-in transition when the user should not see cycle-complete UI.

**Contract**: `setCatchUpFromExpiry` (~293) calls `deriveCatchUpGate` with `awaitingCheckInRef` — deferred `awaitingCheckIn` on the normal path already yields `CHECK_IN` during transition. The **keep-going** path (`onWindDownKeepGoing`) has `awaitingCheckIn === false` during transition; if tab-return during that window can set `catchUp.gate === "WORK_CONFIRM"`, extend `deriveCatchUpGate` / snapshot inputs or rely on Phase 2 `showCycleCompleteCatchUp` guard (see Phase 2). Do not touch `kickoffEligible` (~807); unrelated to cycle-complete visibility.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes (existing tests; may need minor expectation tweaks if final `awaitingCheckIn` timing shifts within same `act` block)

#### Manual Verification:

- Authenticated WORK cycle end → confirm → submit energy → check-in overlay stays in submitting state (or timer-only on keep-going) until break timer runs; no **Cycle Complete!** flash
- Wind-down nudge after check-in still shows `WindDownOverlay`, not cycle-complete

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Dashboard belt-and-suspenders gate

### Overview

Mirror S-16 wind-down gating on the dashboard so `CycleCompleteOverlay` cannot remount during post-check-in transition even if hook flag timing slips one frame.

### Changes Required:

#### 1. Cycle-complete mount gate

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Extend the parent mount condition for `CycleCompleteOverlay` to include the new transition flag.

**Contract**: Line ~311 condition becomes `!pomodoro.awaitingCheckIn && !pomodoro.awaitingWindDown && !pomodoro.isPostCheckInTransitioning`. Extend `showCycleCompleteCatchUp` (~121–125) with `!pomodoro.awaitingWindDown && !pomodoro.isPostCheckInTransitioning` — required for the **Keep going** path where `awaitingCheckIn` is already false during `continueAfterCheckIn`.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes

#### Manual Verification:

- Repeat Phase 1 manual scenario; confirm no flash with React devtools confirming overlay unmounted during transition
- Guest/break cycle-end confirm flow unchanged (overlay stays through `isConfirming` disable only)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: Regression tests for transition window

### Overview

Add unit tests that fail on the pre-fix flash window by deferring async resolution across render ticks. Optional cheap e2e only if harness already covers authenticated cycle-end.

### Changes Required:

#### 1. Deferred-async flash regression tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`

**Intent**: Assert intermediate hook state never satisfies the cycle-complete visibility formula during post-check-in async work.

**Contract**: Add helper `assertNoCycleCompleteFlash(result)` that fails when `!awaitingCheckIn && !awaitingWindDown && !isPostCheckInTransitioning && state === "completed"`. Test A — `"submitCheckIn keeps cycle-complete suppressed until break running"`: WORK cycle-end → confirm → wrap `cycles.create` (break creation) in a controllable deferred promise; call `submitCheckIn` without awaiting; poll/`waitFor` intermediate renders and assert helper never fires; await resolution; assert final `state === "running"`, `cycleKind` break, `awaitingCheckIn === false`. Test B — `"onWindDownKeepGoing keeps cycle-complete suppressed until break running"`: mock `sessions.getOrCreateActive` to return `{ interruptionCount: 3, ... }`, submit check-in with `"FADING"` energy so wind-down nudge fires; call `onWindDownKeepGoing` with the same deferred `cycles.create` mock; assert helper never fires mid-transition (mirror wind-down setup from `e2e/mindful-session-wind-down.spec.ts`). Test C — wind-down after check-in: assert `awaitingWindDown === true`, `awaitingCheckIn === false`, `isPostCheckInTransitioning === false`, no flash helper violation. Test D — `"confirmComplete failure keeps check-in retryable"`: reject `cycles.complete` mock; after `submitCheckIn` settles, assert `awaitingCheckIn === true`, `pendingMarkTaskDone !== null`, `isPostCheckInTransitioning === false`, helper never fired; second `submitCheckIn` call still invokes `completeCycle`. Reuse existing mock patterns from `:752–811`.

#### 2. Optional E2E (skip if costly)

**File**: `e2e/` (new or extend existing authenticated pomodoro spec)

**Intent**: Browser-level regression if an authenticated cycle-end spec already exists with stable selectors.

**Contract**: Extend `e2e/pomodoro-cycle.spec.ts` (already asserts overlay hidden after check-in with instant mocks) only if a throttled-network variant is cheap; otherwise rely on Phase 3 deferred Vitest cases. Mark optional — no Progress step unless implemented.

### Success Criteria:

#### Automated Verification:

- `pnpm test` passes
- `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes including flash-regression and confirmComplete-failure retry cases

#### Manual Verification:

- Throttled network manual pass from Phase 1 still holds after test additions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before marking the change implemented.

---

## Testing Strategy

### Unit Tests:

- Flash-window invariant: `!awaitingCheckIn && !awaitingWindDown && !isPostCheckInTransitioning && state === "completed"` must never hold during `submitCheckIn` / `onWindDownKeepGoing` async window
- Wind-down branch: overlay suppressed via `awaitingWindDown`, not transition flag
- Error path: failed `confirmComplete` leaves `awaitingCheckIn === true`, `pendingMarkTaskDone !== null`, `isPostCheckInTransitioning === false` after finally; retry succeeds (Test D)
- Existing `"WORK cycle-end requires check-in before break starts"` remains green

### Integration Tests:

- None required beyond hook tests; dashboard gate is declarative

### Manual Testing Steps:

1. Authenticated user, active WORK cycle → let timer complete → confirm → submit energy → observe no Cycle Complete flash before break
2. Trigger wind-down nudge → **Keep going** → observe no flash before break
3. Trigger wind-down → **End session** → confirm session ends without break (unchanged)
4. Guest mode cycle end → confirm still works with overlay + disabled buttons only

## Performance Considerations

One boolean state update per check-in transition; no additional network calls. Deferral may keep check-in overlay mounted slightly longer — acceptable and aligns with FR-020 calm-transition intent.

## Migration Notes

Not applicable — client-only state-machine fix, no schema or API changes.

## References

- Related research: `context/changes/fix-cycle-complete-flash-after-checkin/research.md`
- S-16 wind-down gate precedent: `context/archive/2026-06-08-mindful-session-wind-down/plan.md:163`
- S-06 ordering constraint: `context/archive/2026-06-07-adaptive-task-suggestion/plan.md`
- Root cause lines: `src/hooks/use-pomodoro-cycle.ts:1419`, `:1129`, `src/app/_components/pomodoro-dashboard.tsx:311`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Hook post-check-in transition guard

#### Automated

- [x] 1.1 `pnpm check` passes — d5881f1
- [x] 1.2 `pnpm typecheck` passes — d5881f1
- [x] 1.3 `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx` passes — d5881f1

#### Manual

- [ ] 1.4 Authenticated check-in → break: no Cycle Complete flash; wind-down nudge unchanged

### Phase 2: Dashboard belt-and-suspenders gate

#### Automated

- [x] 2.1 `pnpm check` passes — f002efb
- [x] 2.2 `pnpm typecheck` passes — f002efb

#### Manual

- [ ] 2.3 Dashboard gate manual pass; guest/break cycle-end unchanged

### Phase 3: Regression tests for transition window

#### Automated

- [x] 3.1 `pnpm test` passes
- [x] 3.2 Flash-regression and confirmComplete-failure retry vitest cases pass in `use-pomodoro-cycle.test.tsx`

#### Manual

- [ ] 3.3 Throttled-network manual pass still holds after test additions
