# Blocked Task Status Implementation Plan

## Overview

Add **blocked** as a fourth task lifecycle state (alongside `active`, `planned`,
`completed`; distinct from `archived`). A blocked task is one the user started but
cannot continue because they are waiting on someone or something. Blocking is
reachable from three surfaces — the task list (Zadania), during a running WORK
cycle (from the same place "Gotowe" is offered), and at session end (the
cycle-complete closure surface) — and mid-cycle blocking hands the session off to
a break exactly as completing the focused task does (the S-50 rhythm). Blocked
tasks leave the wedge suggestion pool until unblocked, and unblock returns them to
active.

This slice is a near-parallel of **S-50** (`complete-task-mid-cycle-surface`),
which added the *completion* exit and its mandatory-break hand-off. S-51 adds the
*block* exit onto the same machinery.

## Current State Analysis

Grounded in code research (four Explore passes, 2026-07-15):

- **Task status is a free-form `String` column, not a Prisma enum.**
  `prisma/schema.prisma:70` — `status String @default("active") @db.VarChar(20)`.
  `"blocked"` (7 chars) fits the 20-char limit, so **no DB migration is required**.
  Every "enum" for status is a TypeScript/Zod construct at the app boundary.
- **`DomainTaskStatus` is `"active" | "completed" | "archived" | "planned"`**
  (`src/lib/data-mode/types.ts:26`). The `TaskRepository.update` input status union
  is narrower — `"active" | "completed" | "planned"` (`types.ts:105`) — deliberately
  excluding `archived`, which is set only via dedicated methods (auto-archive /
  restore), never the general update.
- **Two status-write patterns exist.** `completed` is a normal user-toggled state
  set via the general `task.update` path (router `task.ts:210`, guest
  `guest-repositories.ts:265`). `archived` is system-managed via dedicated methods
  (`stale-task-archive.ts`, `restore`) with a guard rejecting general updates to
  archived tasks (`task.ts:169`, guest `:236`). **Blocked follows the `completed`
  pattern** (user-toggled via `update`).
- **The suggestion candidate pool is a whitelist.**
  `src/lib/suggestion/build-suggestion-pool.ts:39` —
  `SUGGESTION_POOL_STATUSES = ["active", "planned"]`, queried
  `status: { in: [...] }` at `:50`. `blocked` is excluded **by construction**; no
  code change needed, only a defensive test. This is the sole scorer pool path —
  guest mode has no parallel scorer (suggestion is server/tRPC only).
- **The Prisma→domain mapper validates status against an allow-list.**
  `src/lib/persistence/prisma/task-mapper.ts:9` `DOMAIN_TASK_STATUSES`;
  `toDomainTaskStatus` throws in non-prod for unknown values (`:18`). **Without
  adding `blocked` here, any blocked row read from the DB throws in dev.**
- **The guest snapshot Zod enum must include blocked** (`src/lib/guest/schema.ts:16`
  + mirror type `:38`), or guest snapshots containing blocked tasks fail validation
  and are silently discarded on merge.
- **The task list has three tabs** — `TabValue = "active" | "planned" | "completed"`
  (`task-list.tsx:40`), partitioned at `:574-576`, three `TabPanel`s. Status changes
  are hardcoded inline circle buttons (`TaskCompleteButton:118`, revert circle
  `:402`); there is **no status menu**. The detail panel shows a status pill with a
  4-branch label (`task-detail-panel.tsx:130`).
- **S-50's `onCompleteFocusedTask`** (`use-pomodoro-cycle.ts:2901-2977`) is the
  template for mid-cycle blocking. Guard: `state === "running" && cycleKind ===
  "WORK" && activeCycle != null && focusedTaskId != null`. It clears focused-task
  state, stops the worker, sets `state="completed"`, then routes: **guest** →
  `cycles.complete({ markTaskDone: true })` then opens the break-choice gate;
  **authenticated** → defers to check-in (`setAwaitingCheckIn(true)`), which flows
  `submitCheckIn → continueAfterCheckIn → cycles.complete → onChooseBreak →
  startBreakAfterWorkComplete`. `markTaskDone` threads through `pendingMarkTaskDone`.
- **`cycles.complete` counts partial focus minutes only for COMPLETED WORK cycles**
  (`compute-cycle-focused-minutes.ts:12`); `cycles.interrupt` records **zero**. So
  blocking mid-cycle MUST go through `complete`, not `interrupt`.
  **`cycles.complete`'s task-mutation branch is hardcoded to `status: "completed"`**
  when `markTaskDone` (server `cycle.ts:254-258`, guest `guest-repositories.ts:668`).
- **The `/focus` completion circle** with `data-testid="focus-complete-focused-task"`
  lives in `src/app/_components/timer-panel.tsx` (rendered from `pomodoro-dashboard.tsx`
  via the `TimerPanel` prop wiring at `:776-783`). The `/tasks`→`/focus` redirect is in
  `tasks/page.tsx` (`:56-62` auth, `:106-112` guest).
- **The session-end "did you finish the task?" surface is the WORK-variant
  `CycleCompleteOverlay`** (`cycle-complete-overlay.tsx:132-183`): primary
  `onConfirm(true)` (mark done), secondary `onConfirm(false)` (continue later).
  Gated by `wedgeBeat.showCycleComplete` (`pomodoro-dashboard.tsx:1068-1096`). The
  `markTaskDone` boolean threads `onCycleCompleteConfirm (:2988) →
  confirmComplete/completeWorkCycleOnly → cycles.complete`. **No new conductor gate
  is needed** — the blocked choice is a sub-option of the already-shown
  cycle-complete beat.
- **Stale auto-archive** runs on every `list`/`archiveList`
  (`stale-task-archive.ts:58` server `updateMany`; guest `archiveStaleGuestTasks`
  `guest-repositories.ts:143`). Its query currently sweeps stale `active` tasks;
  blocked must be excluded so parked tasks are not silently archived.

## Desired End State

- **Blocked is a real, distinct task state** on both guest and authenticated sides:
  set via `task.update`, read back through the mapper, round-tripped through the
  guest snapshot, and never confused with completed or archived. Verify:
  `pnpm typecheck` clean; router isolation + guest repo tests assert blocked
  round-trips per user.
- **The task list shows a "Zablokowane" tab** with blocked rows; active/planned rows
  carry an inline **block** control; blocked rows carry an inline **unblock**
  control that returns them to active (with a fresh sortOrder so they land at the
  active list's end). Verify: component test drives block → row moves to Zablokowane;
  unblock → row returns to Active with a sortOrder past existing actives.
- **Blocked tasks never appear as suggestions.** Verify: `build-suggestion-pool`
  test asserts a blocked task is excluded from the pool.
- **Blocked tasks are exempt from stale auto-archive.** Verify: a blocked task older
  than the stale threshold is not archived by `list`/`archiveList` (both modes).
- **Blocking the focused task during a running WORK cycle** ends the cycle via
  `cycles.complete` (partial focus minutes counted), marks the task blocked (atomic,
  in the same call), and hands off to the S-50 check-in → break-choice (★) → break
  flow. Verify: hook test asserts block → break flow with the task blocked and
  `focusMinutes > 0`; one belt e2e proves the mid-cycle block→break happy path.
- **Blocking is offered wherever completion is** — the `/focus` circle area and the
  `/tasks`→`/focus` redirect, guarded RUNNING+WORK only.
- **At session end, the cycle-complete overlay offers a third "mark blocked" choice**
  next to done / continue-later, routing through the same `cycles.complete` block
  param. Verify: component test asserts the third button fires the blocked fate;
  hook test asserts the fate reaches `cycles.complete`.

### Key Discoveries:

- Suggestion exclusion is free (whitelist) — `build-suggestion-pool.ts:39`.
- No DB migration — `status` is `VARCHAR(20)` free-form (`schema.prisma:70`).
- The mapper allow-list (`task-mapper.ts:9`) and guest Zod (`schema.ts:16`) are the
  two silent-failure traps if `blocked` is omitted.
- `cycles.complete` (not `interrupt`) is mandatory for focus-minute accounting;
  its task branch is hardcoded to `completed` and must be generalized.
- The session-end blocked choice reuses the existing `cycle_complete` gate — the
  work is widening the `onConfirm` fate, not adding a gate.
- S-50's `onCompleteFocusedTask` (`use-pomodoro-cycle.ts:2901`) and the break chain
  (`continueAfterCheckIn:2631`, `onChooseBreak:2800`,
  `startBreakAfterWorkComplete:2278`) are the exact template to parallel.

## What We're NOT Doing

- **No "waiting on what" note** — blocked is a bare state this slice (resumeNote
  reuse deferred to a possible follow-up).
- **No DB migration / no Prisma enum conversion** — the free-form String column
  already accepts the value.
- **No blocking from a PAUSED cycle** — mid-cycle blocking is RUNNING+WORK only,
  matching S-50's `onCompleteFocusedTask` guard exactly. (A paused user can still
  block from the list as a plain status change.)
- **No confirmation dialog** — blocking applies immediately (fully reversible via
  unblock); no extra overlay/gate.
- **No recap / Podsumowanie changes** — blocked is not reported separately in the
  daily recap this slice (natural S-48 analytics follow-up).
- **No new transition-conductor gate** — the session-end blocked choice is a
  sub-option of the existing `cycle_complete` beat.
- **No change to break durations or the `%4` cadence** — the mid-cycle block reuses
  S-50's break chooser and cadence unchanged.
- **No new suggestion-pool blocklist** — the existing whitelist already excludes
  blocked.

## Implementation Approach

Build the status **foundation first** (Phase 1) so every later surface has a real
blocked state to write and read on both data modes. Add the **task-list surface**
(Phase 2), which depends only on the foundation and delivers block/unblock without
touching the timer hub. Then generalize **`cycles.complete`** to carry a block
outcome atomically (Phase 3) — the shared contract that both cycle-driven surfaces
need. Finally wire the two timer-hub surfaces: **mid-cycle block** (Phase 4,
mirroring S-50) and the **session-end blocked fate** (Phase 5).

`use-pomodoro-cycle.ts`, `pomodoro-dashboard.tsx`, and `timer-panel.tsx` are
high-blast-radius timer-hub files: run
`pnpm change-impact src/hooks/use-pomodoro-cycle.ts` before Phase 4 and heed its
co-change/test suggestions (AGENTS.md "Maintainer tooling", CLAUDE.md wedge notes).

Both data modes must move together at each seam — a guest-only or server-only
implementation compiles but fails silently (the repository interface hides the gap).

## Critical Implementation Details

- **Silent-failure traps (Phase 1):** three seams throw or discard rather than
  compile-error if `blocked` is omitted. (1) `task-mapper.ts:18` throws in non-prod
  when reading a `blocked` DB row not in `DOMAIN_TASK_STATUSES`. (2)
  `guest/schema.ts:16` Zod `z.enum` rejects `blocked`, so a guest snapshot with a
  blocked task fails validation and is discarded on merge. (3) The `TaskRepository.update`
  input union, the router `z.enum` (`task.ts:139`), and `server-repositories.ts:38`
  each independently gate whether `blocked` is even accepted — all three must gain it.
- **Focus-minute accounting is load-bearing (Phases 3-4):** mid-cycle blocking MUST
  end the WORK cycle through `cycles.complete` (sets `state=COMPLETED`, `endedAt`,
  passes `localDateKey` via `withWorkDayPlanKey`), never `cycles.interrupt`.
  `computeCycleFocusedMinutes` counts partial minutes only for COMPLETED WORK cycles;
  an interrupted cycle records zero. This is why Phase 3 generalizes `complete`
  rather than routing block through `interrupt`.
- **Atomicity of block-on-complete (Phase 3):** the block outcome must live *inside*
  `cycles.complete` (one server transaction sets the cycle COMPLETED **and** the task
  `blocked`), not as a second `task.update` after completion — otherwise the cycle can
  complete (minutes counted) while the block write fails, leaving an active task with
  counted minutes and no rollback path. Model it on how `markTaskDone` already lives
  inside `complete`.
- **Outcome discriminator, mutual exclusion (Phases 3-5):** `markTaskDone` and the new
  block outcome are mutually exclusive on `cycles.complete`. Whether modeled as a new
  `markTaskBlocked?: boolean` or a `taskOutcome?: "done" | "blocked"` discriminator is
  the implementer's call, but the same param must serve BOTH the mid-cycle block
  (Phase 4) and the session-end blocked fate (Phase 5). Prefer the discriminator so
  the three-way session-end fate maps cleanly.
- **Dismiss-oracle per gate (Phase 4, L-05):** the mid-cycle block reuses the S-50
  break-choice gate. Per the "test every wedge transition" lesson, the block→break
  path needs its own hook test asserting the gate opens, accepts the break choice, and
  closes — not just that S-50's completion path still works.
- **Reactivation sortOrder (Phases 1-2):** unblocking (blocked→active) must assign a
  fresh sortOrder so the task lands at the end of the active list, mirroring the
  existing completed→active reactivation logic (`task.ts:186-194`, guest
  `guest-repositories.ts:242-251`). Do NOT let a reactivated task keep a stale
  sortOrder that interleaves it into the middle of the active list.

---

## Phase 1: Blocked status foundation (types, persistence, repositories — both modes)

### Overview

Introduce `blocked` as a first-class status across the type system, the general
`task.update` write path (both guest and server), the Prisma↔domain mapper, and the
guest snapshot schema; exempt blocked tasks from stale auto-archive; and lock the
suggestion-pool exclusion with a test.

### Changes Required:

#### 1. Domain + repository status types

**File**: `src/lib/data-mode/types.ts`

**Intent**: Make `blocked` a known status and an accepted `update` input.

**Contract**: Add `"blocked"` to `DomainTaskStatus` (`:26`) and to the
`TaskRepository.update` input `status?` union (`:105`). Leave `archived` out of the
update union as today (blocked follows the `completed` user-toggled pattern).

#### 2. Task router — accept and persist blocked

**File**: `src/server/api/routers/task.ts`

**Intent**: Let the general `update` procedure accept `blocked` and handle the
blocked→active reactivation sortOrder like completed→active.

**Contract**: Add `"blocked"` to the `status` `z.enum` (`:139`). Ensure the
reactivation branch that bumps sortOrder on `→ active` (`:186-194`) also fires when
the previous status was `blocked`. Blocked is a plain `ctx.db.task.update` write
(`:210`); it is NOT subject to the archived guard (`:169`). Do not add blocked to
`nextActiveSortOrder`/`reorder`/`markDoneForToday` active-only filters.

#### 3. Server repository input type

**File**: `src/lib/repositories/server-repositories.ts`

**Intent**: Widen the wrapper's update input so callers can request blocked.

**Contract**: Add `"blocked"` to `UpdateTaskInput.status` (`:38`). The forwarder
(`:136`) is unchanged.

#### 4. Guest repository — accept and persist blocked

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Mirror the server update semantics for guest mode.

**Contract**: The status spread (`:265`) already forwards `input.status`; ensure the
reactivation sortOrder branch (`:242-251`) treats `blocked → active` like
`completed/planned → active`. `toDomainTask`'s blind cast (`:50`) is fine once the
mapper/union know `blocked`.

#### 5. Prisma↔domain mapper allow-list

**File**: `src/lib/persistence/prisma/task-mapper.ts`

**Intent**: Prevent the mapper from throwing on a `blocked` DB row.

**Contract**: Add `"blocked"` to `DOMAIN_TASK_STATUSES` (`:9`) so `toDomainTaskStatus`
(`:18`) accepts it.

#### 6. Guest snapshot schema + type

**File**: `src/lib/guest/schema.ts`

**Intent**: Allow blocked tasks to survive guest persistence and account merge.

**Contract**: Add `"blocked"` to the status `z.enum` (`:16`) and the mirror TS type
(`:38`). `import-guest-snapshot.ts:64` forwards status straight through, so no change
there once the schema accepts it.

#### 7. Exempt blocked from stale auto-archive

**File**: `src/lib/task/stale-task-archive.ts`, `src/lib/repositories/guest-repositories.ts`

**Intent**: Blocked tasks must not be swept into the stale archive while parked.

**Contract**: The server `updateMany` staleness query (`stale-task-archive.ts:58`)
and the guest `archiveStaleGuestTasks` (`guest-repositories.ts:143`) already target
stale `active` tasks — confirm blocked is not caught (if the query filters
`status: "active"` it is already safe; if it filters "not archived/completed", add a
`blocked` exclusion). Add/extend a test proving a stale blocked task is left alone.

#### 8. Tests — isolation, guest round-trip, suggestion exclusion

**File**: `src/server/api/routers/task-isolation.test.ts` (or the existing task
router test), a guest-repositories test, `src/lib/suggestion/build-suggestion-pool.test.ts`

**Intent**: Guard the new state end-to-end on both modes and the scorer boundary.

**Contract**: Assert (a) a task can be set to `blocked` and read back per-user
(isolation pattern); (b) guest update to `blocked` round-trips through
`toDomainTask` and the snapshot schema; (c) `buildSuggestionPool` excludes a
`blocked` task; (d) unblock (blocked→active) assigns a sortOrder past existing
actives on both modes.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] Task router + isolation tests pass: `pnpm exec vitest run src/server/api/routers/task.test.ts src/server/api/routers/task-isolation.test.ts`
- [ ] Guest repository tests pass: `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts`
- [ ] Suggestion-pool exclusion test passes: `pnpm exec vitest run src/lib/suggestion/build-suggestion-pool.test.ts`
- [ ] Mapper test accepts blocked: `pnpm exec vitest run src/lib/persistence/prisma/task-mapper.test.ts`

#### Manual Verification:

- [ ] Setting a task blocked via the update path persists and re-reads as blocked (both guest and signed-in) with no dev-mode mapper throw.
- [ ] A stale (3+ day) blocked task is not auto-archived on list load.

**Implementation Note**: After automated verification passes, pause for human
confirmation of manual testing before Phase 2. Phase blocks use plain bullets — the
`- [ ]` checkboxes live in the `## Progress` section.

---

## Phase 2: Task list — "Zablokowane" tab + block/unblock controls

### Overview

Surface blocked as a distinct tab in the task list, add an inline block control to
active/planned rows and an inline unblock control to blocked rows, and show the
blocked state in the task detail pill.

### Changes Required:

#### 1. Partition + tab for blocked

**File**: `src/app/_components/task-list.tsx`

**Intent**: Give blocked its own tab and row group.

**Contract**: Extend `TabValue` (`:40`) with `"blocked"`; add a `blockedTasksAll`
partition (`:574-576`); add the tab item (`:659-672`) and a `TabPanel` (near
`:823/:850/:867`) rendering blocked rows as `StaticTaskRow` (non-draggable, own
styling), with empty-state copy.

#### 2. Inline block control on active/planned rows

**File**: `src/app/_components/task-list.tsx`

**Intent**: Let the user block a task directly from the list.

**Contract**: Add a block icon-button to the row (near the existing
`TaskCompleteButton:118` pattern) that calls `onUpdateTask({ id, status: "blocked" })`.
Immediate, no confirm. Shown on active and planned rows; not on completed/blocked.

#### 3. Inline unblock control on blocked rows

**File**: `src/app/_components/task-list.tsx`

**Intent**: Return a blocked task to active.

**Contract**: Add an unblock affordance on blocked rows (mirroring the completed→active
revert circle `:402`) calling `onUpdateTask({ id, status: "active" })`; the Phase-1
reactivation sortOrder bump handles placement.

#### 4. Detail panel status pill

**File**: `src/app/_components/task-detail-panel.tsx`

**Intent**: Show blocked in the status pill.

**Contract**: Add a `blocked` branch to the 4-branch status label (`:130-137`) with
its own styling.

#### 5. Copy

**File**: `messages/pl.json`, `messages/en.json`

**Intent**: Localize the tab, controls, empty state, and status label.

**Contract**: Add keys — tab label ("Zablokowane"), block/unblock button aria-labels,
`blockedEmpty` empty state, `statusBlocked` pill label — in both locales via next-intl.

#### 6. Component tests

**File**: `src/app/_components/task-list.test.tsx`, `src/app/_components/task-detail-panel.test.tsx`

**Intent**: Guard the tab and the block/unblock controls.

**Contract**: Assert blocking moves a row into the Zablokowane tab; unblocking returns
it to Active; the block control is absent on completed/blocked rows; the detail pill
renders the blocked label.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] Task-list component tests pass: `pnpm exec vitest run src/app/_components/task-list.test.tsx`
- [ ] Detail-panel test passes: `pnpm exec vitest run src/app/_components/task-detail-panel.test.tsx`

#### Manual Verification:

- [ ] Blocking a task from the list moves it into the Zablokowane tab; it disappears from Active.
- [ ] Unblocking returns it to Active at the end of the list.
- [ ] A blocked task never appears as the next-task suggestion (FocusReady star).

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: `cycles.complete` block outcome param (atomic block-on-complete)

### Overview

Generalize `cycles.complete` so a completing WORK cycle can mark its task `blocked`
(instead of `done`) in the same transaction, preserving partial-focus-minute
accounting. This is the shared contract Phases 4 and 5 both consume.

### Changes Required:

#### 1. CycleRepository interface

**File**: `src/lib/data-mode/types.ts`

**Intent**: Add the block outcome to the `complete` contract.

**Contract**: Extend `CycleRepository.complete` input (`:135`) with a mutually
exclusive block outcome — preferred shape `taskOutcome?: "done" | "blocked"`
(replacing/superseding `markTaskDone` at the type level, or an additive
`markTaskBlocked?: boolean`). Keep `incrementInterruption`/`localDateKey` as-is.

#### 2. Cycle router — mark task blocked on complete

**File**: `src/server/api/routers/cycle.ts`, `src/server/api/routers/cycle.test.ts`

**Intent**: Persist the blocked task status inside the complete transaction while
still counting focus minutes.

**Contract**: In `complete` (`:214-302`), generalize the hardcoded task write
(`:254-258`, currently `status: "completed"`) so a `blocked` outcome sets
`status: "blocked"` instead. Keep the cycle→COMPLETED transition (`:244`), the
`computeCycleFocusedMinutes`/`incrementUsedFocusMinutes` block (`:261-280`), and the
optional interruption increment (`:286-288`) unchanged — they run regardless of
task outcome. Extend the Zod input for the new param. Add tests: blocked outcome sets
the task blocked AND records `focusMinutes > 0`.

#### 3. Guest cycle repository

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Mirror the server block-on-complete for guest mode.

**Contract**: In guest `complete` (`:660-695`), generalize the task-status write
(`:668-679`, currently `completed`) to honor the `blocked` outcome. Cycle→COMPLETED
unchanged.

#### 4. Server repository wrapper

**File**: `src/lib/repositories/server-repositories.ts`

**Intent**: Forward the new param through the tRPC wrapper.

**Contract**: Thread the block outcome through the `cycles.complete` wrapper and its
`TrpcClient` type.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] Cycle router tests pass (blocked outcome marks task blocked + counts focus minutes): `pnpm exec vitest run src/server/api/routers/cycle.test.ts`
- [ ] Guest repository cycle tests pass: `pnpm exec vitest run src/lib/repositories/guest-repositories.test.ts`
- [ ] Focus-minute accounting unchanged: `pnpm exec vitest run src/lib/recap/compute-cycle-focused-minutes.test.ts`

#### Manual Verification:

- [ ] N/A (internal contract; behavior proven via Phases 4-5 manual checks).

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Mid-cycle block → break hand-off (mirror S-50)

### Overview

Add `onBlockFocusedTask` to the timer hub — a parallel of S-50's
`onCompleteFocusedTask` — that ends the running WORK cycle via the Phase-3 block
outcome and hands off to the check-in → break-choice (★) → break flow, plus the
`/focus` and `/tasks` triggers.

**Pre-step**: run `pnpm change-impact src/hooks/use-pomodoro-cycle.ts` and heed its
co-change/test suggestions before editing.

### Changes Required:

#### 1. `onBlockFocusedTask` handler + block outcome threading

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Block the focused task mid-cycle and enter the mandatory-break flow,
mirroring `onCompleteFocusedTask` but marking the task blocked, not done.

**Contract**: New `onBlockFocusedTask()` guarded identically to
`onCompleteFocusedTask` (`:2902-2909`) — `state === "running" && cycleKind ===
"WORK" && activeCycle != null && focusedTaskId != null`. Reuse the same optimistic
setup (clear focused-task state, stop worker, `state="completed"`). Thread a block
outcome parallel to `pendingMarkTaskDone` (e.g. a `pendingTaskOutcome`
discriminator) through `submitCheckIn (:3022) → continueAfterCheckIn (:2631) →
onChooseBreak (:2800) → startBreakAfterWorkComplete (:2278)`, terminating the same
break-choice gate. Guest path calls `cycles.complete` with the block outcome directly
then opens the gate (as `onCompleteFocusedTask:2925-2944` does). Authenticated path
defers to check-in. Export the handler.

#### 2. `/focus` block affordance

**File**: `src/app/_components/timer-panel.tsx`, `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Offer "block" beside the focused-task complete circle during a running
WORK cycle.

**Contract**: Add an `onBlockFocusedTask` prop to `TimerPanel` and a block affordance
(restrained per DESIGN.md) with `data-testid="focus-block-focused-task"`, disabled
while submitting. Wire it in `pomodoro-dashboard.tsx` through the same RUNNING+WORK
conditional as the complete circle (`:776-783`).

#### 3. Task-list mid-cycle block trigger + `/tasks`→`/focus` redirect

**File**: `src/app/_components/task-list.tsx`, `src/app/tasks/page.tsx`

**Intent**: Blocking the focused task from the list during a running cycle routes
into the break flow on `/focus`, like S-50's mid-cycle completion.

**Contract**: During a running WORK cycle, the focused task's block control invokes a
new `onMidCycleBlock(taskId, task)` handler (only for `task.id === focusedTaskId`,
mirroring `canMidCycleMarkComplete` `:613-616`); non-focused rows use the plain
Phase-2 `onUpdateTask({status:"blocked"})` path. In `tasks/page.tsx`, wire
`onMidCycleBlock` to call `pomodoro.onBlockFocusedTask()` then `router.push("/focus")`
(both auth `:56-62` and guest `:106-112`).

#### 4. Hook + component tests, one belt e2e

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`, `src/app/_components/timer-panel.test.tsx`, `e2e/mid-cycle-block.spec.ts` (new)

**Intent**: Guard the block→break state machine and prove the headline flow in a
real browser.

**Contract**: Hook tests assert (a) mid-cycle block completes the cycle with the task
blocked and `focusMinutes > 0`; (b) the break-choice gate opens, accepts the choice,
and closes (dismiss-oracle, L-05); (c) the RUNNING+WORK guard rejects paused/idle.
Component test asserts the `/focus` block affordance calls the handler and is disabled
while submitting. One belt e2e (`<15s`, per L-06) proves mid-cycle block → break
starts. Follow L-06 (no fake clock unless time advances) for the e2e.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] Hook tests pass (block→break, gate dismiss-oracle, guard): `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [ ] Timer-panel component test passes: `pnpm exec vitest run src/app/_components/timer-panel.test.tsx`
- [ ] Mid-cycle block e2e passes: `pnpm exec playwright test e2e/mid-cycle-block.spec.ts`
- [ ] `pnpm change-impact` co-change/test suggestions addressed

#### Manual Verification:

- [ ] On `/focus`, blocking the focused task during a running cycle ends the cycle into check-in → break chooser (★) → break; the task shows blocked afterward.
- [ ] Blocking from `/tasks` (focused task) redirects to `/focus` and plays the same gates; a non-focused block stays put with no session change.
- [ ] The day recap Focus-time reflects the partial minutes spent before blocking (not zero).

**Implementation Note**: Pause for human confirmation before Phase 5.

---

## Phase 5: Session-end blocked fate (CycleCompleteOverlay third option)

### Overview

Add a third "mark blocked" choice to the WORK-variant cycle-complete overlay,
widening the fate carried from that surface into `cycles.complete` — no new gate.

### Changes Required:

#### 1. Three-way fate in the cycle-complete overlay

**File**: `src/app/_components/cycle-complete-overlay.tsx`

**Intent**: Offer done / continue-later / blocked at cycle close.

**Contract**: Widen the WORK variant (`:132-183`) from `onConfirm(markTaskDone:
boolean)` to a three-way fate (`"done" | "keep" | "blocked"`). Add a third button
beside `workMarkComplete`/`workContinueLater` (`:157-175`) with its own testid; keep
`onEscape` → `"keep"`.

#### 2. Thread the fate through the hook

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Route the blocked fate to the Phase-3 block outcome.

**Contract**: Widen `onCycleCompleteConfirm` (`:2988`) and the downstream
`confirmComplete`/`completeWorkCycleOnly` (`:2474`/`:2399`) from the `markTaskDone`
boolean to the fate, mapping `blocked` to the Phase-3 `cycles.complete` block outcome
and `keep` to no task write. Reuse the existing `pendingTaskOutcome` threading from
Phase 4 where the fate defers through check-in.

#### 3. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass the three-way fate from the overlay to the hook.

**Contract**: Update the `onConfirm` wiring (`:1074-1089`) to forward the fate;
preserve the existing daily-standing `markDoneForToday` branch for the `done` fate.

#### 4. Copy

**File**: `messages/pl.json`, `messages/en.json`

**Intent**: Localize the third button.

**Contract**: Add the blocked-choice label/aria in both locales.

#### 5. Component + hook tests

**File**: `src/app/_components/cycle-complete-overlay.test.tsx`, `src/hooks/use-pomodoro-cycle.test.tsx`, `src/app/_components/pomodoro-dashboard.test.tsx`

**Intent**: Guard the third choice and its routing.

**Contract**: Overlay test asserts the blocked button fires the blocked fate and the
overlay dismisses (dismiss-oracle). Hook test asserts the blocked fate reaches
`cycles.complete` with the block outcome. Dashboard test asserts the overlay renders
the three options for a WORK cycle.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] Overlay test passes (blocked button + dismiss-oracle): `pnpm exec vitest run src/app/_components/cycle-complete-overlay.test.tsx`
- [ ] Hook test passes (blocked fate → cycles.complete block outcome): `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- [ ] Dashboard test passes (three-option WORK overlay): `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- [ ] Full suite passes: `pnpm test`
- [ ] Belt e2e passes: `pnpm test:e2e:belt`

#### Manual Verification:

- [ ] At cycle close (session-end closure), the overlay offers a third "mark blocked" choice; picking it blocks the focused task and dismisses the overlay.
- [ ] The blocked task leaves the suggestion pool and appears in the Zablokowane tab.
- [ ] Done and continue-later still behave exactly as before.

**Implementation Note**: Pause for human confirmation; this is the final phase.

---

## Testing Strategy

### Unit Tests:

- `build-suggestion-pool`: a blocked task is excluded from the candidate pool.
- `task-mapper`: `blocked` round-trips; unknown status still throws.
- Cycle router / guest repo: block outcome on `complete` sets task blocked AND counts
  partial focus minutes; `markTaskDone` path unchanged.
- Hook (`use-pomodoro-cycle`): mid-cycle block → break flow; break-choice gate
  dismiss-oracle; RUNNING+WORK guard; session-end blocked fate → `cycles.complete`.

### Integration Tests:

- Task router isolation: blocked status is per-user isolated (both set + read).
- Guest ↔ authenticated parity for block/unblock and block-on-complete.

### Manual Testing Steps:

1. From `/tasks`, block an active task → moves to Zablokowane; unblock → returns to Active at the end.
2. Confirm a blocked task never surfaces as the FocusReady suggestion.
3. Start a WORK cycle, block the focused task from `/focus` → check-in (auth) → break chooser (★) → break; task shows blocked; recap Focus-time reflects partial minutes.
4. Repeat the block from `/tasks` → redirected to `/focus`, same gates.
5. At cycle close, pick the third "mark blocked" choice → task blocked, overlay dismisses.
6. Leave a blocked task untouched 3+ days → it is NOT auto-archived.

## Performance Considerations

None beyond existing timer-hub constraints. Block-on-complete adds no network
round-trip (it rides the existing `cycles.complete` call); the task-list tab adds one
partition. The 200ms per-surface NFR (L-04) applies to the new block/unblock controls
— they use the existing optimistic `task.update` path, so they inherit its
optimism; verify no new pessimistic blocking on those controls.

## Migration Notes

No data migration — `status` is a free-form `VARCHAR(20)` column that already accepts
`"blocked"`. Existing tasks, sessions, and guest snapshots are unaffected (the value
is additive). Guest blob merge is unchanged (blocked survives once the snapshot Zod
accepts it).

## References

- Roadmap slice: `context/foundation/roadmap-references/items/S-51.md`; PRD US-06
  (`context/foundation/prd.md:148`), blocked-tasks constraint (`prd.md:210`).
- Direct template — S-50: `context/archive/2026-07-06-complete-task-mid-cycle-surface/plan.md`.
- Break machinery: `src/hooks/use-pomodoro-cycle.ts:2278,2631,2800,2901`.
- Suggestion pool: `src/lib/suggestion/build-suggestion-pool.ts:39`.
- Complete accounting: `src/server/api/routers/cycle.ts:214`, `src/lib/recap/compute-cycle-focused-minutes.ts:9`.
- Cycle-complete surface: `src/app/_components/cycle-complete-overlay.tsx:132`.
- Lessons: L-04 (200ms per surface), L-05 (test every wedge transition — dismiss-oracle per gate), L-06 (hook-first, e2e <15s), L-07 (suggestion surfaces only via FocusReady star).

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Blocked status foundation

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 1ab6f17
- [x] 1.2 Lint/format passes: `pnpm check` — 1ab6f17
- [x] 1.3 Task router + isolation tests pass — 1ab6f17
- [x] 1.4 Guest repository tests pass — 1ab6f17
- [x] 1.5 Suggestion-pool exclusion test passes — 1ab6f17
- [x] 1.6 Mapper test accepts blocked — 1ab6f17

#### Manual

- [x] 1.7 Blocked status persists and re-reads on both modes, no mapper throw — 1ab6f17
- [x] 1.8 Stale blocked task is not auto-archived on list load — 1ab6f17

### Phase 2: Task list — Zablokowane tab + block/unblock controls

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck`
- [x] 2.2 Lint/format passes: `pnpm check`
- [x] 2.3 Task-list component tests pass
- [x] 2.4 Detail-panel test passes

#### Manual

- [ ] 2.5 Blocking from the list moves the task into the Zablokowane tab
- [ ] 2.6 Unblocking returns it to Active at the end of the list
- [ ] 2.7 A blocked task never appears as the next-task suggestion

### Phase 3: `cycles.complete` block outcome param

#### Automated

- [ ] 3.1 Type checking passes: `pnpm typecheck`
- [ ] 3.2 Lint/format passes: `pnpm check`
- [ ] 3.3 Cycle router tests pass (blocked outcome + focus minutes)
- [ ] 3.4 Guest repository cycle tests pass
- [ ] 3.5 Focus-minute accounting unchanged

### Phase 4: Mid-cycle block → break hand-off

#### Automated

- [ ] 4.1 Type checking passes: `pnpm typecheck`
- [ ] 4.2 Lint/format passes: `pnpm check`
- [ ] 4.3 Hook tests pass (block→break, gate dismiss-oracle, guard)
- [ ] 4.4 Timer-panel component test passes
- [ ] 4.5 Mid-cycle block e2e passes
- [ ] 4.6 `pnpm change-impact` co-change/test suggestions addressed

#### Manual

- [ ] 4.7 `/focus` block ends the cycle into check-in → break chooser → break; task shows blocked
- [ ] 4.8 `/tasks` focused block redirects to `/focus` and gates play; non-focused block stays put
- [ ] 4.9 Day recap Focus-time reflects partial minutes before blocking

### Phase 5: Session-end blocked fate

#### Automated

- [ ] 5.1 Type checking passes: `pnpm typecheck`
- [ ] 5.2 Lint/format passes: `pnpm check`
- [ ] 5.3 Overlay test passes (blocked button + dismiss-oracle)
- [ ] 5.4 Hook test passes (blocked fate → cycles.complete block outcome)
- [ ] 5.5 Dashboard test passes (three-option WORK overlay)
- [ ] 5.6 Full suite passes: `pnpm test`
- [ ] 5.7 Belt e2e passes: `pnpm test:e2e:belt`

#### Manual

- [ ] 5.8 Cycle-close overlay offers a third "mark blocked" choice; picking it blocks the task and dismisses
- [ ] 5.9 The blocked task leaves the suggestion pool and appears in Zablokowane
- [ ] 5.10 Done and continue-later behave exactly as before
