---
date: 2026-06-09T00:00:00+02:00
researcher: Auto (Cursor Agent)
git_commit: 534f19d95c156c8ddcfa52551a4b8955f2b225c8
branch: features/fix-cycle-complete-flash-after-checkin
repository: FlowState
topic: "Cycle Complete overlay flash after check-in submit (B-04)"
tags: [research, codebase, cycle-complete-overlay, check-in, awaitingCheckIn, state-machine, B-04]
status: complete
last_updated: 2026-06-09
last_updated_by: Auto (Cursor Agent)
---

# Research: Cycle Complete overlay flash after check-in submit (B-04)

**Date**: 2026-06-09
**Researcher**: Auto (Cursor Agent)
**Git Commit**: `534f19d95c156c8ddcfa52551a4b8955f2b225c8`
**Branch**: `features/fix-cycle-complete-flash-after-checkin`
**Repository**: FlowState

## Research Question

After submitting energy at cycle end, why does the stale **Cycle Complete!** modal re-flash/hang until break/suggestion loads? Is the root cause the `awaitingCheckIn=false` + `state=completed` gap in the cycle panel state machine?

## Summary

**Yes — confirmed.** The flash is caused by a deterministic state-machine gap introduced in S-05 (check-in gate):

1. `submitCheckIn` clears `awaitingCheckIn` immediately after the check-in API succeeds (`use-pomodoro-cycle.ts:1419`).
2. `state` remains `"completed"` until `confirmComplete` → `startBreakAfterWorkComplete` finishes async work and calls `setState("running")` (`use-pomodoro-cycle.ts:1129`).
3. The dashboard remounts `CycleCompleteOverlay` whenever `!awaitingCheckIn && !awaitingWindDown` (`pomodoro-dashboard.tsx:311`), and the overlay renders when `state === "completed"` (`cycle-complete-overlay.tsx:30`).

During the gap (often seconds in production due to `cycles.complete`, `cycles.create`, and optional `sessions.getOrCreateActive`), the user sees the stale work-end **Cycle Complete!** modal with disabled buttons (`isConfirming=true`). No loading shell covers this interval; the suggestion card also cannot appear until `state === "running"` on a break cycle.

**Recommended fix:** Follow the S-16 wind-down precedent — add a dedicated post-check-in transition guard (e.g. `isPostCheckInTransitioning`) **or** defer `setAwaitingCheckIn(false)` until after `setState("running")`. Prefer hook-side deferral for minimal surface area; dashboard gate is the belt-and-suspenders pattern already used for `awaitingWindDown`.

## Detailed Findings

### Overlay visibility formula

There is no `showCycleComplete` boolean. Visibility is the conjunction of two independent gates:

| Layer | Condition | File |
|-------|-----------|------|
| Parent mount | `!awaitingCheckIn && !awaitingWindDown` | `pomodoro-dashboard.tsx:311` |
| Child render | `state === "completed"` | `cycle-complete-overlay.tsx:30` |

**Effective visibility:** `!awaitingCheckIn && !awaitingWindDown && state === "completed"`

`isConfirming` only disables buttons inside the overlay; it does **not** suppress visibility.

### Authenticated WORK cycle-end state machine

```mermaid
sequenceDiagram
    participant Timer
    participant Hook as usePomodoroCycle
    participant UI as pomodoro-dashboard

    Timer->>Hook: handleCycleExpired
    Hook->>Hook: setState("completed")
    Note over UI: CycleCompleteOverlay visible

    UI->>Hook: onCycleCompleteConfirm
    Hook->>Hook: setAwaitingCheckIn(true)
    Note over Hook: state still "completed"
    Note over UI: CheckInOverlay shown, CycleComplete unmounted

    UI->>Hook: submitCheckIn(energy)
    Hook->>Hook: createCheckIn API
    Hook->>Hook: setAwaitingCheckIn(false)
    Note over Hook,UI: FLASH WINDOW opens
    Hook->>Hook: continueAfterCheckIn
    Hook->>Hook: confirmComplete → startBreakAfterWorkComplete
    Hook->>Hook: setState("running")
    Note over UI: Overlay hidden; break timer + suggestion load
```

### Exact flash window (root cause)

**Opens:** `submitCheckIn` line 1419 — `setAwaitingCheckIn(false)`

**Closes:** `startBreakAfterWorkComplete` line 1129 — `setState("running")`

Between these calls, `continueAfterCheckIn` (`1275–1309`) runs:

1. `setPendingSuggestion({ status: "loading" })` — does not affect overlay visibility
2. `await confirmComplete(markTaskDone)` — includes `cycles.complete` API + `cycles.create` (break)
3. `await fetchPostCheckInSuggestion(...)` — runs **after** break starts (S-06 ordering)

**Additional latency before `continueAfterCheckIn` even starts:** authenticated users `await sessions.getOrCreateActive()` for wind-down eligibility (`1425–1450`). This extends the flash window on the normal (non-wind-down) path.

### State flag sequence on check-in submit

| Step | Flag change | Location |
|------|-------------|----------|
| 1 | `setIsConfirming(true)` | `use-pomodoro-cycle.ts:1401` |
| 2 | `await createCheckIn.mutateAsync(...)` | `:1409–1412` |
| 3 | **`setAwaitingCheckIn(false)`** ← flash opens | `:1419` |
| 4 | `setPendingMarkTaskDone(null)` | `:1420` |
| 5 | Optional wind-down: `setAwaitingWindDown(true)`, return | `:1445–1446` |
| 6 | `await continueAfterCheckIn(...)` | `:1453` |
| 7 | Inside: `setPendingSuggestion({ status: "loading" })` | `:1281` |
| 8 | Inside: `await confirmComplete` → `startBreakAfterWorkComplete` | `:1288`, `:1226` |
| 9 | **`setState("running")`** ← flash closes | `:1129` |
| 10 | `setIsConfirming(false)` (finally) | `:1455` |

### Why suggestion loading does not mask the flash

`showSuggestionCard` requires `state === "running"` AND break `cycleKind` (`pomodoro-dashboard.tsx:82–91`). Even though `pendingSuggestion.status` becomes `"loading"` at `:1281`, the suggestion card cannot render until the break is running — which is **after** the flash window should close. During the flash, there is no transitional UI.

### Wind-down path (excluded from primary bug, related secondary path)

When wind-down nudge fires after check-in:

- `setAwaitingWindDown(true)` at `:1445` before return
- Parent gate `!awaitingWindDown` keeps `CycleCompleteOverlay` suppressed — **no flash**

**Secondary flash on "Keep going":** `onWindDownKeepGoing` sets `setAwaitingWindDown(false)` at `:1589` then calls `continueAfterCheckIn`. At that point `awaitingCheckIn` is already false (cleared at `:1419`), so the same `awaitingCheckIn=false + state=completed` gap reopens until `:1129`. Fix should cover this path too.

### Guest / break paths (not affected)

Guest and non-WORK cycles call `confirmComplete` directly from `onCycleCompleteConfirm` without opening the check-in gate (`1379–1386`). Overlay stays mounted; `isConfirming` disables buttons until `state` transitions — no flash because parent gate is never toggled by check-in.

### Test gap

Unit tests in `use-pomodoro-cycle.test.tsx` (e.g. `:752–811`) assert final state after `submitCheckIn` resolves but do not assert intermediate render states. Mocks resolve instantly, so `state` is often already `"running"` within the same `act()` block — masking the production flash.

## Code References

- `src/hooks/use-pomodoro-cycle.ts:1419` — `setAwaitingCheckIn(false)` opens flash window
- `src/hooks/use-pomodoro-cycle.ts:1275–1309` — `continueAfterCheckIn` orchestrates completion + suggestion
- `src/hooks/use-pomodoro-cycle.ts:1192–1273` — `confirmComplete` persists cycle completion
- `src/hooks/use-pomodoro-cycle.ts:1106–1144` — `startBreakAfterWorkComplete`; `:1129` closes flash
- `src/hooks/use-pomodoro-cycle.ts:1379–1391` — `onCycleCompleteConfirm` sets check-in gate without calling `confirmComplete`
- `src/hooks/use-pomodoro-cycle.ts:1587–1593` — wind-down "Keep going" re-triggers same gap
- `src/app/_components/pomodoro-dashboard.tsx:311–324` — parent mount gate for `CycleCompleteOverlay`
- `src/app/_components/pomodoro-dashboard.tsx:327–352` — `CheckInOverlay` mount gate
- `src/app/_components/cycle-complete-overlay.tsx:30–31` — internal `state === "completed"` render gate
- `src/app/_components/pomodoro-dashboard.tsx:87–91` — suggestion card requires break running

## Architecture Insights

1. **One-interstitial-at-a-time pattern:** S-05 introduced `awaitingCheckIn` as a parent-level unmount gate for `CycleCompleteOverlay`. S-16 added `awaitingWindDown` the same way. B-04 is the missing third gate for the post-check-in async transition.

2. **Decoupled flags:** `awaitingCheckIn` controls overlay mounting; `state` controls overlay content. They are intentionally independent for the check-in phase but must stay synchronized during the post-check-in transition.

3. **Async ordering is load-bearing:** S-06 explicitly fetches suggestion after `confirmComplete` (not before) for cycle-count correctness. The fix must not reorder this chain.

4. **NFR violation:** PRD requires acknowledgement within 200ms after check-in submit. Re-showing a disabled stale modal violates the calm-transition intent of FR-020/FR-021.

## Historical Context (from prior changes)

- `context/changes/fix-cycle-complete-flash-after-checkin/change.md` — initial bug report; suspects `awaitingCheckIn=false` + `state=completed` gap
- `context/foundation/roadmap.md:694–706` — B-04 entry; documents same gap as flash window; open decision on `postCheckInTransitioning` vs loading shell
- `context/foundation/roadmap.md:251` — S-05 marked done with known regression → B-04
- `context/archive/2026-06-06-testing-active-slice-browser-proofs/plan.md` — S-05 design: check-in between cycle-complete confirm and `confirmComplete`; `awaitingCheckIn` hides cycle-complete overlay
- `context/archive/2026-06-07-adaptive-task-suggestion/plan.md` — S-06: suggestion fetch after `confirmComplete`, do not block break start
- `context/archive/2026-06-08-background-tab-return-catchup/research.md` — documents overlay guard: `state === "completed" && !awaitingCheckIn`
- `context/archive/2026-06-08-mindful-session-wind-down/reviews/plan-review.md` — **same gap identified for wind-down**; fix was gating overlay with `!awaitingWindDown` (`plan.md:163`)

## Related Research

- `context/archive/2026-06-08-mindful-session-wind-down/research.md` — `submitCheckIn` step ordering; wind-down branch timing
- `context/archive/2026-06-08-background-tab-return-catchup/research.md` — post-cycle gate table and overlay z-order

## Open Questions

1. **UX choice for `/10x-plan`:** Defer `awaitingCheckIn` clear (keep check-in overlay visible with `isConfirming`) vs dedicated loading shell vs `isPostCheckInTransitioning` flag — roadmap lists both options (`roadmap.md:704`).
2. **Wind-down "Keep going" path:** Confirm whether secondary flash is user-reported or in scope for B-04 (code evidence says yes, same mechanism).
3. **E2E regression test:** No existing spec asserts overlay stays hidden between check-in submit and break start — should be added in implementation phase.

## Decision Summary (for `/10x-plan`)

| Item | Recommendation |
|------|----------------|
| **Root cause** | `setAwaitingCheckIn(false)` at `:1419` before `setState("running")` at `:1129` reopens parent overlay mount gate while work cycle is still logically complete |
| **Confidence** | **96/100** — direct code path, matches roadmap hypothesis, S-16 documented same class of gap |
| **Primary files** | `src/hooks/use-pomodoro-cycle.ts`, `src/app/_components/pomodoro-dashboard.tsx` |
| **Secondary files** | `src/hooks/use-pomodoro-cycle.test.tsx`, optional e2e in `e2e/` |
| **Recommended approach** | **Hook-first:** defer `setAwaitingCheckIn(false)` until after `startBreakAfterWorkComplete` sets `state="running"` (or add exported `isPostCheckInTransitioning` and gate dashboard at `:311`). Mirror S-16 `awaitingWindDown` pattern if a separate flag is clearer. Keep wind-down exclusion intact. Cover `onWindDownKeepGoing` path. Add unit test asserting no `!awaitingCheckIn && state===completed` window during transition; add e2e assertion overlay hidden after energy submit until break timer visible. |
