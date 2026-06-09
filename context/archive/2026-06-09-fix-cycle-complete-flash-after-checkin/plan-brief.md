# Fix Cycle Complete overlay flash after check-in — Plan Brief

> Full plan: `context/changes/fix-cycle-complete-flash-after-checkin/plan.md`
> Research: `context/changes/fix-cycle-complete-flash-after-checkin/research.md`

## What & Why

After submitting energy at authenticated WORK cycle end, the stale **Cycle Complete!** modal re-flashes for seconds until the break starts. Root cause: `submitCheckIn` clears `awaitingCheckIn` before `state` leaves `"completed"`, reopening the dashboard overlay mount gate during async `confirmComplete` / break creation.

## Starting Point

S-05 added `awaitingCheckIn` to hide `CycleCompleteOverlay` during check-in. S-16 added `awaitingWindDown` the same way. There is no equivalent guard for the post-check-in async gap between check-in API success and `setState("running")` in `startBreakAfterWorkComplete`. The same gap reopens on wind-down **Keep going** because `awaitingCheckIn` was cleared earlier.

## Desired End State

Submitting energy transitions calmly to break start (or wind-down nudge) with no stale cycle-complete modal. Check-in overlay shows submitting state on the normal path; **Keep going** shows timer-only transition until break runs. S-06 suggestion fetch still runs after `confirmComplete`.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Primary fix location | Hook-first in `continueAfterCheckIn` | Owns the async window; minimal surface vs new UI shell | Research |
| Check-in clear timing | Defer `setAwaitingCheckIn(false)` until after successful `confirmComplete` | Keeps check-in overlay mounted during transition; error path retries check-in | Research / Plan |
| Wind-down branch | Keep immediate `setAwaitingCheckIn(false)` before `setAwaitingWindDown(true)` | Wind-down overlay replaces check-in; must not enter transition flag | Research |
| Secondary guard | `isPostCheckInTransitioning` + dashboard gate | Covers `onWindDownKeepGoing` where `awaitingCheckIn` is already false; mirrors S-16 | Research / Plan |
| S-06 ordering | Unchanged: `confirmComplete` then `fetchPostCheckInSuggestion` | Cycle-count correctness for suggestions | Research |
| E2E | Optional; unit tests required | Deferred mocks catch the flash cheaply; e2e only if auth fixture is low-cost | Plan |

## Scope

**In scope:**

- `use-pomodoro-cycle.ts`: transition flag, deferred check-in clear, wind-down branch explicit clear
- `pomodoro-dashboard.tsx`: `!isPostCheckInTransitioning` on cycle-complete mount (and catch-up if reachable)
- Unit tests for flash-window invariant on `submitCheckIn` and `onWindDownKeepGoing`

**Out of scope:**

- New loading-shell component
- Reordering suggestion fetch before break start
- Guest/break cycle-end flow changes
- Unrelated catch-up polish

## Architecture / Approach

```
submitCheckIn (normal) ──► continueAfterCheckIn
                              ├─ isPostCheckInTransitioning = true
                              ├─ confirmComplete → setState("running")
                              ├─ fetchPostCheckInSuggestion (unchanged order)
                              ├─ setAwaitingCheckIn(false) on success
                              └─ isPostCheckInTransitioning = false (finally)

submitCheckIn (wind-down) ──► setAwaitingCheckIn(false) → awaitingWindDown (no continueAfterCheckIn)

onWindDownKeepGoing ──► continueAfterCheckIn (same transition guard)

Dashboard: CycleCompleteOverlay mounted only when
  !awaitingCheckIn && !awaitingWindDown && !isPostCheckInTransitioning
```

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Hook transition guard | Closes flash at source; wind-down exclusion preserved | Error path must leave user on check-in overlay |
| 2. Dashboard gate | Belt-and-suspenders S-16 mirror | Low — declarative condition |
| 3. Regression tests | Vitest deferred-async flash assertions | Mock timing must expose intermediate renders |

**Prerequisites:** S-05 check-in gate, S-06 suggestion ordering, S-16 wind-down gate (all shipped)

**Estimated effort:** ~1 session across 3 phases

## Open Risks & Assumptions

- Failed `confirmComplete` must not clear `awaitingCheckIn` prematurely — covered by defer-until-success contract
- Catch-up `WORK_CONFIRM` during transition assumed unreachable; verify in Phase 1 and gate if not
- Optional e2e skipped unless existing authenticated cycle-end harness is cheap

## Success Criteria (Summary)

- No **Cycle Complete!** flash after energy submit until break timer visible
- Wind-down after check-in and **Keep going** paths behave as today minus the flash
- Unit tests fail on pre-fix intermediate state; full `pnpm test` green
