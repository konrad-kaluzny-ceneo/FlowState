# Ad-hoc break + break-overtime-until-accept Implementation Plan

## Overview

Two coupled changes to FlowState's break lifecycle, shipped together:

- **A — Ad-hoc break entry**: a persistent "Start break" quick action available in any idle state. Tapping it opens a short/long + duration picker; starting creates a break with no preceding work cycle and, on end, lands in the normal post-break kickoff beat. It must not punish the user (no cadence increment, no interruption count).
- **B — Break overtime until accept**: **all** breaks (ad-hoc and cadence) keep counting *up* past their configured duration ("overtime") and end only when the user explicitly accepts. Overtime surfaces inline (no auto-overlay), freezes while paused, and relies on the existing session inactivity timeout as its only backstop.

B lands first (phases 1–2); A rides on the resulting semantics (phase 3); server hardening + regression sweep close it out (phase 4).

## Current State Analysis

From [research.md](context/changes/adhoc-rest-time/research.md) and [frame.md](context/changes/adhoc-rest-time/frame.md):

- **Break creation is client-gated, not server-gated.** `cycle.create` accepts `SHORT_BREAK`/`LONG_BREAK` with no preceding-work requirement in both data modes ([cycle.ts:80](src/server/api/routers/cycle.ts)); the only client entry points are post-work-complete (`startBreakAfterWorkComplete` [use-pomodoro-cycle.ts:2418](src/hooks/use-pomodoro-cycle.ts)) and the check-in `start_break` phase.
- **Breaks freeze at 0:00.** Three parallel `remaining <= 0` expiry sites stop the timer and force `state = "completed"`: the worker ([timer-worker-logic.ts:14](src/workers/timer-worker-logic.ts) + [timer-worker.ts:28](src/workers/timer-worker.ts)), the main-thread fallback ([use-pomodoro-cycle.ts:772](src/hooks/use-pomodoro-cycle.ts)), and tab-return recompute ([:830](src/hooks/use-pomodoro-cycle.ts)). `handleCycleExpired` ([:688](src/hooks/use-pomodoro-cycle.ts)) is the transition to `completed`.
- **An explicit accept step already exists** — `CycleCompleteOverlay`'s "Continue" button ([cycle-complete-overlay.tsx:98](src/app/_components/cycle-complete-overlay.tsx)) → `confirmComplete` ([:2548](src/hooks/use-pomodoro-cycle.ts)), break `else` branch → `postBreakIdleFlag`/kickoff ([:2603](src/hooks/use-pomodoro-cycle.ts)). What is missing is overtime counting.
- **`formatRemainingMs` clamps with `Math.max(0, …)`** ([format-remaining.ts:2](src/lib/format-remaining.ts)) — structurally cannot represent overtime; `timer-panel.tsx` renders it ([:148](src/app/_components/timer-panel.tsx)) and computes progress ([:105](src/app/_components/timer-panel.tsx)).
- **Catch-up gate assumes breaks end at configured time.** `setCatchUpFromExpiry` hard-codes `state:"completed"` ([:669](src/hooks/use-pomodoro-cycle.ts)); `deriveCatchUpGate` returns `BREAK_CONFIRM` for a completed break ([derive-gate.ts:32](src/lib/catch-up/derive-gate.ts)).
- **Recap/stats are overtime-safe.** `computeCycleFocusedMinutes` and both recap paths filter `kind === "WORK"`; the server stamps `endedAt = new Date()` at accept time ([cycle.ts:204](src/server/api/routers/cycle.ts)).
- **`startBreakAfterWorkComplete` is the template for A**, minus the `setCompletedWorkCycles(newCount)` increment (the punishing step). The optimistic/wedge machinery is **not** needed — a single `cycles.create` uses the plain-await path.
- **Duration config**: `getShort/getLongBreakDuration` (localStorage) + `getShort/getLongBreakPresets` + `MAX_BREAK_DURATION_SEC = 1800` ([duration-bounds.ts:43](src/lib/duration-bounds.ts)). Reusable `DurationPicker` ([duration-picker.tsx:53](src/app/_components/duration-picker.tsx)). Server `cycle.create` validates duration with `minWorkCycleSec`/max 90 min for **all** kinds — not kind-aware ([cycle.ts:85](src/server/api/routers/cycle.ts)).
- **UI mount**: `QuickActions` ([quick-actions.tsx:14](src/app/_components/quick-actions.tsx)) in the calm rail ([pomodoro-dashboard.tsx:999](src/app/_components/pomodoro-dashboard.tsx)), gated by `showCalmLanding` — a persistent, any-idle-state home.

## Desired End State

- A user in any idle state sees a "Start break" action in the calm rail; tapping opens a short/long + duration picker; starting runs a break that, on end, returns them to the normal next-task kickoff — with no interruption penalty and no phantom work-cycle in their cadence.
- **Every** break, when its configured duration elapses, keeps counting up (`+MM:SS`) in place with an inline "End break" button. It only ends when the user clicks End break; pausing freezes the count; leaving and returning to the tab resumes the running overtime (no "ended N ago" gate). If genuinely abandoned, the existing 4h session inactivity timeout ends it server-side.
- Recap, focus-minutes, and day-plan budgets are unchanged (breaks excluded by `kind`).
- Server rejects break cycles longer than the 30-min break cap.

**Verification**: `pnpm typecheck && pnpm check && pnpm test` green; new hook/component tests for overtime + ad-hoc entry pass; `pnpm test:e2e:belt` green; manual: start ad-hoc break from idle, let it pass configured end, watch overtime, click End break, land in kickoff.

### Key Discoveries:

- Overtime requires editing the **three `remaining <= 0` expiry sites in lockstep** — a freeze-in-one-path bug is the primary risk ([research.md](context/changes/adhoc-rest-time/research.md) §B).
- `state === "completed"` is overloaded; overtime is a genuinely new sub-state ("break running past end / awaiting accept") that today collapses into `completed`.
- Only WORK cycles keep the expiry → `completed` → check-in behavior; **overtime applies to breaks only**.
- `startBreakAfterWorkComplete` minus one line is `startAdHocBreak`; `cycles.create` never touches a penalty counter ([research.md](context/changes/adhoc-rest-time/research.md) §A2).

## What We're NOT Doing

- **No overtime for WORK cycles** — work-cycle expiry keeps its current check-in gate behavior.
- **No `pause` vs `break` conceptual split** and **no mid-cycle break start** — explicitly deferred (future direction in frame).
- **No new overtime cap timer** — relying on the existing session inactivity timeout.
- **No change to recap/focus-minute accounting** — breaks already excluded.
- **No optimistic/wedge machinery for the ad-hoc path** — plain-await create only.
- **Not fixing** the accidental "cycle switched off" root cause — ad-hoc break is purely a recovery affordance.

## Implementation Approach

Phase 1 makes the timer/state machine *capable* of overtime (logic only, hook-tested). Phase 2 makes overtime *visible and endable* (UI, copy, catch-up). Phase 3 adds the idle entry action + picker that reuses the now-overtime-aware break machinery. Phase 4 hardens server validation and does the regression sweep. Each phase is independently testable; B precedes A.

## Critical Implementation Details

- **Timing & lifecycle**: The worker, the main-thread fallback, and `recalculateFromEndTime` each independently decide expiry at `remaining <= 0`. For breaks, all three must switch from "stop + complete" to "continue counting elapsed". They must change together or a hidden-tab return / worker-fallback swap will freeze overtime in one path only. `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER=1` forces the fallback path in E2E ([use-pomodoro-cycle.ts:164](src/hooks/use-pomodoro-cycle.ts)) — it must keep working.
- **State sequencing**: For a break, `handleCycleExpired` must NOT `setState("completed")` and must NOT null `endTimeRef` — overtime is derived as `Date.now() - endTimeRef`. Work cycles keep the existing `completed` transition. Distinguish by `cycleKindRef.current`.
- **User experience spec**: Overtime is inline and calm — no overlay auto-pops for breaks. The alarm/tab-pulse at configured end still fires once, but the break screen persists with a count-up and an "End break" button.

---

## Phase 1: Overtime timer core (B — logic)

### Overview

Teach the timer worker, the main-thread fallback, and the `use-pomodoro-cycle` state machine to count *up* past `endTime` for break cycles instead of stopping and completing. Pause freezes overtime; tab-return and recovery resume it. Logic only — surfaced via a signed remaining value; UI comes in Phase 2.

### Changes Required:

#### 1. Timer worker logic — overtime tick

**File**: `src/workers/timer-worker-logic.ts`

**Intent**: Stop treating `remaining <= 0` as terminal; emit an overtime signal carrying elapsed-past-end so the worker keeps ticking. Completion becomes user-driven (inbound `stop`), not time-driven.

**Contract**: Extend `TimerWorkerOutbound` with a new `{ type: "overtime"; elapsed: number }` variant (distinct from `tick` — keeps `tick` semantics unchanged for positive remaining). Extend `TimerWorkerInbound` start message with a `mode: "work" | "break"` field so the worker knows whether to emit `complete` (WORK) or `overtime` (BREAK) when `now >= endTime`. `getTimerTickResult(endTime, now, mode)` returns `{ type: "overtime", elapsed: now - endTime }` for breaks and `{ type: "complete" }` for work. Add tests covering both modes in `timer-worker-logic.test.ts`.

#### 2. Timer worker lifecycle — don't stop on overtime

**File**: `src/workers/timer-worker.ts`

**Intent**: Keep the interval alive through overtime; only clear it on an explicit inbound `stop`.

**Contract**: `tick()` no longer calls `stopTimer()` for the overtime case; instead, when `getTimerTickResult` returns `{ type: "overtime" }`, the worker posts the message and keeps the interval alive. The interval is only cleared on an explicit inbound `stop` message ([timer-worker.ts:52](src/workers/timer-worker.ts)).

#### 3. Hook — break expiry becomes overtime, not completion

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: For break cycles, expiry must not transition to `completed` or null `endTimeRef`; instead keep running and track overtime. WORK cycles keep the existing behavior. Apply consistently across all three expiry sites and the worker message handler.

**Contract**: 
- `handleCycleExpired` ([:688](src/hooks/use-pomodoro-cycle.ts)): branch on `cycleKindRef.current`. For breaks — keep `state = "running"`, keep `endTimeRef`, fire the end alarm/tab-pulse once, do **not** set catch-up, begin overtime accrual. For WORK — unchanged (`completed` + existing catch-up/pulse).
- `startFallbackTimer` tick ([:767-778](src/hooks/use-pomodoro-cycle.ts)): for breaks, past `endTime` keep ticking and surface elapsed instead of calling `handleCycleExpired` terminally.
- `recalculateFromEndTime` ([:819-836](src/hooks/use-pomodoro-cycle.ts)): for breaks, resume overtime counting instead of firing `handleCycleExpired`.
- `attachWorkerHandlers` ([:746-760](src/hooks/use-pomodoro-cycle.ts)): add a third branch for the new `{ type: "overtime"; elapsed }` message → surface elapsed (e.g. `setOvertimeMs(message.elapsed)` or `setRemainingMs(-message.elapsed)`).
- Represent overtime via a signed `remainingMs` (negative = overtime) or a dedicated `overtimeMs` state; `endTimeRef` stays non-null for breaks in overtime.
- **Idempotency guard**: Add a per-cycle `breakOvertimeEnteredRef` (reset when a new cycle starts). The end alarm and tab pulse execute only once — when the break first crosses the deadline. Subsequent observations (from `startFallbackTimer`, `recalculateFromEndTime`, `attachWorkerHandlers`, and recovery) only update the elapsed overtime value and preserve `endTimeRef` without repeating side effects. This prevents double-alarm on tab-return or worker↔fallback swaps.

#### 4. Hook — recovery resumes overtime

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: When recovering an active break whose `endTime` is already past, resume it in overtime instead of forcing `completed` + catch-up.

**Contract**: `resumeFromActiveCycle` ([:863-878](src/hooks/use-pomodoro-cycle.ts)): for `isBreakKind(cycle.kind)` with `endTime <= Date.now()`, enter running-overtime; keep the WORK branch as-is.

#### 5. Hook — pause freezes overtime

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Pausing a break in overtime stops the count-up; resume continues from the frozen overtime.

**Contract**: Extend the pause/resume path so a paused break preserves accrued overtime (mirror the existing `remainingDurationSec` freeze semantics for the overtime value); resuming re-derives `endTimeRef` so the count continues upward from where it froze.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] Timer worker logic unit tests pass (new overtime cases): `pnpm exec vitest run src/workers/timer-worker-logic.test.ts`
- [ ] Hook tests pass, incl. new overtime cases: `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`

#### Manual Verification:

- [ ] A break past its configured duration keeps counting (verified via hook state / temporary log), does not enter `completed`, and `endTimeRef` stays set.
- [ ] Pausing during overtime freezes the accrued value; resume continues upward.
- [ ] Hidden-tab return during overtime resumes counting (no freeze), in both worker and `MAIN_THREAD_TIMER` fallback modes.

**Implementation Note**: Pause here for manual confirmation before Phase 2.

---

## Phase 2: Overtime UI + accept + catch-up (B — presentation)

### Overview

Make overtime visible and endable: display `+MM:SS`, offer an inline "End break" control that accepts (routes to `confirmComplete`), stop auto-popping the break overlay, and retire the now-stale `BREAK_CONFIRM` catch-up gate for breaks. Add i18n copy.

### Changes Required:

#### 1. Sign-aware remaining formatter

**File**: `src/lib/format-remaining.ts`

**Intent**: Allow rendering overtime as `+MM:SS` rather than clamping to `00:00`.

**Contract**: Add a sign-aware format (e.g. `formatRemainingMs` gains an overtime branch, or a sibling `formatOvertimeMs`) that renders a leading `+` for negative/overtime input. Existing positive behavior unchanged. Update `format-remaining.test.ts`.

#### 2. Timer panel overtime display + End break control

**File**: `src/app/_components/timer-panel.tsx`

**Intent**: When a break is in overtime, show the `+MM:SS` count-up and an inline "End break" button that triggers accept. Keep progress ring sane past 100%.

**Contract**: Consume the signed remaining / overtime value; render overtime label via the new formatter ([:148](src/app/_components/timer-panel.tsx)); clamp/cap the progress computation past configured end ([:105](src/app/_components/timer-panel.tsx)); add an "End break" button wired to the hook's `endBreakFromOvertime()` (see §2a below). Button visible for a break **both in running-overtime and paused-overtime** (user can end a paused break directly without resuming first).

#### 2a. `endBreakFromOvertime` hook wrapper

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Provide an explicit entry point for ending a break from the overtime (or paused-overtime) state, making the contract boundary clear — the caller doesn't need to know that `confirmComplete` was designed for the `completed` state.

**Contract**: `endBreakFromOvertime()` — guards `isBreakKind(cycleKindRef.current)`. Idempotently stops the worker (no-op if already stopped by pause), transitions internal state, then delegates to `confirmComplete(false)`. Exported alongside `confirmComplete` in the hook return. This is the **only** call path for the inline "End break" button (Phases 2 and 3).

#### 3. Suppress auto break overlay; keep accept path

**File**: `src/app/_components/cycle-complete-overlay.tsx` and `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Breaks no longer auto-transition to `completed`, so the break branch of `CycleCompleteOverlay` no longer auto-appears. The accept action now originates from the inline "End break" control. Preserve the WORK completion overlay unchanged.

**Contract**: The break branch of `CycleCompleteOverlay` ([cycle-complete-overlay.tsx:50-121](src/app/_components/cycle-complete-overlay.tsx)) is no longer reached via break expiry; remove/guard it or repoint its usage. Ensure the dashboard renders no break overlay during overtime and routes End break → `confirmComplete`. Verify no dead-end: End break dismisses and advances to kickoff (lessons: dismiss oracle per gate).

#### 4. Retire BREAK_CONFIRM for breaks

**File**: `src/lib/catch-up/derive-gate.ts` (+ `src/hooks/use-pomodoro-cycle.ts` `setCatchUpFromExpiry`)

**Intent**: A break never "ends while away" now, so the `BREAK_CONFIRM` "ended N ago" gate is obsolete for breaks. Remove it for break kinds; WORK's `WORK_CONFIRM` stays.

**Contract**: `deriveCatchUpGate` ([derive-gate.ts:32-34](src/lib/catch-up/derive-gate.ts)) no longer returns `BREAK_CONFIRM` for a completed break (or the break-completed input no longer occurs). `setCatchUpFromExpiry` ([use-pomodoro-cycle.ts:666](src/hooks/use-pomodoro-cycle.ts)) is not invoked for breaks. Update `derive-gate.test.ts`. Retire/mark-unused `BREAK_CONFIRM` copy in `catch-up/copy.ts` as appropriate.

#### 5. i18n copy for overtime + End break

**File**: `messages/en.json`, `messages/pl.json`

**Intent**: Add calm, non-alarming copy for the overtime label and the End break action.

**Contract**: New keys (both locales) — e.g. an overtime label (`"On break · +{minutes} over"` / calm equivalent) and an `endBreak` action label, placed in the relevant namespace (`CycleComplete`/`Timer`). Reuse existing `shortBreak`/`longBreak` labels where possible.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] `format-remaining` tests pass (overtime rendering): `pnpm exec vitest run src/lib/format-remaining.test.ts`
- [ ] `derive-gate` tests pass (BREAK_CONFIRM retired): `pnpm exec vitest run src/lib/catch-up/derive-gate.test.ts`
- [ ] `cycle-complete-overlay` + `timer-panel` component tests pass: `pnpm exec vitest run src/app/_components/cycle-complete-overlay.test.tsx`
- [ ] No missing-i18n-key errors: `pnpm test` (i18n-covered) / build

#### Manual Verification:

- [ ] At configured end, a break shows `+MM:SS` counting up and an "End break" button — no overlay auto-pops.
- [ ] Clicking End break advances to the normal kickoff beat (no dead-end).
- [ ] End break is clickable while paused-in-overtime (user doesn't need to resume first).
- [ ] Copy reads calm in both en and pl; overtime label is not alarming.
- [ ] `prefers-reduced-motion` respected (no new blocking motion).

**Implementation Note**: Pause here for manual confirmation before Phase 3.

---

## Phase 3: Ad-hoc break entry (A)

### Overview

Add a persistent "Start break" quick action in any idle state that opens a short/long + duration picker and starts a break via a new non-punishing hook action. The break inherits the Phase 1–2 overtime behavior.

### Changes Required:

#### 1. `startAdHocBreak` hook action

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: New public action that creates a break from idle in both data modes without touching any penalty counter, then reconciles running state exactly like `startBreakAfterWorkComplete` (minus the cadence increment).

**Contract**: `startAdHocBreak(kind: "SHORT_BREAK" | "LONG_BREAK", durationSec: number)`. Guard `state === "idle"`. Idle prologue: `const session = await sessions.getOrCreateActive(); setActiveSessionId(session.id); setHasActiveSession(true)` (both modes). Then `cycles.create({ kind, configuredDurationSec: durationSec })`; reconcile `setActiveCycle({...,task:null})` / `setCycleKind` / `cycleKindRef` / `setState("running")` / `stateRef` / `startWorker` / `fireBreakOutOfTabAlert` / `showBreakTransitionLine` (mirror [:2435-2444](src/hooks/use-pomodoro-cycle.ts)); `await invalidateServerCycle()`. **Do NOT** call `setCompletedWorkCycles`, `computeBreakAfterWork`, `cycles.complete/interrupt/rebindTask`, or set `pendingIncrementInterruptionRef`. Wrap in try/catch with rollback to idle (pattern [:1968-1979](src/hooks/use-pomodoro-cycle.ts)). Export in the hook return (~[:3650](src/hooks/use-pomodoro-cycle.ts)).

#### 2. "Start break" quick action + picker

**File**: `src/app/_components/quick-actions.tsx`

**Intent**: Add a third action ("Start break") that opens a compact short/long + duration picker; confirming calls `startAdHocBreak`.

**Contract**: New `onStartBreak?: (kind, durationSec) => Promise<void>` prop and a picker surface reusing `DurationPicker` ([duration-picker.tsx:53](src/app/_components/duration-picker.tsx)) with short/long presets (`getShort/getLongBreakPresets`) and defaults (`getShort/getLongBreakDuration`). Follow the existing `icon + label + chevron` item pattern in the **widget variant** (add to the `items` array); also add a corresponding button in the **inline variant** (hardcoded JSX row) so "Start break" appears in both renders. Add `data-testid` (e.g. `quick-action-start-break`).

#### 3. Dashboard wiring

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass a handler from the dashboard's `usePomodoroCycleContext` into `QuickActions`, so the persistent action is available across idle states.

**Contract**: Wire `onStartBreak` → `pomodoro.startAdHocBreak` at the `QuickActions` mount ([pomodoro-dashboard.tsx:999-1005](src/app/_components/pomodoro-dashboard.tsx)). The break bypasses the focus-permission prompt (that gate is WORK-only).

#### 4. i18n for the action

**File**: `messages/en.json`, `messages/pl.json`

**Intent**: Copy for the "Start break" action and picker labels.

**Contract**: New keys (both locales) for the action label and short/long pick; reuse existing break labels where possible.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] `quick-actions` component tests pass (new Start break action): `pnpm exec vitest run src/app/_components/quick-actions.test.tsx`
- [ ] Hook tests pass, incl. new `startAdHocBreak` cases (both modes, no counter touch): `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`

#### Manual Verification:

- [ ] "Start break" appears in the calm rail across idle states (session-start idle, post-break idle, after a timed-out session).
- [ ] Picker lets user choose short/long + duration; starting runs a break that overtimes and ends into kickoff.
- [ ] Works in both guest and authenticated modes; no interruption count or cadence change (check that the next real work cycle's first-cycle intention still fires).

**Implementation Note**: Pause here for manual confirmation before Phase 4.

---

## Phase 4: Server validation + regression sweep

### Overview

Close the pre-existing kind-aware duration-validation gap and run the full break-behavior regression across the affected test cluster, ending with the e2e belt.

### Changes Required:

#### 1. Kind-aware duration bound in cycle.create

**File**: `src/server/api/routers/cycle.ts`

**Intent**: Reject break cycles longer than the break cap; keep the work-cycle bounds for WORK.

**Contract**: Validate `configuredDurationSec` per `kind` — breaks bounded by `MIN_BREAK_DURATION_SEC`/`MAX_BREAK_DURATION_SEC` (1800), WORK by the existing work bounds ([cycle.ts:85-89](src/server/api/routers/cycle.ts)). This is a **loosening** of the min for breaks (from `minWorkCycleSec` → 1 sec) and a **tightening** of the max (from 90 min → 30 min); all existing break presets (max 20 min) are within the new bounds. Add/extend a router test asserting an oversized break is rejected.

#### 2. Break test cluster regression

**File**: `src/hooks/use-pomodoro-cycle.test.tsx`, `src/app/_components/cycle-complete-overlay.test.tsx`, `src/lib/catch-up/derive-gate.test.ts`, `src/lib/format-remaining.test.ts`, `src/app/_components/quick-actions.test.tsx`

**Intent**: Update oracles that locked the old freeze-at-0 / `BREAK_CONFIRM` / auto-overlay behavior; add coverage for overtime + ad-hoc entry per lessons (hook/component layer, dismiss oracle per gate).

**Contract**: Update the break cluster incl. `"break complete returns to idle"` ([:1203](src/hooks/use-pomodoro-cycle.test.tsx)), the check-in-gated break tests ([:1623](src/hooks/use-pomodoro-cycle.test.tsx), [:2026](src/hooks/use-pomodoro-cycle.test.tsx)), out-of-tab alert ([:4377](src/hooks/use-pomodoro-cycle.test.tsx)), and optimistic break tests ([:3278](src/hooks/use-pomodoro-cycle.test.tsx)) to the new semantics. New tests: overtime accrual/pause-freeze/tab-return, End break → kickoff, `startAdHocBreak` no-counter-touch in both modes.

#### 3. E2E belt gate

**File**: `e2e/` (existing break specs)

**Intent**: Confirm no regression at the browser layer; keep specs fast per L-06 (don't add heavy multi-cycle e2e — cover logic at the hook layer).

**Contract**: Run `pnpm test:e2e:belt`; fix any break-related spec fallout. Add at most a thin happy-path e2e for ad-hoc break start only if a browser-only gap exists.

### Success Criteria:

#### Automated Verification:

- [ ] Type checking passes: `pnpm typecheck`
- [ ] Lint/format passes: `pnpm check`
- [ ] Cycle router tests pass (kind-aware bound): `pnpm exec vitest run src/server/api/routers/cycle.test.ts`
- [ ] Full unit/integration suite passes: `pnpm test`
- [ ] E2E belt passes: `pnpm test:e2e:belt`

#### Manual Verification:

- [ ] Attempting a break > 30 min is rejected server-side.
- [ ] End-to-end: ad-hoc break from idle → overtime → End break → kickoff, with no penalty, in a real browser session.
- [ ] No regression in the normal work → check-in → cadence-break → overtime → kickoff flow.

**Implementation Note**: Final phase — full green before archiving.

---

## Testing Strategy

### Unit Tests:

- Timer worker logic: overtime emission past `endTime`, interval survives to inbound `stop`.
- `format-remaining`: `+MM:SS` overtime rendering; positive path unchanged.
- `derive-gate`: no `BREAK_CONFIRM` for breaks; `WORK_CONFIRM` unaffected.
- `cycle.ts` router: kind-aware duration bounds.

### Integration Tests (hook/component):

- `use-pomodoro-cycle`: break expiry → overtime (not completed); pause freezes; tab-return resumes; recovery resumes overtime; `startAdHocBreak` creates in both modes without touching `completedWorkCycles`/`interruptionCount`; End break → `postBreakIdleFlag`/kickoff.
- `timer-panel` / `cycle-complete-overlay`: overtime display + End break control; no break overlay auto-pop; dismiss oracle for End break.
- `quick-actions`: Start break action opens picker and invokes handler.

### Manual Testing Steps:

1. From a fresh idle state, open "Start break", pick a short break + duration, start.
2. Let it pass the configured end; confirm inline `+MM:SS` count-up and "End break" button, no overlay.
3. Pause mid-overtime → count freezes; resume → continues.
4. Hide tab during overtime, return → count still running (test both worker and `MAIN_THREAD_TIMER` modes).
5. Click End break → lands in next-task kickoff; verify no interruption count and next work cycle's first-cycle intention still fires.
6. Repeat in guest and authenticated modes.

## Performance Considerations

The overtime timer keeps a 1s interval alive past configured end (worker or fallback) — same cost as a running cycle, no new hot path. Overtime display reuses existing tick rendering. NFR-200ms is unaffected (no new blocking network on any interactive surface).

## Migration Notes

No schema or data migration. `cycle.endedAt` already stamps accept time; existing in-flight breaks recovered after deploy will resume in overtime via the updated `resumeFromActiveCycle`.

## References

- Frame brief: [context/changes/adhoc-rest-time/frame.md](context/changes/adhoc-rest-time/frame.md)
- Research: [context/changes/adhoc-rest-time/research.md](context/changes/adhoc-rest-time/research.md)
- Template for A: `src/hooks/use-pomodoro-cycle.ts:2418` (`startBreakAfterWorkComplete`)
- Overtime seams: `src/workers/timer-worker-logic.ts:14`, `src/hooks/use-pomodoro-cycle.ts:688`
- Lessons: `context/foundation/lessons.md` — "Test every wedge transition…", L-06 (e2e demotion)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append `— <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Overtime timer core (B — logic)

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck`
- [x] 1.2 Lint/format passes: `pnpm check`
- [x] 1.3 Timer worker logic unit tests pass (overtime cases)
- [x] 1.4 Hook tests pass, incl. overtime cases

#### Manual

- [ ] 1.5 Break past configured duration keeps counting, not `completed`, `endTimeRef` set
- [ ] 1.6 Pause freezes accrued overtime; resume continues upward
- [ ] 1.7 Hidden-tab return resumes overtime in both worker and fallback modes

### Phase 2: Overtime UI + accept + catch-up (B — presentation)

#### Automated

- [ ] 2.1 Type checking passes: `pnpm typecheck`
- [ ] 2.2 Lint/format passes: `pnpm check`
- [ ] 2.3 `format-remaining` tests pass (overtime rendering)
- [ ] 2.4 `derive-gate` tests pass (BREAK_CONFIRM retired)
- [ ] 2.5 `cycle-complete-overlay` + `timer-panel` component tests pass
- [ ] 2.6 No missing-i18n-key errors

#### Manual

- [ ] 2.7 Overtime shows `+MM:SS` + End break button, no overlay auto-pop
- [ ] 2.8 End break advances to kickoff (no dead-end)
- [ ] 2.9 End break works while paused-in-overtime (no resume needed)
- [ ] 2.10 Copy reads calm in en + pl; not alarming
- [ ] 2.11 `prefers-reduced-motion` respected

### Phase 3: Ad-hoc break entry (A)

#### Automated

- [ ] 3.1 Type checking passes: `pnpm typecheck`
- [ ] 3.2 Lint/format passes: `pnpm check`
- [ ] 3.3 `quick-actions` component tests pass (Start break action)
- [ ] 3.4 Hook tests pass, incl. `startAdHocBreak` (both modes, no counter touch)

#### Manual

- [ ] 3.5 "Start break" appears across idle states
- [ ] 3.6 Picker chooses short/long + duration; break overtimes and ends into kickoff
- [ ] 3.7 Works in guest + authenticated; no interruption/cadence change (first-cycle intention still fires)

### Phase 4: Server validation + regression sweep

#### Automated

- [ ] 4.1 Type checking passes: `pnpm typecheck`
- [ ] 4.2 Lint/format passes: `pnpm check`
- [ ] 4.3 Cycle router tests pass (kind-aware bound)
- [ ] 4.4 Full unit/integration suite passes: `pnpm test`
- [ ] 4.5 E2E belt passes: `pnpm test:e2e:belt`

#### Manual

- [ ] 4.6 Break > 30 min rejected server-side
- [ ] 4.7 End-to-end ad-hoc break → overtime → End break → kickoff, no penalty, real browser
- [ ] 4.8 No regression in normal work → check-in → cadence-break → overtime → kickoff
