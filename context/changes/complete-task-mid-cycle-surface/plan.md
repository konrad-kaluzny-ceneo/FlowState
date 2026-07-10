# One Session = One Task — Mandatory Break on Focused-Task Completion

## Overview

Rework the mid-cycle task-completion model so it enforces the rhythm **"one
session = one task, then a break to clear the mind."** Completing the *focused*
task (from `/tasks` or `/focus`) ends the cycle into a **mandatory, user-chosen
break**; completing a *non-focused* task just marks it done with no session
effect; the "continue this cycle with a different task" branch is removed; and
every WORK→break transition gains a **short/long break chooser** with the
cadence suggestion starred (★). The session-end "did you finish the task?"
prompt is unchanged.

## Current State Analysis

Grounded in the frame brief (`frame.md`) and code research:

- **Completion is task-agnostic today.** `onMidCycleMarkComplete`
  ([use-pomodoro-cycle.ts:2700](src/hooks/use-pomodoro-cycle.ts)) fires for every
  task row (`canMidCycleMarkComplete`, [task-list.tsx:609](src/app/_components/task-list.tsx))
  and opens `MidCycleCompletionPrompt`, which offers "continue with another
  task" (via `onMidCycleContinueWithTask` → `cycles.rebindTask`) or "end cycle &
  break" (`onMidCycleEndCycleAndBreak`). No focused/non-focused distinction.
- **The overlay is mounted only on `/focus`.** `pomodoro-dashboard.tsx:1058`
  renders the prompt; `/tasks` wires the trigger to shared context but renders
  nothing — hence "nothing visible" when completing from `/tasks`.
- **Break kind is auto-decided.** `startBreakAfterWorkComplete`
  ([use-pomodoro-cycle.ts:2156](src/hooks/use-pomodoro-cycle.ts)) increments
  `completedWorkCycles` and picks `SHORT`/`LONG` by `newCount % 4 === 0`, then
  creates the break cycle. Duplicated in `computeBreakAfterWork`
  ([:223](src/hooks/use-pomodoro-cycle.ts)). No user choice, no star.
- **Break transitions flow through one entry point.** After a WORK cycle
  completes and the (authenticated) check-in runs, `continueAfterCheckIn` calls
  `startBreakAfterWorkComplete(markTaskDone)` at
  [:2331](src/hooks/use-pomodoro-cycle.ts); the guest/non-WORK mid-cycle path
  calls it at [:3029](src/hooks/use-pomodoro-cycle.ts).
- **The transition conductor is a pure priority matrix.**
  `resolveWedgeBeat` ([transition-conductor.ts:104](src/lib/wedge/transition-conductor.ts))
  picks at most one gate: `session_closure → wind_down → check_in →
  cycle_complete`. A new gate is added here.
- **`cycles.rebindTask` exists only for the removed branch.** It spans the
  `CycleRepository` interface (`data-mode/types.ts`), both repos
  (`guest-repositories.ts`, `server-repositories.ts`), and the cycle router.
- **`resumeNote` is independent** of the mid-cycle prompt (used by day-memory,
  task detail, suggestion card, narrative) — left untouched.
- **Rule 8 already satisfied.** The WORK-variant `CycleCompleteOverlay`
  ([cycle-complete-overlay.tsx:152](src/app/_components/cycle-complete-overlay.tsx))
  already asks "mark complete / continue later" at cycle end.

## Desired End State

- Completing the focused task from either surface marks it done and transitions
  into a mandatory break, preceded (authenticated) by the existing energy
  check-in, then a break-kind chooser. Verify: focused-completion on `/tasks`
  redirects to `/focus` and plays the same gates as `/focus`.
- Completing a non-focused task during a running cycle marks it done and the
  session/timer is unaffected. Verify: focused task and remaining time unchanged.
- Every WORK→break transition shows a blocking chooser with Short and Long
  options, the cadence-suggested one marked ★ and pre-selected. Verify: choosing
  Long resets the long-break cadence.
- `MidCycleCompletionPrompt`, `onMidCycleContinueWithTask`, and `cycles.rebindTask`
  no longer exist. Verify: `pnpm typecheck` + `grep` clean.
- **Focus time is recorded for early-completed sessions.** Finishing the focused
  task ends the WORK cycle via `cycles.complete` (COMPLETED + `endedAt`), so the
  partial elapsed minutes land in the recap KPIs and the day-plan budget. Verify:
  a WORK cycle completed early shows `focusMinutes > 0` and increments used focus
  minutes. (This is the gap today: the removed "continue with another task"
  branch rebinds the running cycle instead of completing it, so that focus period
  is never counted.)

### Key Discoveries:

- Break start is centralized at `continueAfterCheckIn:2331` — the single best
  insertion point for the chooser gate on the natural path.
- `onMidCycleEndCycleAndBreak` already routes WORK+authenticated completion
  through `awaitingCheckIn`; the new focused-completion handler reuses this.
- The conductor's `cyclePaused` short-circuit and `GATE_PRIORITY` ordering mean
  the new gate must be added to both `gateCandidates` and `GATE_PRIORITY`.
- `handleEndSessionClick`/`EndSessionConfirmOverlay`
  ([pomodoro-dashboard.tsx:281](src/app/_components/pomodoro-dashboard.tsx))
  are the session-end path — untouched (rule 8 covered elsewhere).

## What We're NOT Doing

- Not adding a new "did you finish the task?" prompt to session-end (rule 8 is
  already covered by the cycle-complete overlay).
- Not changing `resumeNote` behavior or its other consumers.
- Not changing break *durations* or the `%4` cadence length — only who chooses
  and how overrides affect the counter.
- Not rendering the full wedge overlay stack on `/tasks` — we redirect to
  `/focus` instead.
- Not changing the natural timer-expiry completion prompt semantics.

## Implementation Approach

Build the break-kind chooser gate first (Phase 1) since both the natural path and
the new focused-completion path terminate in it. Then rewrite completion
semantics and delete the continue-with-another-task UI/hook branch (Phase 2),
followed by the server/interface removal of `rebindTask` (Phase 3, whose only
caller Phase 2 deleted). Finally wire the two completion triggers — the `/focus`
circle and the `/tasks`→`/focus` redirect (Phase 4).

`use-pomodoro-cycle.ts` is a high-blast-radius timer-hub file: run
`pnpm change-impact src/hooks/use-pomodoro-cycle.ts` before editing and heed its
co-change/test suggestions (AGENTS.md "Maintainer tooling").

## Critical Implementation Details

- **Timing & lifecycle (break gate):** the chooser must intercept *before*
  `startBreakAfterWorkComplete` creates the break cycle — otherwise the break is
  already running when the user "chooses". Set a new `awaitingBreakChoice` +
  `suggestedBreakKind` in place of the direct call at `continueAfterCheckIn:2331`
  and the guest path at `:3029`; the chooser's confirm invokes
  `startBreakAfterWorkComplete(markTaskDone, chosenKind)`. Preserve the
  `pendingMarkTaskDone` value across the gate.
- **State sequencing (cadence override):** the "override resets rhythm" rule is:
  track cycles since the last long break; the ★ suggestion is Long when the next
  cycle would reach the 4-cycle mark; *taking* a Long break (suggested or chosen)
  resets that counter to 0; taking Short increments it. This replaces the raw
  `completedWorkCycles % 4` decision — `completedWorkCycles` itself still
  increments for narrative/stats.
- **User experience spec (`/tasks` redirect):** only the *focused* task's
  completion redirects to `/focus`; a non-focused completion must not navigate.
  The redirect should fire after the completion mutation is dispatched so the
  gates find the expected state on `/focus`.
- **Focus-time accounting (load-bearing):** the focused-completion handler MUST
  end the WORK cycle through the `cycles.complete` path (which sets `state =
  COMPLETED`, `endedAt = now`, and — via `withWorkDayPlanKey` — passes
  `localDateKey`), never `cycles.interrupt`. `computeCycleFocusedMinutes` only
  counts COMPLETED WORK cycles and caps elapsed at the configured duration, so an
  interrupted cycle silently records **zero** focus minutes. This is the specific
  regression risk that made early-completion time uncounted today; the guest path
  must complete the cycle the same way for parity.

---

## Phase 1: Break-kind chooser gate

### Overview

Introduce a blocking break-kind chooser shown on every WORK→break transition,
with the cadence-based suggestion starred and pre-selected, and make break-kind
an explicit input to break creation with override-resets-rhythm cadence.

### Changes Required:

#### 1. Transition conductor — new gate

**File**: `src/lib/wedge/transition-conductor.ts`

**Intent**: Add a `break_choice` gate so the chooser is the single active
overlay while the user picks a break kind, ordered after `check_in` and above
`cycle_complete`.

**Contract**: Extend `WedgeGate` with `"break_choice"`; add `awaitingBreakChoice`
to `WedgeConductorInput`; add `showBreakChoice` to `WedgeConductorOutput`; insert
into `gateCandidates` (respecting the `cyclePaused` short-circuit) and into
`GATE_PRIORITY` between `check_in` and `cycle_complete`.

#### 2. Break-kind suggestion + override cadence

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Replace the silent `%4` decision with an explicit suggestion the
chooser can display and override, and reset the long-break cadence when a Long
break is taken.

**Contract**: `startBreakAfterWorkComplete(markTaskDone, breakKind?)` — when
`breakKind` is provided, use it; otherwise fall back to the suggestion. Add
cadence state (cycles-since-last-long) with reset-on-long semantics; derive
`suggestedBreakKind`. Keep `computeBreakAfterWork` as the pure suggestion helper
(update its callers/tests accordingly).

#### 3. Defer break start to the chooser

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: At the two break-start sites, open the gate instead of starting the
break directly; the chooser confirm resumes the flow.

**Contract**: At `continueAfterCheckIn` ([:2331](src/hooks/use-pomodoro-cycle.ts))
and the guest/non-WORK path ([:3029](src/hooks/use-pomodoro-cycle.ts)), set
`awaitingBreakChoice = true` + `suggestedBreakKind` and stash `pendingMarkTaskDone`
rather than calling `startBreakAfterWorkComplete`. Expose `awaitingBreakChoice`,
`suggestedBreakKind`, and `onChooseBreak(kind)` from the hook; `onChooseBreak`
clears the gate and calls `startBreakAfterWorkComplete(markTaskDone, kind)`.

#### 4. BreakChoiceOverlay component

**File**: `src/app/_components/break-choice-overlay.tsx` (new)

**Intent**: Blocking overlay offering Short and Long, the suggested one marked
★ and pre-selected, confirming into the break.

**Contract**: Props `{ suggestedKind, onChoose(kind), isSubmitting }`. Follows
the `OverlayScrim`/`OverlayCard` pattern; `data-testid="break-choice-overlay"`
with per-option testids and a visible ★ on the suggested option.

#### 5. Mount + wire the overlay

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Render `BreakChoiceOverlay` when the conductor's `showBreakChoice`
beat is active.

**Contract**: Add to the wedge-beat overlay block alongside the existing gates,
driven by `wedgeBeat.showBreakChoice`, passing `pomodoro.suggestedBreakKind` and
`pomodoro.onChooseBreak`.

#### 6. Copy

**File**: `messages/pl.json`, `messages/en.json`

**Intent**: Add a `BreakChoice` namespace (heading, Short/Long labels, suggested
marker/aria).

**Contract**: Mirror keys in both locales; user-facing strings via next-intl.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Conductor unit tests pass (new `break_choice` priority cases): `pnpm exec vitest run src/lib/wedge/transition-conductor.test.ts`
- Hook tests pass (gate opens before break; override resets cadence): `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- Overlay component test passes: `pnpm exec vitest run src/app/_components/break-choice-overlay.test.tsx`

#### Manual Verification:

- Finishing a WORK cycle shows the chooser with the ★ on the cadence-suggested option, pre-selected.
- Choosing Long resets the cadence (next suggestion is Short for the following 3 cycles).
- The chooser is dismiss-safe: selecting an option closes it and the break starts.

**Implementation Note**: After automated verification passes, pause for human confirmation of manual testing before Phase 2.

---

## Phase 2: Focused-task completion → mandatory break; remove continue-with-another-task

### Overview

Make focused-task completion mark the task done and route into the check-in →
break-choice → break flow; make non-focused completion a plain completion; and
delete the continue-with-another-task UI and hook branch.

### Changes Required:

#### 1. Split completion semantics in the hook

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Replace `onMidCycleMarkComplete`'s prompt behavior with a focused-only
handler that marks the focused task done and enters the mandatory-break flow;
fold in `onMidCycleEndCycleAndBreak`'s check-in/break routing.

**Contract**: New `onCompleteFocusedTask()` (name at implementer's discretion) —
guards `state === "running" && cycleKind === "WORK" && focused task active`, and
enters the WORK-complete path (check-in for authenticated; direct for guest) that
**completes** the cycle via `cycles.complete` with `markTaskDone: true` and
terminates in the Phase 1 break gate. Must use the complete path (not
`interrupt`) so partial focus minutes are recorded (see Critical Implementation
Details → Focus-time accounting). Remove `onMidCycleContinueWithTask`,
`onMidCycleEndCycleAndBreak`, `midCyclePendingTask`, `midCycleOtherActiveTasks`,
and related submit state from the hook's return.

#### 2. Task-list: focused-only mid-cycle completion

**File**: `src/app/_components/task-list.tsx`

**Intent**: During a running WORK cycle, only the focused task's complete-circle
triggers the mandatory-break flow; other rows complete normally.

**Contract**: `canMidCycleMarkComplete` becomes true only when
`task.id === focusedTaskId` (plus existing running/WORK conditions). Non-focused
rows fall through to the existing `onBeginComplete` + `onUpdateTask({status:
"completed"})` path. Update the `onMidCycleMarkComplete` prop name/shape to the
new handler.

#### 3. Remove the prompt component + its wiring

**File**: `src/app/_components/mid-cycle-completion-prompt.tsx` (delete),
`src/app/_components/pomodoro-dashboard.tsx`, `src/app/tasks/page.tsx`

**Intent**: Delete the component and every reference; the mandatory-break flow
replaces it.

**Contract**: Remove `MidCycleCompletionPrompt` import/usage and
`midCycleOtherActiveTasks` from `pomodoro-dashboard.tsx`; update the `TaskList`
callback wiring in `tasks/page.tsx` to the new handler.

#### 4. Tests: retire and update

**File**: `src/app/_components/mid-cycle-completion-prompt.test.tsx` (delete),
`e2e/mid-cycle-last-task.spec.ts` (delete/replace), hook + dashboard tests

**Intent**: Remove tests for the deleted branch; add/adjust coverage for the new
focused/non-focused split and mandatory break.

**Contract**: New hook tests assert focused completion → break flow and
non-focused completion leaves the cycle untouched. Update
`pomodoro-dashboard.test.tsx` and `use-pomodoro-cycle.test.tsx` references.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Hook tests pass (focused vs non-focused split): `pnpm exec vitest run src/hooks/use-pomodoro-cycle.test.tsx`
- Dashboard tests pass: `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- Focus-time test passes: an early-completed WORK cycle records `focusMinutes > 0` and increments used focus minutes (recap/day-plan): `pnpm exec vitest run src/lib/recap/aggregate-day-stats.test.ts src/server/api/routers/cycle.test.ts`
- No references remain: `grep -r "MidCycleCompletionPrompt\|onMidCycleContinueWithTask\|midCyclePendingTask" src` returns nothing

#### Manual Verification:

- Completing the focused task mid-cycle marks it done and enters the break flow (no next-task selection appears).
- Completing a non-focused task during a cycle marks it done; the timer and focused task are unchanged.
- After finishing a task early, the day recap Focus-time / used-minutes reflect the partial time spent (not zero).

**Implementation Note**: Pause for human confirmation before Phase 3.

---

## Phase 3: Full removal of `cycles.rebindTask`

### Overview

Remove the now-orphaned `rebindTask` across the repository interface, both
implementations, the router, and tests.

### Changes Required:

#### 1. Repository interface

**File**: `src/lib/data-mode/types.ts`

**Intent**: Drop `rebindTask` from `CycleRepository`.

**Contract**: Remove the method signature; downstream implementers must follow.

#### 2. Both repositories

**File**: `src/lib/repositories/guest-repositories.ts`,
`src/lib/repositories/server-repositories.ts`

**Intent**: Remove the guest and server implementations.

**Contract**: Delete each `rebindTask` implementation; the server wrapper's tRPC
call is removed with the router procedure below.

#### 3. Cycle router

**File**: `src/server/api/routers/cycle.ts`, `src/server/api/routers/cycle.test.ts`

**Intent**: Remove the `rebindTask` procedure and its tests.

**Contract**: Delete the procedure from the cycle router; remove/adjust
`cycle.test.ts` cases referencing it. Keep the rest of the router intact.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Full unit/integration suite passes: `pnpm test`
- No references remain: `grep -r "rebindTask" src` returns nothing

#### Manual Verification:

- N/A (internal removal; behavior covered by Phase 2 manual checks).

**Implementation Note**: Pause for human confirmation before Phase 4.

---

## Phase 4: Completion triggers — `/focus` circle + `/tasks`→`/focus` redirect

### Overview

Add the focused-task completion circle to the `/focus` timer surface and redirect
`/tasks` focused-task completion to `/focus` so the transition gates play there.

### Changes Required:

#### 1. `/focus` completion circle

**File**: `src/app/_components/pomodoro-dashboard.tsx` (+ the focus timer
surface that renders `pomodoro.focusedTask`)

**Intent**: Render a completion circle beside the focused task title during a
running WORK cycle that invokes the Phase 2 focused-completion handler.

**Contract**: A check-circle affordance (mirroring the task-list circle,
restrained per DESIGN.md), `data-testid="focus-complete-focused-task"`, disabled
while submitting; on click calls `pomodoro.onCompleteFocusedTask()`.

#### 2. `/tasks` focused-completion redirect

**File**: `src/app/tasks/page.tsx`

**Intent**: When the completed task is the focused one, navigate to `/focus`
after dispatching completion so the check-in/break-choice gates render there;
non-focused completion stays in place.

**Contract**: In the `onMidCycleMarkComplete`/new-handler wiring, branch on
`task.id === pomodoro.focusedTaskId`: focused → call the handler then
`router.push("/focus")` (next/navigation); non-focused → normal completion, no
navigation.

#### 3. Copy

**File**: `messages/pl.json`, `messages/en.json`

**Intent**: Aria/label for the `/focus` completion circle.

**Contract**: Add keys in both locales.

### Success Criteria:

#### Automated Verification:

- Type checking passes: `pnpm typecheck`
- Lint/format passes: `pnpm check`
- Component tests pass (focus circle triggers handler): `pnpm exec vitest run src/app/_components/pomodoro-dashboard.test.tsx`
- Belt e2e passes: `pnpm test:e2e:belt`

#### Manual Verification:

- On `/focus`, the completion circle beside the focused task ends the cycle into the break flow.
- On `/tasks`, completing the focused task redirects to `/focus` and the gates (check-in → break chooser) play; completing a non-focused task stays on `/tasks` with no session change.

**Implementation Note**: Pause for human confirmation; this is the final phase.

---

## Testing Strategy

### Unit Tests:

- Conductor: `break_choice` wins over `cycle_complete`, loses to `check_in`, and is suppressed when `cyclePaused`.
- Hook: break gate opens before `startBreakAfterWorkComplete`; explicit break-kind honored; Long resets cadence; focused completion → break; non-focused completion leaves cycle intact.
- BreakChoiceOverlay: ★ on suggested option; both options selectable; dismiss-oracle (closes on choose).

### Integration Tests:

- Guest and authenticated parity for focused completion → break (per data-mode).

### Manual Testing Steps:

1. Start a WORK cycle, finish the focused task on `/focus` → check-in (auth) → break chooser (★ suggestion) → break runs.
2. Repeat from `/tasks` → redirected to `/focus`, same gates.
3. Complete a non-focused task during a cycle → it completes, timer unaffected.
4. Complete 4 cycles taking Short each time → 4th suggests Long; then take Long early on a later run → cadence resets.

## Performance Considerations

None beyond existing timer-hub constraints; the chooser adds one gate render, no
new network round-trips (break creation already deferred to confirm).

## Migration Notes

No data migration. `rebindTask` removal is code-only; no persisted data depends
on it.

## References

- Frame brief: `context/changes/complete-task-mid-cycle-surface/frame.md`
- Break machinery: `src/hooks/use-pomodoro-cycle.ts:2156,2331,3029`
- Conductor: `src/lib/wedge/transition-conductor.ts:104`
- Lessons: "Test every wedge transition before shipping" (dismiss-oracle per gate); L-06 (task-list on `/tasks`)

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles. See `references/progress-format.md`.

### Phase 1: Break-kind chooser gate

#### Automated

- [x] 1.1 Type checking passes: `pnpm typecheck` — 64f4e18
- [x] 1.2 Lint/format passes: `pnpm check` — 64f4e18
- [x] 1.3 Conductor unit tests pass (new `break_choice` priority cases) — 64f4e18
- [x] 1.4 Hook tests pass (gate opens before break; override resets cadence) — 64f4e18
- [x] 1.5 Overlay component test passes — 64f4e18

#### Manual

- [x] 1.6 Chooser shows with ★ on cadence-suggested option, pre-selected — 64f4e18
- [x] 1.7 Choosing Long resets the cadence — 64f4e18
- [x] 1.8 Chooser is dismiss-safe: selecting an option closes it and the break starts — 64f4e18

### Phase 2: Focused-task completion → mandatory break; remove continue-with-another-task

#### Automated

- [x] 2.1 Type checking passes: `pnpm typecheck` — e276447
- [x] 2.2 Lint/format passes: `pnpm check` — e276447
- [x] 2.3 Hook tests pass (focused vs non-focused split) — e276447
- [x] 2.4 Dashboard tests pass — e276447
- [x] 2.5 Focus-time test passes (early-completed WORK cycle records focusMinutes > 0 + increments used minutes) — e276447
- [x] 2.6 No references remain to the removed prompt/branch (`grep` clean) — e276447

#### Manual

- [x] 2.7 Focused completion marks done + enters break flow (no next-task selection) — e276447
- [x] 2.8 Non-focused completion marks done; timer and focused task unchanged — e276447
- [x] 2.9 Day recap Focus-time / used-minutes reflect partial time after early completion (not zero) — e276447

### Phase 3: Full removal of `cycles.rebindTask`

#### Automated

- [x] 3.1 Type checking passes: `pnpm typecheck` — ebb5c77
- [x] 3.2 Lint/format passes: `pnpm check` — ebb5c77
- [x] 3.3 Full unit/integration suite passes: `pnpm test` — ebb5c77
- [x] 3.4 No references remain: `grep -r "rebindTask" src` clean — ebb5c77

### Phase 4: Completion triggers — `/focus` circle + `/tasks`→`/focus` redirect

#### Automated

- [x] 4.1 Type checking passes: `pnpm typecheck` — 5f74981
- [x] 4.2 Lint/format passes: `pnpm check` — 5f74981
- [x] 4.3 Component tests pass (focus circle triggers handler) — 5f74981
- [x] 4.4 Belt e2e passes: `pnpm test:e2e:belt` — 5f74981

#### Manual

- [x] 4.5 `/focus` completion circle ends the cycle into the break flow — 5f74981
- [x] 4.6 `/tasks` focused completion redirects to `/focus` and gates play; non-focused stays put — 5f74981
