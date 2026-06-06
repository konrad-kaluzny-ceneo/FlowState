# Phase 2 Test Rollout — Active-Slice Browser Proofs Implementation Plan

## Overview

Ship test-plan Phase 2 (risks **#3** and **#7**) by bundling minimal **S-03** (FR-015 mid-cycle completion prompt) and **S-05** (FR-020 end-of-cycle check-in gate) product UI with Playwright browser proofs. Integration persistence for check-ins already exists (`testing-check-in-persistence`); this change closes the UI gate gaps research identified and documents e2e patterns in the test-plan cookbook.

## Current State Analysis

Both failure surfaces are **missing product features**, not untested edge cases:

- **Risk #3:** `task-list.tsx` sets `cycleLocked` during `running`/`completed`, disabling mark-complete mid-cycle. No mid-cycle prompt component exists.
- **Risk #7:** `confirmComplete` in `use-pomodoro-cycle.ts` calls `cycles.complete` then auto-starts break with zero `checkIn` client usage. Server `checkIn.create`/`list` are implemented and integration-tested.

E2e infrastructure from Phase 1 is ready: per-test auth (`e2e/fixtures.ts`), cycle helpers (`e2e/helpers/work-cycle.ts`), idle reset (`e2e/helpers/idle-cycle.ts`), and S-01 overlay flows (`e2e/pomodoro-cycle.spec.ts`).

### Key Discoveries:

- `src/app/_components/task-list.tsx:115` — `cycleLocked` blocks FR-015 entirely today
- `src/app/_components/cycle-complete-overlay.tsx` — S-01 cycle-end overlay; pattern to mirror for new overlays
- `src/hooks/use-pomodoro-cycle.ts:433-525` — `confirmComplete` transition chain; S-05 inserts between overlay confirm and this mutation for WORK cycles
- `src/server/api/routers/cycle.ts` — no `taskId` rebind on RUNNING cycle; needed for "continue with next task"
- `src/server/api/routers/check-in.ts` — persistence API ready; auth-only (guest check-ins out of MVP scope)
- `e2e/pomodoro-cycle.spec.ts` — must gain check-in step when S-05 lands to avoid S-01 regression

## Desired End State

After this plan completes:

1. **Risk #3:** Authenticated user marking a task done during a running WORK cycle always sees FR-015 choices; with no other active tasks, only "end cycle and break" is offered. Playwright specs fail if prompt is skipped or wrong choices appear.
2. **Risk #7:** Every completed WORK cycle requires energy selection before break starts; Playwright asserts check-in overlay blocks transition (`timer-panel-running` for break absent until energy selected) and `checkIn.create` returns `{ energy, cycleId }`.
3. **Cookbook:** `context/foundation/test-plan.md` §6.3 and §6.6 document Phase 2 e2e patterns, helpers, and explicit deferrals (guest e2e, skip-vector matrix, server hardening).
4. Full suite green: `pnpm check`, `pnpm typecheck`, `pnpm test`, `set CI=true && pnpm test:e2e`.

## What We're NOT Doing

- Guest-mode Playwright proofs (deferred follow-up; product UI may work for guest mid-cycle but check-in is auth-only per PRD)
- Server-side `cycle.complete` check-in prerequisite (UI gate only for MVP)
- Escape / end-session / refresh mid-gate skip-vector e2e (core gate + persistence oracle only)
- S-06 adaptive suggestion (no reader of `checkIn.list` in client)
- `interruptionCount` increment (FR-019 — separate slice if needed)
- CI gate wiring (test-plan Phase 4)
- Accessibility axe scans on new modals
- Revert-during-cycle e2e (FR-009a consistency — product should keep revert disabled during cycle; no new test in this change)

## Implementation Approach

Product slices land first (Phases 1–2), then e2e infrastructure and specs (Phases 3–4). Both overlays follow `CycleCompleteOverlay` modal pattern with stable `data-testid`s for Playwright.

| Risk | Product (S-03 / S-05) | E2e oracle |
|------|-------------------------|------------|
| #3 | Enable mark-complete during WORK `running`; prompt with continue vs end-break; rebind `taskId` on continue | Prompt visible in-flight; branch assertions on timer/focus/break |
| #7 | Check-in overlay after S-01 confirm; hook blocks break until `checkIn.create` | Break timer hidden until check-in; network response oracle |

Auth-only e2e via `fixtures.ts`. Update existing `pomodoro-cycle.spec.ts` so S-01 flows include the check-in step.

## Critical Implementation Details

**S-05 transition ordering:** For WORK cycles, `CycleCompleteOverlay` confirm must **not** call the existing `confirmComplete` break-start path directly. Introduce an intermediate hook state (e.g. `awaitingCheckIn`) that holds the pending `markTaskDone` flag until energy is submitted, then runs the current complete+break logic. Break cycles skip check-in entirely.

**Mid-cycle mark-complete entry:** Task list should invoke a hook callback (not bare `taskRepo.update`) when mark-complete is clicked during a WORK `running` cycle, so the prompt appears before persistence side-effects commit.

## Phase 1: S-03 — Mid-Cycle Completion Prompt

### Overview

Implement FR-015: user can mark a task done mid-cycle and choose to continue with another active task or end the cycle for a break now.

### Changes Required:

#### 1. Cycle task rebind API

**File**: `src/server/api/routers/cycle.ts` (extend)

**Intent**: Allow swapping the focused task on a RUNNING WORK cycle without resetting elapsed time — required for "continue current cycle with next task."

**Contract**: New protected mutation `rebindTask` with input `{ cycleId: number, taskId: number }`. Verify caller owns cycle and task; cycle must be `RUNNING` and `kind: WORK`. Update `cycle.taskId` only (preserve `startedAt`, `configuredDurationSec`). Return cycle with included task. Add integration test in `cycle.test.ts` (happy path + NOT_FOUND cross-user).

**File**: `src/lib/repositories/guest-repositories.ts` and `src/lib/repositories/server-repositories.ts` (extend)

**Intent**: Guest and auth repository layers expose the same rebind contract the hook calls.

**Contract**: `cycles.rebindTask({ cycleId, taskId })` on both repository implementations.

#### 2. Mid-cycle prompt component

**File**: `src/app/_components/mid-cycle-completion-prompt.tsx` (new)

**Intent**: Modal shown when user initiates mark-complete during a WORK running cycle.

**Contract**: Props include pending task, list of other active tasks, `onContinueWithTask(taskId)`, `onEndCycleAndBreak`, `isSubmitting`. Render `data-testid="mid-cycle-prompt-overlay"`. When other active tasks exist: show `mid-cycle-continue-btn` (requires selected next task) and `mid-cycle-end-break-btn`. When no other active tasks: show only `mid-cycle-end-break-btn`. Mirror overlay styling from `cycle-complete-overlay.tsx`.

#### 3. Hook — mid-cycle flow

**File**: `src/hooks/use-pomodoro-cycle.ts` (extend)

**Intent**: Own mid-cycle prompt state and transitions: continue (mark done + rebind + keep timer) vs end-break (mark done + early complete + break via existing path).

**Contract**: Export `onMidCycleMarkComplete(taskId)` callback and prompt visibility state. On continue: `task.update(completed)` for marked task, `cycles.rebindTask`, update `focusedTaskId`/`focusedTask`, keep `state: running` and worker endTime unchanged. On end-break: mark task complete then invoke early WORK completion + auto-break (reuse logic from `confirmComplete` WORK branch). Clear prompt state on success/error.

#### 4. Task list — enable mid-cycle mark-complete

**File**: `src/app/_components/task-list.tsx` (modify)

**Intent**: Allow mark-complete during WORK `running` (not during `completed` overlay or break cycles).

**Contract**: Narrow `cycleLocked` for the mark-complete button: disabled when `cycleState === "completed"` or when cycle is a break (pass `cycleKind` prop if needed). During WORK `running`, call `onMidCycleMarkComplete(task.id)` instead of direct `taskRepo.update`. Keep revert/focus/edit/delete locked during running/completed as today.

#### 5. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx` (modify)

**Intent**: Wire prompt component and pass active-task list for choice rendering.

**Contract**: Render `MidCycleCompletionPrompt` when hook exposes pending state. Pass `activeTasks` filtered to `status === "active"` excluding the pending task for continue options.

#### 6. Unit tests

**File**: `src/app/_components/mid-cycle-completion-prompt.test.tsx` (new)

**Intent**: Component renders both-choice and single-choice layouts.

**Contract**: Tests for multi-task (both buttons) and last-task (end-break only) without cycle context — minimal; e2e owns in-flight integration.

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend)

**Intent**: Hook mid-cycle continue preserves running state; end-break triggers complete+break.

**Contract**: Mock `cycles.rebindTask` and `cycles.complete`; assert state transitions.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes (including new/extended cycle + hook + component tests)
- `pnpm exec vitest run src/server/api/routers/cycle.test.ts` — rebindTask cases pass

#### Manual Verification:

- Start WORK cycle with 2 tasks; mark focused task done mid-cycle → prompt shows both choices
- Choose continue with second task → timer keeps running, focus switches, first task in Completed
- Start WORK cycle with 1 task; mark done mid-cycle → only end-cycle option shown; choosing it starts break
- Break cycle running → mark-complete still disabled on task list

**Implementation Note**: Pause for manual confirmation before Phase 2.

---

## Phase 2: S-05 — End-of-Cycle Check-In Gate

### Overview

Implement FR-020 UI gate: after S-01 cycle-complete confirm on WORK cycles, user must select energy before break starts. Auth-only (`checkIn.create` via tRPC client).

### Changes Required:

#### 1. Check-in overlay component

**File**: `src/app/_components/check-in-overlay.tsx` (new)

**Intent**: Non-dismissible energy selection modal (Focused / Steady / Fading).

**Contract**: Props: `cycleId`, `onSubmit(energy)`, `isSubmitting`. Testids: `check-in-overlay`, `check-in-energy-focused`, `check-in-energy-steady`, `check-in-energy-fading`. One tap selects and submits (no separate submit button required if selection immediately calls `onSubmit`). Modal must not close on backdrop click or Escape without selection.

#### 2. Hook — awaiting check-in state

**File**: `src/hooks/use-pomodoro-cycle.ts` (extend)

**Intent**: Split WORK cycle-end path: overlay confirm stores pending completion; check-in overlay calls `checkIn.create` then proceeds to existing complete+break logic.

**Contract**: New exported state `awaitingCheckIn: boolean` and `pendingMarkTaskDone: boolean | null`. `onCycleCompleteConfirm(markTaskDone)` for WORK cycles sets awaiting state instead of calling `cycles.complete` immediately. `submitCheckIn(energy)` calls `api.checkIn.create.mutate`, then runs existing `confirmComplete` body with stored `markTaskDone`. Break cycles: `onCycleCompleteConfirm` unchanged (direct `confirmComplete`). Export `isConfirming` for overlay disabled states.

#### 3. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx` (modify)

**Intent**: Wire check-in overlay and route cycle-complete overlay confirm through new hook method.

**Contract**: `CycleCompleteOverlay` `onConfirm` → `pomodoro.onCycleCompleteConfirm` (not raw `confirmComplete`). Render `CheckInOverlay` when `awaitingCheckIn`. Pass `isConfirming` to both overlays. Check-in overlay only in authenticated mode (guest dashboard skips it — WORK completion on guest follows existing path without check-in per PRD).

#### 4. tRPC client usage

**File**: `src/hooks/use-pomodoro-cycle.ts` (extend)

**Intent**: Call `api.checkIn.create.useMutation()` from hook.

**Contract**: Map UI labels to enum values `FOCUSED`, `STEADY`, `FADING`. On mutation error, surface via existing `setError` pattern; do not start break.

#### 5. Hook tests

**File**: `src/hooks/use-pomodoro-cycle.test.tsx` (extend)

**Intent**: WORK cycle-end requires check-in before break; break cycle-end skips check-in.

**Contract**: Mock `checkIn.create`; assert break not started until submit; assert `checkIn.create` called with correct `cycleId` and energy.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes (extended hook tests)

#### Manual Verification:

- Complete WORK cycle via timer → S-01 overlay → confirm → check-in appears → break does **not** start until energy tapped
- After energy selection, break timer appears
- Complete break cycle → no check-in; break-continue returns to idle
- Guest mode: WORK cycle completion does not show check-in (existing break/idle path)

**Implementation Note**: Pause for manual confirmation before Phase 3.

---

## Phase 3: E2e Infrastructure

### Overview

Extend Playwright helpers and update existing specs so cycle-end flows account for S-05 check-in before writing new risk-specific specs.

### Changes Required:

#### 1. Multi-task and mid-cycle helpers

**File**: `e2e/helpers/work-cycle.ts` (extend)

**Intent**: Reduce duplication in mid-cycle specs.

**Contract**: Export `addTask(page, title)`, `addTasks(page, titles[])`, `markTaskCompleteMidCycle(page, taskTitle)` — clicks `aria-label="Mark complete"` on matching listitem while `timer-panel-running` visible.

#### 2. Check-in helper

**File**: `e2e/helpers/check-in.ts` (new)

**Intent**: Shared check-in completion for updated pomodoro specs and new gate spec.

**Contract**: Export `completeCheckIn(page, energy: "focused" | "steady" | "fading")` — waits for `check-in-overlay`, clicks matching `check-in-energy-*` testid, optionally waits for overlay hidden.

#### 3. Idle reset — check-in dismissal

**File**: `e2e/helpers/idle-cycle.ts` (extend)

**Intent**: `beforeEach` idle reset handles stranded check-in overlay.

**Contract**: Before cycle-complete overlay handling, if `check-in-overlay` visible, complete with default energy (`steady`) via helper. Order: check-in → cycle-complete overlay → interrupt → end session.

#### 4. Update S-01 specs

**File**: `e2e/pomodoro-cycle.spec.ts` (modify)

**Intent**: Existing S-01 tests pass through check-in gate after overlay confirm.

**Contract**: After clicking "Continue later" or "Done — mark task complete", call `completeCheckIn(page, "steady")` before asserting post-transition state. Import from `./helpers/check-in`.

### Success Criteria:

#### Automated Verification:

- `set CI=true && pnpm test:e2e e2e/pomodoro-cycle.spec.ts` passes

#### Manual Verification:

- Updated pomodoro-cycle flows feel correct in headed mode (overlay → check-in → break/idle)

**Implementation Note**: Pause for manual confirmation before Phase 4.

---

## Phase 4: Browser Proofs & Cookbook

### Overview

Add Playwright specs for risks #3 and #7 and document Phase 2 patterns in the test plan.

### Changes Required:

#### 1. Mid-cycle — multi-task spec

**File**: `e2e/mid-cycle-completion.spec.ts` (new)

**Intent**: Risk #3 — both choices when other active tasks remain.

**Contract**: Two tasks → start 30s cycle on first → mark first done mid-flight → assert `mid-cycle-prompt-overlay` with both action buttons. Test A: continue with second task → `timer-panel-running` stays, second task focused, first in Completed. Test B (separate test or serial): end cycle and break → break running panel appears. Use standard auth `beforeEach` skeleton.

#### 2. Mid-cycle — last task spec

**File**: `e2e/mid-cycle-last-task.spec.ts` (new)

**Intent**: Risk #3 — single option when no other active tasks.

**Contract**: One task → start cycle → mark done mid-flight → assert `mid-cycle-prompt-overlay` visible, `mid-cycle-continue-btn` hidden, `mid-cycle-end-break-btn` visible → click end-break → break starts.

#### 3. Check-in gate spec

**File**: `e2e/check-in-gate.spec.ts` (new)

**Intent**: Risk #7 — gate blocks transition; persistence oracle.

**Contract**: Complete 1s WORK cycle via clock → S-01 overlay → "Continue later" → assert `check-in-overlay` visible and work-break transition not started (assert break-specific state: e.g. no break countdown label or use `waitForResponse` on `checkIn.create` after energy click). Select energy → assert `checkIn.create` response JSON includes `energy` and `cycleId`. Assert break `timer-panel-running` appears after check-in. Do **not** snapshot modal HTML.

#### 4. Test-plan cookbook

**File**: `context/foundation/test-plan.md` (extend §6.3 and §6.6)

**Intent**: Document Phase 2 shipped patterns for future contributors.

**Contract**: §6.3 add mid-cycle and check-in helper references, spec file list, run command. §6.6 add "Phase 2 — Active-slice browser proofs" subsection with risks #3/#7, explicit deferrals (guest e2e, skip vectors, server hardening), and reference specs.

### Success Criteria:

#### Automated Verification:

- `pnpm check` passes
- `pnpm typecheck` passes
- `pnpm test` passes
- `set CI=true && pnpm test:e2e` passes (full suite including new specs)

#### Manual Verification:

- Spot-check mid-cycle continue path in headed browser
- Confirm test-plan §6.3/§6.6 reads correctly and links match shipped files

---

## Testing Strategy

### Unit Tests:

- `mid-cycle-completion-prompt.test.tsx` — layout variants
- `use-pomodoro-cycle.test.tsx` — mid-cycle continue/end-break; awaiting check-in + submit
- `cycle.test.ts` — `rebindTask` integration

### E2e Tests:

- `mid-cycle-completion.spec.ts` — Risk #3 both branches
- `mid-cycle-last-task.spec.ts` — Risk #3 empty-list edge
- `check-in-gate.spec.ts` — Risk #7 gate + persistence oracle
- `pomodoro-cycle.spec.ts` — S-01 regression with check-in step

### Manual Testing Steps:

1. Phase 1: mid-cycle prompt UX with 1 and 2 tasks
2. Phase 2: check-in appears only after WORK cycle confirm; guest exempt
3. Phase 4: full `CI=true pnpm test:e2e` in clean environment

## Performance Considerations

No meaningful performance impact. E2e specs use existing 1s work cycles and clock advancement pattern from Phase 1.

## Migration Notes

No schema migrations required — `CheckIn` model already exists. New `rebindTask` is additive API only.

## References

- Research: `context/changes/testing-active-slice-browser-proofs/research.md`
- Phase 1 patterns: `context/changes/testing-critical-path-persistence-timer/plan.md`
- Check-in integration: `context/changes/testing-check-in-persistence/research.md`
- Test plan Phase 2 row: `context/foundation/test-plan.md` §3
- S-03 roadmap: `context/foundation/roadmap.md` (S-03)
- S-05 roadmap: `context/foundation/roadmap.md` (S-05)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: S-03 — Mid-Cycle Completion Prompt

#### Automated

- [x] 1.1 `pnpm check` passes — e91c15f
- [x] 1.2 `pnpm typecheck` passes — e91c15f
- [x] 1.3 `pnpm test` passes (including new/extended cycle + hook + component tests) — e91c15f
- [x] 1.4 `pnpm exec vitest run src/server/api/routers/cycle.test.ts` — rebindTask cases pass — e91c15f

#### Manual

- [x] 1.5 Mid-cycle prompt UX verified (2-task and 1-task scenarios) — e91c15f

### Phase 2: S-05 — End-of-Cycle Check-In Gate

#### Automated

- [x] 2.1 `pnpm check` passes — ba5f92a
- [x] 2.2 `pnpm typecheck` passes — ba5f92a
- [x] 2.3 `pnpm test` passes (extended hook tests) — ba5f92a

#### Manual

- [x] 2.4 Check-in gate UX verified (WORK vs break vs guest) — ba5f92a

### Phase 3: E2e Infrastructure

#### Automated

- [x] 3.1 `set CI=true && pnpm test:e2e e2e/pomodoro-cycle.spec.ts` passes — c2b25fe

#### Manual

- [x] 3.2 Updated pomodoro-cycle flows verified in headed mode — c2b25fe

### Phase 4: Browser Proofs & Cookbook

#### Automated

- [x] 4.1 `pnpm check` passes — 623447a
- [x] 4.2 `pnpm typecheck` passes — 623447a
- [x] 4.3 `pnpm test` passes — 623447a
- [x] 4.4 `set CI=true && pnpm test:e2e` passes (full suite) — 623447a

#### Manual

- [x] 4.5 Mid-cycle continue path spot-check; test-plan §6.3/§6.6 review — 623447a
