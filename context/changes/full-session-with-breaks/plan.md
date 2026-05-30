# Full Session with Breaks Implementation Plan

## Overview

Extend the working single-cycle Pomodoro (S-01) into a multi-cycle session with auto-started short/long breaks, configurable break durations, explicit session end, and a 4-hour inactivity timeout. After this plan, a user can run a full Pomodoro session: work → short break → work → short break → work → short break → work → long break, end the session at any time, and have stale sessions closed automatically.

## Current State Analysis

- **Schema ready:** `CycleKind` enum has `WORK | SHORT_BREAK | LONG_BREAK`; `SessionState` has `ACTIVE | ENDED_BY_USER | ENDED_BY_TIMEOUT`; `Session.lastActivityAt` and `Session.endedAt` fields exist. None are used in practice.
- **Cycle router accepts break kinds:** `cycle.create` already validates `kind: z.enum(["WORK", "SHORT_BREAK", "LONG_BREAK"])` — the server is ready for break cycles.
- **Client hardcodes `kind: "WORK"`:** The `usePomodoroCycle` hook always passes `kind: "WORK"` to `cycles.create()` and resets to idle after `confirmComplete`.
- **No session end logic:** No `session.end` mutation exists. `SessionRepository` interface only has `getOrCreateActive()`.
- **No `lastActivityAt` updates on server:** The guest repo updates it on cycle create, but the authenticated cycle router never touches it.
- **Break duration config absent:** Only work duration is stored in `duration-storage.ts`.
- **Timer infrastructure reusable:** The Web Worker timer, `startWorker`/`stopWorker`, and `resumeFromActiveCycle` all work with any `CycleKind` — they only care about `startedAt` + `configuredDurationSec`.

### Key Discoveries:

- `src/server/api/routers/cycle.ts:50-90` — `cycle.create` already accepts `kind` and `configuredDurationSec` for any cycle type
- `src/server/api/lib/active-session.ts` — `findOrCreateActiveSession` is the natural place to add the inactivity check (it runs on every cycle start)
- `src/hooks/use-pomodoro-cycle.ts:300-320` — `start()` hardcodes `kind: "WORK"` — this is the single point to change for break cycle creation
- `src/hooks/use-pomodoro-cycle.ts:340-370` — `confirmComplete()` resets to idle — this is where the break auto-start transition belongs
- `src/lib/data-mode/types.ts:70-80` — `CycleRepository.create` already accepts `kind` parameter — no interface change needed
- `src/lib/data-mode/types.ts:85-87` — `SessionRepository` needs an `end()` method added
- `src/app/_components/cycle-complete-overlay.tsx` — Only shows "mark done" / "continue later" — needs a break-end variant

## Desired End State

A logged-in user (or guest) can:
1. Start a work cycle on a selected task (existing S-01 behavior, unchanged)
2. When the work cycle ends, confirm the transition → a break timer starts automatically
3. See a visually distinct break timer (calming color scheme, "Short Break" / "Long Break" label)
4. When the break ends, hear the audio chime and see an overlay prompting them to pick a task for the next work cycle
5. After every 4th completed work cycle, get a long break instead of a short break
6. Configure short break (default 5 min, range 1–30) and long break (default 15 min, range 1–30) durations that persist in localStorage
7. Click "End session" at any time to close the session and return to pre-session state
8. Have a stale session (>4h since last cycle activity) automatically ended when they next interact

Verification: run `pnpm test`, `pnpm check`, `pnpm typecheck`, and the e2e suite (`pnpm test:e2e`) covering a multi-cycle flow with break transitions.

## What We're NOT Doing

- No check-in prompt at cycle end (that's S-05)
- No task suggestion after break (that's S-06)
- No mid-cycle task completion prompt (that's S-03)
- No configurable "cycles before long break" count — hardcoded to 4 per standard Pomodoro
- No session history UI or analytics
- No server-side scheduled job for timeout — purely checked on next activity

## Implementation Approach

Layer the changes bottom-up: server mutations first (session end + lastActivityAt), then break config storage, then the client state machine that orchestrates work→break→work transitions, and finally the session-end UI. Each phase is independently testable.

## Phase 1: Server — session lifecycle and lastActivityAt

### Overview

Add the missing server-side session lifecycle: an `end` mutation, `lastActivityAt` updates on cycle mutations, and an inactivity check in `findOrCreateActiveSession` that auto-closes stale sessions.

### Changes Required:

#### 1. Session end mutation

**File**: `src/server/api/routers/session.ts`

**Intent**: Add an `end` mutation that transitions the active session to `ENDED_BY_USER` with an `endedAt` timestamp. Only the owning user can end their own active session.

**Contract**: `session.end` — no input required (ends the user's current active session). Returns the updated session. Throws `NOT_FOUND` if no active session exists.

#### 2. Update lastActivityAt on cycle mutations

**File**: `src/server/api/routers/cycle.ts`

**Intent**: After every successful `create`, `complete`, and `interrupt` mutation, update the parent session's `lastActivityAt` to `new Date()`. This keeps the inactivity timer accurate.

**Contract**: Inside each mutation's transaction (or after the main write for `create`), call `db.session.update({ where: { id: sessionId }, data: { lastActivityAt: new Date() } })`. No return value change.

#### 3. Inactivity check in findOrCreateActiveSession

**File**: `src/server/api/lib/active-session.ts`

**Intent**: When an existing ACTIVE session is found, check if `lastActivityAt` is older than 4 hours. If so, end it (`state: ENDED_BY_TIMEOUT`, `endedAt: now`) and create a fresh session. This is the server-authoritative timeout — no background job needed.

**Contract**: `findOrCreateActiveSession(db, userId)` behavior changes: if the found session's `lastActivityAt + 4h < now`, update it to `ENDED_BY_TIMEOUT` and fall through to create a new one. The 4h constant should be exported as `SESSION_INACTIVITY_TIMEOUT_MS = 4 * 60 * 60 * 1000`.

#### 4. Extend SessionRepository interface and implementations

**File**: `src/lib/data-mode/types.ts`

**Intent**: Add `end(): Promise<DomainSession>` to the `SessionRepository` interface so both guest and authenticated modes can end sessions.

**Contract**: `SessionRepository.end()` — ends the current active session and returns the ended session. Throws if no active session.

**File**: `src/lib/repositories/server-repositories.ts`

**Intent**: Implement `end()` by calling the new `session.end` tRPC mutation.

**File**: `src/lib/repositories/guest-repositories.ts`

**Intent**: Implement `end()` by finding the active session in the localStorage snapshot and transitioning it to `ENDED_BY_USER`.

#### 5. Wire session.end in data-mode-context

**File**: `src/lib/data-mode/data-mode-context.tsx`

**Intent**: Expose the new `session.end` mutation in the authenticated client object so `createServerSessionRepository` can call it.

**Contract**: Add `session.end.mutate` to the client object, delegating to `utils.client.session.end.mutate()`.

### Success Criteria:

#### Automated Verification:

- `pnpm typecheck` passes with new interface method
- `pnpm check` (Biome) passes
- Unit tests for `session.end` mutation (happy path + NOT_FOUND when no active session)
- Unit tests for `lastActivityAt` update on cycle create/complete/interrupt
- Unit test for inactivity timeout in `findOrCreateActiveSession` (session older than 4h gets ended, new one created)
- Existing cycle and session tests still pass: `pnpm test`

#### Manual Verification:

- Call `session.end` via tRPC caller in a test script and verify DB state transitions correctly
- Verify that starting a cycle after 4h inactivity creates a new session (integration test with mocked time)

---

## Phase 2: Break duration configuration

### Overview

Extend the localStorage-based duration config to include short break and long break durations, and add UI controls for configuring them.

### Changes Required:

#### 1. Extend duration-storage module

**File**: `src/lib/duration-storage.ts`

**Intent**: Add `getShortBreakDuration()` / `setShortBreakDuration(sec)` and `getLongBreakDuration()` / `setLongBreakDuration(sec)` following the same pattern as the existing work duration functions. Defaults: 5 min short, 15 min long. Range: 1–30 min (60–1800 sec).

**Contract**: Same API shape as existing `getLastDuration` / `setLastDuration` — reads/writes localStorage with clamping and fallback to defaults. Export `DEFAULT_SHORT_BREAK_SEC = 5 * 60` and `DEFAULT_LONG_BREAK_SEC = 15 * 60`.

#### 2. Break duration UI controls

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: Add a small expandable "Break settings" section below the work duration presets (visible only in idle state). Shows short break and long break duration inputs (number inputs, 1–30 min range). Changes persist immediately to localStorage.

**Contract**: Renders when `state === "idle"` and a task is focused. Uses the new getter/setter functions from `duration-storage.ts`. Does not affect the timer's running/completed states.

### Success Criteria:

#### Automated Verification:

- Unit tests for `getShortBreakDuration` / `setShortBreakDuration` / `getLongBreakDuration` / `setLongBreakDuration` (defaults, clamping, invalid input)
- `pnpm typecheck` passes
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification:

- Break duration controls are visible in the timer panel when idle with a focused task
- Changing values persists across page refresh
- Values are clamped to 1–30 min range

---

## Phase 3: Client — break transition state machine

### Overview

Evolve `usePomodoroCycle` from a single-cycle hook into a session-aware state machine that handles work→break→work transitions, cycle counting for long breaks, and break-end overlay.

### Changes Required:

#### 1. Extend hook state to track session flow

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Add state to track: (a) whether the current running cycle is a break (`isBreak` / cycle kind), (b) the number of completed work cycles in the current session (for long-break logic). After `confirmComplete` on a WORK cycle, auto-create a break cycle (SHORT_BREAK or LONG_BREAK based on count % 4). After a break cycle completes, show the "completed" state (which triggers the overlay).

**Contract**: 
- New exported state: `cycleKind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null` (derived from `activeCycle.kind`)
- `confirmComplete` behavior change: when completing a WORK cycle, instead of resetting to idle, create a break cycle (`SHORT_BREAK` if `completedWorkCycles % 4 !== 0`, else `LONG_BREAK`) with the appropriate duration from `duration-storage`, no `taskId`. Then start the timer for it.
- When a break cycle's timer expires → state becomes "completed" → overlay shows → user confirms → state resets to idle (ready to pick next task).
- `completedWorkCycles` count: query completed WORK cycles in the active session. For authenticated mode, add a `cycle.countCompleted` query. For guest mode, count from localStorage snapshot.

#### 2. Add cycle.countCompleted query

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Add a query that returns the count of COMPLETED WORK cycles in the user's active session. Used by the client to determine short vs long break.

**Contract**: `cycle.countCompleted` — input: `{ sessionId: z.number().int() }`. Returns `{ count: number }`. Counts cycles where `sessionId = input, kind = WORK, state = COMPLETED, userId = ctx.user.id`.

#### 3. Break-end overlay variant

**File**: `src/app/_components/cycle-complete-overlay.tsx`

**Intent**: When the completed cycle is a break (not WORK), show a different overlay: "Break's over!" with a single "Continue" button (no "mark task done" option). Confirming dismisses the overlay and returns to idle state so the user can pick their next task.

**Contract**: The overlay receives `cycleKind` as a prop. When `cycleKind` is `SHORT_BREAK` or `LONG_BREAK`, render the break-end variant. The `onConfirm` callback is called with `markTaskDone: false` (breaks don't have tasks).

#### 4. Break timer visual styling

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: When the running cycle is a break, change the timer panel's appearance: calming color scheme (blue/teal border and text instead of default), label shows "Short Break" or "Long Break" instead of "Focusing on [task]", and the interrupt button says "End break early".

**Contract**: `TimerPanel` receives a new prop `cycleKind: "WORK" | "SHORT_BREAK" | "LONG_BREAK" | null`. Styling and labels are conditional on this prop.

#### 5. Wire new state through PomodoroDashboard

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass the new `cycleKind` prop from `usePomodoroCycle` down to `TimerPanel` and `CycleCompleteOverlay`.

**Contract**: Destructure `cycleKind` from `pomodoro` and pass it to child components.

### Success Criteria:

#### Automated Verification:

- Unit tests for the break transition logic: work cycle complete → break auto-starts with correct kind and duration
- Unit test for long break trigger: after 4th work cycle, break kind is LONG_BREAK
- Unit test for break complete → returns to idle (no task focused)
- `cycle.countCompleted` query test
- `pnpm typecheck` passes
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification:

- Complete a work cycle → break timer starts automatically with correct duration
- Break timer shows calming color scheme and "Short Break" label
- After 4 work cycles, long break triggers with correct duration
- Break end → audio chime + overlay → confirm → idle state, ready to pick next task
- Refresh during break → break timer recovers correctly (existing recovery logic handles any CycleKind)

---

## Phase 4: Session end UI and timeout handling

### Overview

Add the "End session" button, handle the UI reset when a session ends, and surface the timeout scenario gracefully.

### Changes Required:

#### 1. End session button

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Show a persistent "End session" button when a session is active (i.e., when the user has started at least one cycle). Clicking it calls `sessions.end()`, resets the hook state to idle, clears focused task, and invalidates relevant queries.

**Contract**: Button is visible when `pomodoro.hasActiveSession` is true (new boolean from the hook). Disabled while a cycle is running (must interrupt first or wait for completion). After ending, the UI returns to the pre-session state (task list visible, no timer, no focused task).

#### 2. Expose hasActiveSession from hook

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Track whether the user has an active session (derived from whether `activeCycle` is non-null or a session was started this mount). Expose as `hasActiveSession: boolean` for the end-session button visibility.

**Contract**: `hasActiveSession` is true from the moment the first cycle starts until the session is explicitly ended or the component unmounts. Persists across cycle transitions (work→break→work). Resets to false after `endSession()` is called.

#### 3. endSession action in hook

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Add an `endSession()` function that stops any running timer, calls `sessions.end()`, resets all hook state to initial values, and invalidates server queries.

**Contract**: `endSession: () => Promise<void>`. If a cycle is currently running, interrupt it first (call `cycles.interrupt`), then end the session. Resets: state→idle, remainingMs→0, focusedTask→null, activeCycle→null, hasActiveSession→false.

#### 4. Timeout detection on recovery

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: When `recoverActiveCycle()` runs on mount and finds no active cycle (because the server ended the stale session via the inactivity check), ensure the UI starts clean. If `sessions.getOrCreateActive()` returns a fresh session (different from what was previously stored), treat it as a timeout event — no special UI needed, just start fresh.

**Contract**: No user-visible "session timed out" message in MVP — the user simply sees a clean slate. The old session is already `ENDED_BY_TIMEOUT` on the server. This is handled naturally: if there's no running cycle to recover, the hook stays in idle state.

### Success Criteria:

#### Automated Verification:

- Unit test: `endSession()` calls `sessions.end()` and resets state
- Unit test: `endSession()` interrupts running cycle before ending session
- Unit test: `hasActiveSession` is true after first cycle start, false after endSession
- Integration test: end session → start new cycle → new session is created (old one is ended)
- `pnpm typecheck` passes
- `pnpm check` passes
- `pnpm test` passes

#### Manual Verification:

- "End session" button visible after starting first cycle
- "End session" button disabled during running cycle
- Clicking "End session" returns to clean pre-session state
- After ending session, starting a new cycle creates a fresh session
- After 4h inactivity (testable by manually setting lastActivityAt in DB), next cycle start creates new session

---

## Testing Strategy

### Unit Tests:

- `session.end` mutation: happy path, no active session, idempotency
- `lastActivityAt` updates on cycle create/complete/interrupt
- Inactivity timeout in `findOrCreateActiveSession` (mock Date.now)
- Break duration storage: defaults, clamping, persistence
- Break transition logic in hook: work→short break, 4th cycle→long break
- `cycle.countCompleted` query
- `endSession` action: state reset, interrupt-then-end flow
- Break-end overlay rendering (break variant vs work variant)

### Integration Tests:

- Full session flow via tRPC caller: create session → 4 work cycles with breaks → end session
- Inactivity timeout: set lastActivityAt to 5h ago → call getOrCreateActive → verify old session ended + new one created
- Guest mode: full session flow in localStorage

### Manual Testing Steps:

1. Start a work cycle, let it complete → verify break auto-starts
2. Complete 4 work cycles → verify long break triggers on 4th
3. Change break durations in settings → verify next break uses new duration
4. Click "End session" → verify clean reset
5. Refresh during a break → verify break timer recovers
6. Run full e2e test: `pnpm test:e2e`

## Performance Considerations

- `cycle.countCompleted` query hits an indexed column (`sessionId` + `kind` + `state`) — negligible cost
- Break auto-start creates a cycle immediately after confirming the work cycle — two sequential mutations. Acceptable latency given the user just confirmed a transition.
- No new polling or subscriptions — the existing Web Worker timer handles break cycles identically to work cycles.

## Migration Notes

No schema migration required — all needed enums and fields already exist from F-01. This is purely a logic/UI change.

## References

- Roadmap: `context/foundation/roadmap.md` § S-02
- PRD: `context/foundation/prd.md` § FR-011, FR-014, FR-019
- S-01 plan: `context/changes/first-pomodoro-cycle/plan.md`
- Existing cycle router: `src/server/api/routers/cycle.ts`
- Existing session router: `src/server/api/routers/session.ts`
- Hook: `src/hooks/use-pomodoro-cycle.ts`
- Duration storage: `src/lib/duration-storage.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server — session lifecycle and lastActivityAt

#### Automated

- [ ] 1.1 `pnpm typecheck` passes with new SessionRepository.end() method
- [ ] 1.2 `pnpm check` (Biome) passes
- [ ] 1.3 Unit tests for session.end mutation (happy path + NOT_FOUND)
- [ ] 1.4 Unit tests for lastActivityAt update on cycle create/complete/interrupt
- [ ] 1.5 Unit test for inactivity timeout in findOrCreateActiveSession
- [ ] 1.6 Existing cycle and session tests pass: `pnpm test`

#### Manual

- [ ] 1.7 Verify session.end via tRPC caller integration test
- [ ] 1.8 Verify inactivity timeout creates new session (integration test with mocked time)

### Phase 2: Break duration configuration

#### Automated

- [ ] 2.1 Unit tests for break duration storage functions (defaults, clamping, invalid input)
- [ ] 2.2 `pnpm typecheck` passes
- [ ] 2.3 `pnpm check` passes
- [ ] 2.4 `pnpm test` passes

#### Manual

- [ ] 2.5 Break duration controls visible in timer panel when idle with focused task
- [ ] 2.6 Values persist across page refresh
- [ ] 2.7 Values clamped to 1–30 min range

### Phase 3: Client — break transition state machine

#### Automated

- [ ] 3.1 Unit test: work cycle complete → break auto-starts with correct kind and duration
- [ ] 3.2 Unit test: after 4th work cycle, break kind is LONG_BREAK
- [ ] 3.3 Unit test: break complete → returns to idle
- [ ] 3.4 cycle.countCompleted query test
- [ ] 3.5 `pnpm typecheck` passes
- [ ] 3.6 `pnpm check` passes
- [ ] 3.7 `pnpm test` passes

#### Manual

- [ ] 3.8 Work cycle complete → break timer starts automatically
- [ ] 3.9 Break timer shows calming color and correct label
- [ ] 3.10 After 4 work cycles, long break triggers
- [ ] 3.11 Break end → audio + overlay → confirm → idle
- [ ] 3.12 Refresh during break → timer recovers

### Phase 4: Session end UI and timeout handling

#### Automated

- [ ] 4.1 Unit test: endSession() calls sessions.end() and resets state
- [ ] 4.2 Unit test: endSession() interrupts running cycle before ending
- [ ] 4.3 Unit test: hasActiveSession lifecycle
- [ ] 4.4 Integration test: end session → new cycle → new session created
- [ ] 4.5 `pnpm typecheck` passes
- [ ] 4.6 `pnpm check` passes
- [ ] 4.7 `pnpm test` passes

#### Manual

- [ ] 4.8 "End session" button visible after first cycle start
- [ ] 4.9 "End session" disabled during running cycle
- [ ] 4.10 Clicking "End session" returns to clean state
- [ ] 4.11 After 4h inactivity, next cycle creates new session
