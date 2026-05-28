# First Pomodoro Cycle Implementation Plan

## Overview

Implement the north-star slice S-01: a user picks an existing task, starts a configurable work cycle bound to it, sees a real-time countdown, hears an audio alarm at cycle end, confirms the transition via a UI prompt, and can refresh the page mid-cycle without losing state. This is the validation milestone for FlowState's core hypothesis.

## Current State Analysis

The data layer is complete (F-01): `Cycle`, `Session`, `Task` models exist in Prisma with all needed fields (`startedAt`, `configuredDurationSec`, `state`, `taskId`). tRPC routers for `cycle.create`, `cycle.list`, `session.create`, `session.list` are registered and working with ownership checks. The task list UI renders active/completed tasks with full CRUD. Auth is wired end-to-end. E2E infrastructure (F-02) is in place with Playwright + authenticated test user.

### Key Discoveries:

- `src/server/api/routers/cycle.ts:1-72` — `cycle.create` validates session + task ownership, returns created entity. Missing: `getActive` and `complete`.
- `src/server/api/routers/session.ts:1-34` — `session.create` catches P2002 (unique constraint) but there's no DB unique constraint on active sessions — the conflict detection is aspirational. Auto-creation needs a "find or create" pattern.
- `src/app/_components/task-list.tsx` — Pure client component with `useSuspenseQuery`. No focus selection, no timer integration. Will need a "Focus" button per task.
- `src/app/page.tsx` — Simple RSC with auth check + prefetch. Will need to prefetch `cycle.getActive` for recovery.
- No `public/sounds/` directory exists — audio asset must be sourced externally.
- No modal/dialog/overlay component exists — must be built from scratch with Tailwind.
- No `cn()` utility exists despite biome config referencing it — use `clsx` directly or create `cn`.
- `next.config.js` is empty — no custom webpack config. Web Worker via `new URL()` pattern should work out of the box.

## Desired End State

A logged-in user with at least one active task can:
1. Click "Focus" on any active task → task highlights as the focused task
2. See a duration picker (presets: 15/25/45/60 min + custom 5–90) and click "Start Cycle"
3. See a live mm:ss countdown that stays accurate even if the tab is backgrounded
4. Hear a short audio chime and see a completion overlay when the cycle ends
5. Confirm via "Done — mark task complete" or "Continue later" — both end the cycle
6. Refresh the page at any point during the cycle and return to the correct countdown state

**Verification:** The cycle is trustworthy (±2s drift max), recoverable (refresh doesn't lose state), and the audio fires reliably across Chrome/Firefox/Safari/Edge desktop.

## What We're NOT Doing

- Break cycles (S-02 — full session with breaks)
- Mid-cycle task completion prompt (S-03)
- End-of-cycle check-in / energy declaration (S-05)
- Task suggestion after cycle (S-06)
- Server-side duration preference persistence (localStorage only for MVP)
- Mobile/responsive optimization (desktop-first per PRD §Non-Goals)
- Volume/mute controls (UX detail, not FR)
- Multiple concurrent cycles or cycle queuing
- Session end/timeout logic (S-02)

## Implementation Approach

Server-authoritative timer with client-side display engine:
- **Server** records `cycle.startedAt` + `configuredDurationSec` as source of truth
- **Client** derives remaining time via `endTime - Date.now()` — no accumulated drift
- **Web Worker** ticks every 1s in background (unthrottled) for display updates
- **Web Audio** schedules alarm on the audio thread for sub-second precision
- **Visibility API** corrects display instantly on tab re-focus
- **Recovery**: on page load, query active cycle → derive remaining → resume or show completion

## Phase 1: Server Layer

### Overview

Add the missing tRPC procedures (`cycle.getActive`, `cycle.complete`) and implement transparent session auto-creation so starting a cycle doesn't require a manual "create session" step.

### Changes Required:

#### 1. Active cycle query

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Add a `getActive` query that returns the user's currently RUNNING cycle (if any) with its associated task. This is the foundation for crash/refresh recovery — the client calls it on page load to determine if a cycle is in progress.

**Contract**: `cycle.getActive` — protectedProcedure, no input, returns `Cycle & { task: Task | null } | null`. Filters by `userId` + `state: "RUNNING"`. Returns `null` if no active cycle.

#### 2. Complete cycle mutation

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Add a `complete` mutation that transitions a RUNNING cycle to COMPLETED, sets `endedAt`, and optionally marks the linked task as completed. This is called when the user confirms the cycle-end prompt.

**Contract**: `cycle.complete` — protectedProcedure, input `{ cycleId: number, markTaskDone?: boolean }`, returns updated Cycle. Validates ownership, checks state is RUNNING, sets `state: "COMPLETED"` + `endedAt: new Date()`. If `markTaskDone: true` and cycle has a `taskId`, also updates the task's status to "completed".

#### 3. Interrupt cycle mutation

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Add an `interrupt` mutation for when the user explicitly stops a cycle before it ends. Separate from `complete` because the state is INTERRUPTED (not COMPLETED) — important for future session analytics (S-02, S-05).

**Contract**: `cycle.interrupt` — protectedProcedure, input `{ cycleId: number }`, returns updated Cycle. Sets `state: "INTERRUPTED"` + `endedAt: new Date()`.

#### 4. Session auto-creation helper

**File**: `src/server/api/routers/session.ts`

**Intent**: Add a `getOrCreateActive` mutation that returns the user's current ACTIVE session, or creates one if none exists. This removes the need for explicit session creation before starting a cycle.

**Contract**: `session.getOrCreateActive` — protectedProcedure, no input, returns Session. Queries for `userId` + `state: "ACTIVE"`, returns if found, otherwise creates and returns.

#### 5. Extend cycle.create to auto-resolve session

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Make `sessionId` optional in `cycle.create` input. When omitted, the procedure calls the session auto-creation logic internally. This simplifies the client — it just says "start a cycle on this task with this duration" without worrying about sessions.

**Contract**: `cycle.create` input changes `sessionId` from required `z.number().int()` to optional `z.number().int().optional()`. When undefined, internally resolves via the same find-or-create-active-session logic.

### Success Criteria:

#### Automated Verification:

- All existing tests pass: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- New unit tests for `cycle.getActive`, `cycle.complete`, `cycle.interrupt`, `session.getOrCreateActive` pass
- Integration test: create cycle → getActive returns it → complete → getActive returns null

#### Manual Verification:

- tRPC procedures callable via dev tools / Prisma Studio verification of state transitions

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 2: Timer Engine

### Overview

Build the Web Worker timer, the `usePomodoroCycle` orchestration hook, and the AudioContext setup. This phase produces the core timing infrastructure without any visible UI — it's consumed by Phase 3's components.

### Changes Required:

#### 1. Web Worker timer

**File**: `src/workers/timer-worker.ts`

**Intent**: A dedicated Web Worker that receives a `start` message with an `endTime` timestamp, ticks every 1000ms computing `endTime - Date.now()`, posts `tick` messages with remaining ms, and posts a `complete` message when remaining ≤ 0. Also handles `stop` to clear the interval.

**Contract**: Worker message protocol:
- Inbound: `{ type: 'start', endTime: number }` | `{ type: 'stop' }`
- Outbound: `{ type: 'tick', remaining: number }` | `{ type: 'complete' }`

#### 2. Audio utility module

**File**: `src/lib/audio.ts`

**Intent**: Encapsulate AudioContext lifecycle — creation, resume-on-gesture, buffer pre-loading, and alarm playback with HTML5 Audio fallback. Exposes a simple API that the hook consumes.

**Contract**:
```typescript
export function createAudioManager(): {
  unlock(): Promise<void>;          // Call on user gesture (Start click)
  preload(url: string): Promise<void>;
  playAlarm(): Promise<void>;       // Plays pre-loaded buffer or falls back
  dispose(): void;
}
```

#### 3. Pomodoro cycle hook

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: The single orchestration hook that ties together: Worker lifecycle, AudioContext, Visibility API recalculation, and tRPC mutations. Components consume this hook's return value to render the timer UI.

**Contract**:
```typescript
export function usePomodoroCycle(): {
  // State
  state: 'idle' | 'running' | 'completed';
  remainingMs: number;
  focusedTask: Task | null;
  activeCycle: Cycle | null;

  // Actions
  selectTask(taskId: number): void;
  clearTask(): void;
  start(durationSec: number): Promise<void>;
  interrupt(): Promise<void>;
  confirmComplete(markTaskDone: boolean): Promise<void>;
}
```

The hook:
- On mount: calls `cycle.getActive` — if a RUNNING cycle exists, resumes the Worker with derived endTime
- On `start()`: calls `session.getOrCreateActive` → `cycle.create` → starts Worker + unlocks audio
- On Worker `complete` message: sets state to 'completed', plays alarm
- On `interrupt()`: calls `cycle.interrupt`, stops Worker
- On `confirmComplete()`: calls `cycle.complete` with `markTaskDone` flag
- On visibility change (tab re-focus): recalculates remaining from endTime, if ≤ 0 triggers completion

### Success Criteria:

#### Automated Verification:

- All existing tests pass: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Unit test for timer-worker: mock `Date.now()`, verify tick/complete messages
- Unit test for audio manager: mock AudioContext, verify unlock/preload/play flow
- Unit test for hook: mock Worker + tRPC, verify state transitions (idle → running → completed)

#### Manual Verification:

- Hook can be exercised via a temporary test component (or React DevTools) to confirm Worker ticks arrive

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 3: UI Components

### Overview

Build the visible UI: task focus selection button, timer panel with duration picker, countdown display, and cycle-end completion overlay. Wire everything to the `usePomodoroCycle` hook from Phase 2.

### Changes Required:

#### 1. Audio asset sourcing

**File**: `public/sounds/pomodoro-complete.mp3`

**Intent**: Provide a short (1–2 second) bell/chime audio file for the cycle-end alarm. This is a manual step — the implementer must source a royalty-free MP3 file and place it here.

**Contract**: MP3 format, ≤100KB, 1–2 seconds duration, pleasant bell/chime tone. The file must exist at this path before audio features work.

> ⚠️ **Manual action required**: Source a royalty-free alarm sound and save it to `public/sounds/pomodoro-complete.mp3`.
>
> **Suggested sources (CC0 / no-attribution):**
> - **freesound.org** — filter by license "Creative Commons 0", search: "bell chime notification short". Example: search `bell notification` → sort by duration (shortest first) → pick 1–2s clip → download MP3.
> - **mixkit.co/free-sound-effects/** — category "Alerts & Notifications", all free for commercial use without attribution.
> - **pixabay.com/sound-effects/** — all sounds are Pixabay Content License (free, no attribution required), search: "notification bell" or "chime alert".
>
> **Requirements:** MP3 format, ≤100KB, 1–2 seconds, pleasant non-jarring tone (bell, chime, or soft gong — avoid harsh buzzer sounds that would break the mindfulness UX).

#### 2. Task focus selection

**File**: `src/app/_components/task-list.tsx`

**Intent**: Add a "Focus" button to each active task item. When clicked, it calls `selectTask(taskId)` from the hook. The focused task gets a visual highlight (ring/border). Only one task can be focused at a time. Clicking "Focus" on another task switches focus.

**Contract**: Each active task `<li>` gains a "Focus" button (or the entire row becomes clickable for focus). The focused task ID comes from the hook's `focusedTask`. Visual: `ring-2 ring-purple-500` or similar highlight on the focused item.

#### 3. Timer panel component

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: A panel that appears when a task is focused (state=idle) or a cycle is running. In idle state: shows duration picker (preset buttons + custom input) and "Start Cycle" button. In running state: shows large mm:ss countdown, focused task name, and "Interrupt" button.

**Contract**: Component receives props from `usePomodoroCycle` hook. Renders conditionally based on `state`:
- `idle` + `focusedTask !== null`: duration picker + Start button
- `running`: countdown (derived from `remainingMs`) + task name + Interrupt button
- `completed`: nothing (overlay handles this)

#### 4. Cycle-end overlay

**File**: `src/app/_components/cycle-complete-overlay.tsx`

**Intent**: A full-screen semi-transparent overlay that appears when `state === 'completed'`. Shows "Cycle Complete!" message and two action buttons. Cannot be dismissed without choosing an action (enforces FR-014 mindful confirmation).

**Contract**: Overlay with backdrop (`fixed inset-0 bg-black/60 z-50`). Content card centered with:
- Heading: "Cycle Complete!"
- Task name that was focused
- Button 1: "Done — mark task complete" → calls `confirmComplete(true)`
- Button 2: "Continue later" → calls `confirmComplete(false)`
Both buttons transition state back to `idle` and invalidate relevant queries.

#### 5. Page integration

**File**: `src/app/page.tsx`

**Intent**: Add `cycle.getActive` to the prefetch calls so recovery data is available on first render. Import and render the timer panel alongside the task list. Pass hook context down or use the hook at the page-component level.

**Contract**: Add `await api.cycle.getActive.prefetch()` in the RSC. The client-side page wrapper (or a new client component) instantiates `usePomodoroCycle` and passes state to `TaskList`, `TimerPanel`, and `CycleCompleteOverlay`.

#### 6. Page layout orchestration

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: A client component that owns the `usePomodoroCycle` hook and orchestrates the layout: task list (with focus selection), timer panel, and completion overlay. This replaces the direct `<TaskList />` render in page.tsx.

**Contract**: Renders `<TaskList>` (with focus callback), `<TimerPanel>` (when task focused or cycle running), `<CycleCompleteOverlay>` (when state=completed). Manages the coordination between these components via the single hook instance.

### Success Criteria:

#### Automated Verification:

- All existing tests pass: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Component renders without errors (basic render tests)

#### Manual Verification:

- Select a task → see it highlighted
- Choose duration → click Start → see countdown ticking
- Wait for cycle end → hear audio → see overlay
- Click "Done" → task moves to completed list
- Click "Continue later" → task stays active, timer resets to idle
- Verify responsive layout doesn't break on standard desktop widths

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 4: Recovery & Polish

### Overview

Wire crash/refresh recovery, integrate the Visibility API for instant display correction on tab re-focus, handle edge cases (cycle expired while tab was closed, network errors), and add localStorage duration persistence.

### Changes Required:

#### 1. Recovery on mount

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: On hook mount, if `cycle.getActive` returns a RUNNING cycle, compute `endTime = startedAt + configuredDurationSec * 1000`. If `endTime > Date.now()`, start the Worker with that endTime (resume). If `endTime <= Date.now()`, immediately set state to 'completed' and play alarm (cycle expired while page was closed).

**Contract**: Recovery logic runs in a `useEffect` on mount. Uses the prefetched `cycle.getActive` data from RSC hydration for instant recovery without a loading flash.

#### 2. Visibility API integration

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: On `visibilitychange` → `visible`, recalculate remaining from endTime. If remaining ≤ 0 and state is still 'running', trigger completion (the Worker might not have fired yet if the tab was suspended on mobile). This is a safety net — the Worker handles the normal case.

**Contract**: `document.addEventListener('visibilitychange', handler)` in the hook's effect. Cleanup on unmount.

#### 3. Duration persistence in localStorage

**File**: `src/lib/duration-storage.ts`

**Intent**: Save the user's last-used duration to localStorage so it's pre-selected next time they start a cycle. Simple get/set with a sensible default (25 min = 1500 sec).

**Contract**:
```typescript
export function getLastDuration(): number;  // Returns seconds, default 1500
export function setLastDuration(sec: number): void;
```

#### 4. Error handling & edge cases

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Handle network errors gracefully — if `cycle.create` fails, show an error state (not crash). If `cycle.complete` fails, retry once then show error. If Worker fails to instantiate (rare), fall back to `setInterval` on main thread with visibility-change correction.

**Contract**: Hook exposes an `error: string | null` field. Errors are user-friendly messages. The timer never silently stops — if the Worker dies, the visibility handler catches up on next tab focus.

#### 5. Focused task guard

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: If the focused task is deleted or completed by another tab/device while a cycle is running, the cycle continues (it's already server-recorded). On completion, if the task no longer exists, the "Done — mark task complete" button is disabled and only "Continue later" is available.

**Contract**: The overlay checks if `focusedTask` is still in the active task list. If not, disable the "mark done" option.

### Success Criteria:

#### Automated Verification:

- All existing tests pass: `pnpm test`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Unit test: hook recovery path — mock getActive returning a running cycle, verify Worker starts with correct endTime
- Unit test: hook recovery path — mock getActive returning an expired cycle, verify state immediately goes to 'completed'
- Unit test: localStorage get/set with missing/corrupt data

#### Manual Verification:

- Start a cycle → refresh page → countdown resumes from correct time
- Start a cycle → close tab → reopen → see correct state (resumed or completion prompt)
- Start a cycle → background tab for 30s → return → display shows correct remaining time
- Start a cycle with short duration (5s) → background tab → return after expiry → see completion overlay + hear audio
- Network disconnect during cycle → timer continues locally → reconnect → complete works

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Phase 5: Testing

### Overview

Write comprehensive tests across the test pyramid: unit tests for procedures and hook logic, integration tests for the full cycle lifecycle, and an E2E Playwright test proving the entire flow in a real browser.

### Changes Required:

#### 1. tRPC procedure tests

**File**: `src/server/api/routers/cycle.test.ts`

**Intent**: Unit/integration tests for `cycle.getActive`, `cycle.complete`, `cycle.interrupt` using the server-side caller pattern. Verify ownership checks, state transitions, and the `markTaskDone` flag.

**Contract**: Tests use `createCaller` from root.ts with a mocked context. Cover: getActive returns null when no running cycle, getActive returns cycle with task, complete transitions state, complete with markTaskDone updates task, interrupt sets INTERRUPTED state, ownership violation throws NOT_FOUND.

#### 2. Session auto-creation tests

**File**: `src/server/api/routers/session.test.ts`

**Intent**: Test `session.getOrCreateActive` — returns existing active session, creates new one when none exists, handles race conditions.

**Contract**: Tests verify idempotency (calling twice returns same session) and creation (calling with no active session creates one).

#### 3. Hook unit tests

**File**: `src/hooks/use-pomodoro-cycle.test.ts`

**Intent**: Test the hook's state machine in isolation with mocked Worker and tRPC. Verify transitions: idle → running → completed, recovery paths, interrupt flow.

**Contract**: Use `@testing-library/react` `renderHook`. Mock Worker via a fake class. Mock tRPC via `vi.mock`. Test: start() creates cycle and starts worker, worker complete message transitions to completed, interrupt() calls mutation and stops worker, recovery on mount with active cycle.

#### 4. Timer worker unit tests

**File**: `src/workers/timer-worker.test.ts`

**Intent**: Test the Worker's tick logic in isolation. Verify it posts correct remaining values and fires complete when time expires.

**Contract**: Import the worker's `onmessage` handler directly (or use a Worker mock). Fake `Date.now()` progression. Verify tick messages have correct remaining values. Verify complete fires when remaining ≤ 0.

#### 5. E2E Playwright test

**File**: `e2e/pomodoro-cycle.spec.ts`

**Intent**: Full browser test: sign in → create a task → focus it → start a 5-second cycle → verify countdown appears → wait for completion → verify overlay → click "Continue later" → verify return to idle state. Uses the authenticated test user from F-02.

**Contract**: Test uses a very short duration (5 seconds, minimum allowed by validation is 60s — so either: use a test-only override, or set minimum to 5s in test env, or mock time). Recommended: the test uses 60s (minimum) but uses `page.clock` API to fast-forward time. Verifies: countdown visible, completion overlay appears, audio element triggered (can't verify actual sound in headless, but verify the play() call or AudioContext state).

### Success Criteria:

#### Automated Verification:

- All unit tests pass: `pnpm test`
- All E2E tests pass: `pnpm test:e2e`
- Type checking passes: `pnpm typecheck`
- Linting passes: `pnpm check`
- Code coverage for new procedures ≥ 80%

#### Manual Verification:

- Full manual walkthrough of the happy path with a real 1-minute cycle
- Verify audio plays in Chrome, Firefox, and Edge (at minimum)
- Verify background tab behavior (start cycle, switch tabs, return after 30s)

**Implementation Note**: After completing this phase and all automated verification passes, pause here for manual confirmation from the human that the manual testing was successful before proceeding to the next phase.

---

## Testing Strategy

### Unit Tests:

- Timer worker: tick accuracy, complete detection, stop handling
- Audio manager: unlock flow, preload, play with fallback
- `usePomodoroCycle` hook: full state machine (idle/running/completed), recovery paths
- tRPC procedures: getActive, complete, interrupt, session.getOrCreateActive
- Duration storage: get/set, defaults, corrupt data handling

### Integration Tests:

- Full cycle lifecycle via server caller: create → getActive → complete (with and without markTaskDone)
- Session auto-creation: no session → create cycle → session exists
- Ownership isolation: user A's cycle not visible to user B

### Manual Testing Steps:

1. Log in → create a task → click Focus → verify highlight
2. Select 1-minute duration → Start Cycle → verify countdown ticks
3. Wait for cycle end → verify audio plays → verify overlay appears
4. Click "Done — mark task complete" → verify task moves to completed
5. Repeat with "Continue later" → verify task stays active
6. Start a cycle → refresh page → verify countdown resumes
7. Start a cycle → close tab → reopen → verify correct state
8. Start a cycle → background tab → return → verify display correct
9. Start a cycle → click Interrupt → verify cycle ends as INTERRUPTED
10. Verify no console errors throughout all flows

## Performance Considerations

- Web Worker is lightweight (~50 lines) — negligible memory overhead
- AudioContext created once, reused for all cycles — no repeated allocation
- `cycle.getActive` is a single indexed query (`userId` + `state`) — sub-ms on Neon
- No polling — server hit only on start, complete, and page load
- Timer panel uses `requestAnimationFrame` for smooth display updates when tab is visible, Worker ticks for background accuracy

## Migration Notes

- No database migration needed — all required columns/models exist from F-01
- `cycle.create` input schema changes (sessionId becomes optional) — existing callers (if any) still work since they pass sessionId explicitly
- No breaking changes to existing UI — TaskList gains a Focus button but existing functionality unchanged

## Implementation addendum (2026-05-28)

Supporting modules added during implementation (not in original phase file lists):

| File | Purpose |
|------|---------|
| `src/server/api/lib/active-session.ts` | Shared `findOrCreateActiveSession` for `session.getOrCreateActive` and `cycle.create` |
| `src/workers/timer-worker-logic.ts` | Extracted tick math (unit-tested without loading the Worker entry) |
| `src/lib/format-remaining.ts` | `mm:ss` countdown formatting for `timer-panel` |

**Deferred:** `requestAnimationFrame` for visible-tab display polish (plan Performance Considerations) — Worker + server-authoritative `endTime` meets the ±2s drift NFR; rAF can land in a UX polish slice if needed.

## References

- Research: `context/changes/first-pomodoro-cycle/research.md`
- Cycle router: `src/server/api/routers/cycle.ts`
- Session router: `src/server/api/routers/session.ts`
- Task list UI: `src/app/_components/task-list.tsx`
- Page: `src/app/page.tsx`
- Prisma schema: `prisma/schema.prisma`
- PRD: `context/foundation/prd.md` (FR-009, FR-010, FR-012, FR-013, FR-014)
- Roadmap: `context/foundation/roadmap.md` (S-01)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Server Layer

#### Automated

- [x] 1.1 All existing tests pass (`pnpm test`) — 2a1965a
- [x] 1.2 Type checking passes (`pnpm typecheck`) — 2a1965a
- [x] 1.3 Linting passes (`pnpm check`) — 2a1965a
- [x] 1.4 Unit tests for cycle.getActive, cycle.complete, cycle.interrupt pass — 2a1965a
- [x] 1.5 Unit test for session.getOrCreateActive passes — 2a1965a
- [x] 1.6 Integration test: create → getActive → complete → getActive returns null — 2a1965a

#### Manual

- [x] 1.7 tRPC procedures callable and state transitions verified via dev tools — 2a1965a

### Phase 2: Timer Engine

#### Automated

- [x] 2.1 All existing tests pass (`pnpm test`)
- [x] 2.2 Type checking passes (`pnpm typecheck`)
- [x] 2.3 Linting passes (`pnpm check`)
- [x] 2.4 Timer worker unit test passes (tick/complete/stop)
- [x] 2.5 Audio manager unit test passes (unlock/preload/play)
- [x] 2.6 usePomodoroCycle hook unit test passes (state transitions)

#### Manual

- [x] 2.7 Hook exercised via test component — Worker ticks arrive correctly

### Phase 3: UI Components

#### Automated

- [x] 3.1 All existing tests pass (`pnpm test`)
- [x] 3.2 Type checking passes (`pnpm typecheck`)
- [x] 3.3 Linting passes (`pnpm check`)
- [x] 3.4 Component render tests pass without errors

#### Manual

- [x] 3.5 Task focus selection works (highlight visible)
- [x] 3.6 Duration picker + Start Cycle flow works
- [x] 3.7 Countdown ticks visually
- [x] 3.8 Audio plays at cycle end
- [x] 3.9 Completion overlay appears with both buttons functional
- [x] 3.10 "Done" marks task complete; "Continue later" keeps task active

### Phase 4: Recovery & Polish

#### Automated

- [x] 4.1 All existing tests pass (`pnpm test`)
- [x] 4.2 Type checking passes (`pnpm typecheck`)
- [x] 4.3 Linting passes (`pnpm check`)
- [x] 4.4 Recovery unit test: running cycle resumes correctly
- [x] 4.5 Recovery unit test: expired cycle shows completion immediately
- [x] 4.6 localStorage duration persistence test passes

#### Manual

- [x] 4.7 Refresh mid-cycle → countdown resumes
- [x] 4.8 Close tab → reopen → correct state restored
- [x] 4.9 Background tab → return → display correct
- [x] 4.10 Background tab past expiry → return → completion overlay + audio

### Phase 5: Testing

#### Automated

- [x] 5.1 All unit tests pass (`pnpm test`)
- [x] 5.2 E2E test passes (`pnpm test:e2e`)
- [x] 5.3 Type checking passes (`pnpm typecheck`)
- [x] 5.4 Linting passes (`pnpm check`)

#### Manual

- [x] 5.5 Full manual walkthrough with real 1-minute cycle
- [x] 5.6 Audio verified in Chrome, Firefox, Edge
- [x] 5.7 Background tab behavior verified manually
