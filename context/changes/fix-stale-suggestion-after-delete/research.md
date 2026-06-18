---
date: 2026-06-18T18:30:00+02:00
researcher: Cursor Agent
git_commit: 0047c5e3888e4e4dc1f13eebd39bb06d29828933
branch: features/cycle-pause-resume
repository: konrad-kaluzny-ceneo/FlowState
topic: "Stale task suggestion after deleting the suggested task"
tags: [research, bug, suggestion, task-delete, use-pomodoro-cycle, S-06, S-15, S-09]
status: complete
last_updated: 2026-06-18
last_updated_by: Cursor Agent
---

# Research: Stale task suggestion after deleting the suggested task

**Date**: 2026-06-18T18:30:00+02:00  
**Researcher**: Cursor Agent  
**Git Commit**: `0047c5e3888e4e4dc1f13eebd39bb06d29828933`  
**Branch**: features/cycle-pause-resume  
**Repository**: konrad-kaluzny-ceneo/FlowState

## Research Question

When FlowState shows a suggested next task and the user deletes that task from the list, why does the suggestion card at the top still display the deleted task? Confirm affected paths (post-check-in break vs kickoff), guest vs auth, root cause, and fix/test options for a one-iteration slice.

## Summary

**Hypothesis confirmed:** suggestion state is a **local API snapshot** in `usePomodoroCycle` with **no sync** to the live task list. Task delete updates `task.list` (auth optimistic cache or guest snapshot) only; `pendingSuggestion` / `pendingKickoffSuggestion` remain `"ready"` until an explicit lifecycle clear.

**Primary repro (UI):** **kickoff idle** (`state === "idle"`, `pendingKickoffSuggestion.status === "ready"`). Delete is enabled when `cycleState !== "running"`.

**Path A nuance (post-check-in break):** delete of **active** tasks is **intentionally disabled** during break (`cycleLocked` at `task-list.tsx:702`). The stale-card bug via delete is **not reachable through normal UI** on that path; override-via-Focus is the supported alternative (S-06 plan `254`). If the card still shows a deleted task during break, the task was removed by another mechanism (e.g. external tab, future unlock of delete-on-break).

**Auth-only UI:** guest dashboard does not pass `enableSuggestionGate` (`pomodoro-dashboard.tsx:534–539`); hook machinery exists but suggestion cards are gated off.

**Recommended fix direction:** single sync point — when `pending*Suggestion.status === "ready"` and suggested `taskId` ∉ active tasks, invalidate suggestion (clear + optional refetch). `PomodoroDashboardBody` already computes `activeTaskIds` (`66–69`); extend usage or pass `tasks` into hook effect.

## Detailed Findings

### 1. Two independent data planes

```
suggestion.next API  →  pendingSuggestion / pendingKickoffSuggestion (snapshot)
task.delete          →  task.list cache / guest snapshot
                              ↓
                         no bridge
                              ↓
TaskSuggestionCard renders from snapshot, not from tasks prop
```

Card visibility (`pomodoro-dashboard.tsx:93–104`) depends only on hook status (`!== "idle"`), not on whether `tasks` still contains the suggested id. Card content comes from `pendingSuggestion.data` / `pendingKickoffSuggestion.data` (`271–283`, `307–318`).

### 2. Suggestion state — set and clear

**State variables** (`use-pomodoro-cycle.ts:259–285`):

| Variable | Purpose |
| --- | --- |
| `pendingSuggestion` | Post-check-in break suggestion (`status`: idle/loading/ready/empty/error) |
| `suggestedTaskId` | List row highlight during break |
| `pendingKickoffSuggestion` | Session-start / post-break idle suggestion |
| `kickoffSuggestedTaskId` | List row highlight during kickoff idle |
| `hasPreFocusedSuggestion` / `hasPreFocusedKickoff` | User accepted suggestion, pre-focus staged |
| `preFocusedTask` | Staged focus before next WORK cycle |

**Population:** `fetchPostCheckInSuggestion` (`980–1018`) and `fetchKickoffSuggestion` (`1055–1099`) set `"ready"` + snapshot + highlight id.

**Clear helpers:**

- `clearSuggestion()` (`915–923`) — idle, clears highlight + override ack; does **not** clear `preFocusedTask` / `focusedTaskId`
- `clearKickoffSuggestion()` (`896–904`) — idle kickoff state

**Lifecycle callers of clear (not delete):** `start()` (`1354–1355`), `endSession()` (`2201–2202`), break complete without pre-focus (`1835`), `continueAfterCheckIn` kickoff prep (`1859`), `fetchSuggestion` before post-check-in fetch (`1025`).

**Generation refs** (`suggestionFetchGenRef`, `kickoffFetchGenRef`) abort stale **network** responses after clear — they do not detect task-list drift.

### 3. Task delete path — no pomodoro coupling

**Auth:** `use-task-mutations.ts:192–201` — optimistic `removeTask` on `utils.task.list`; `onSettled` invalidates list. No cycle hook.

**Guest:** `use-task-mutations.ts:269–270` → `guest-repositories.ts:215–224` — filters snapshot. Same isolation.

**TaskList:** owns delete via `useTaskMutations()` (`620–629`); `onDeleteTask` → `deleteTask` (`1047`, `592`). No pomodoro props, no post-delete callback (`onRefresh` unused at `607`).

**Contrast — focus path:** dashboard wires `onFocusTask` → `pomodoro.selectTask` (`344–346`); delete has no equivalent.

### 4. Override vs delete asymmetry

`selectTask` during break with a **different** task (`1225–1234`):

- Records `recordSuggestionDecision`
- Clears `suggestedTaskId` and `hasPreFocusedSuggestion`
- Leaves `pendingSuggestion.status === "ready"` — card **still renders** from snapshot (existing behaviour, tested at `use-pomodoro-cycle.test.tsx:1896–1940`)

Kickoff override mirrors this (`1236–1248`).

**Delete does less:** no highlight clear, no decision record, no card state change.

### 5. Reproducibility matrix (checklist from change.md)

| Scenario | Repro via UI? | Notes |
| --- | --- | --- |
| Kickoff suggestion + delete suggested task | **Yes** | `cycleState === "idle"`, delete enabled |
| Post-check-in break suggestion + delete active suggested task | **No (by design)** | `cycleLocked` disables delete (`task-list.tsx:702,590`) per S-06 plan `254` |
| Delete non-suggested task | N/A | Suggestion should remain — no bug |
| Guest mode | **N/A (UI)** | `enableSuggestionGate` not set for guest (`534–539`) |
| Accept suggestion then delete | **No during break** | Delete locked while break running |
| Accept then delete on idle kickoff | **Yes (edge)** | `preFocusedTask` may retain stale id/title; kickoff chips / focus UI affected |
| Race: accept after delete | Low | Guard in plan if accept uses snapshot without list check |

### 6. `activeTaskIds` — unused for suggestions

`pomodoro-dashboard.tsx:66–72` builds `activeTaskIds` from `tasks` prop. **Only consumer:** `canMarkTaskDone`. Not used for card visibility or stale detection.

Hook maintains separate `hasActiveTasks` (`762–785`) via one-shot query for kickoff eligibility — also unrelated to suggestion validity.

### 7. Accept suggestion behaviour

`acceptSuggestion` (`1275–1294`) calls `preFocusTask`, sets `hasPreFocusedSuggestion`, records decision — **does not** set `pendingSuggestion` to idle. Card can remain visible during break (intentional staging UX). Delete of that task during break is blocked; stale `preFocusedTask` after delete on idle is a secondary edge case for the fix.

## Code References

- `src/hooks/use-pomodoro-cycle.ts:259–285` — suggestion state declarations
- `src/hooks/use-pomodoro-cycle.ts:896–923` — `clearKickoffSuggestion` / `clearSuggestion`
- `src/hooks/use-pomodoro-cycle.ts:980–1018` — post-check-in fetch populates snapshot
- `src/hooks/use-pomodoro-cycle.ts:1055–1099` — kickoff fetch populates snapshot
- `src/hooks/use-pomodoro-cycle.ts:1215–1273` — `selectTask` override (partial clear)
- `src/hooks/use-pomodoro-cycle.ts:1275–1321` — accept suggestion / kickoff
- `src/hooks/use-pomodoro-cycle.ts:1835` — `clearSuggestion` on break end without pre-focus
- `src/hooks/use-task-mutations.ts:192–201` — optimistic delete (auth)
- `src/app/_components/pomodoro-dashboard.tsx:66–72` — `activeTaskIds` (mark-done only)
- `src/app/_components/pomodoro-dashboard.tsx:93–110` — card visibility + highlight ids
- `src/app/_components/pomodoro-dashboard.tsx:509–511` — `enableSuggestionGate` (auth only)
- `src/app/_components/pomodoro-dashboard.tsx:534–539` — guest without suggestion gate
- `src/app/_components/task-list.tsx:702–703` — `cycleLocked` blocks delete during running/completed
- `src/app/_components/task-list.tsx:587–593` — active row delete handler

## Architecture Insights

1. **S-06 contract:** suggestion is a client-local snapshot cleared on session/cycle lifecycle events, not on task CRUD (`context/archive/2026-06-07-adaptive-task-suggestion/plan.md:222`).
2. **S-09 explicit non-bridge:** optimistic task mutations intentionally did not wire cycle/suggestion invalidation (`context/archive/2026-06-07-optimistic-task-mutations/plan.md:70,225–226`).
3. **Override ack pattern:** highlight cleared, card snapshot retained — delete fix should go further (clear or refetch card, not just highlight).
4. **Single sync point preferred:** dashboard already receives live `tasks`; hook does not. Either pass `activeTaskIds` into hook or add effect in dashboard calling exported clear/refetch — avoids scattering logic in `useTaskMutations`.
5. **`recordDecision` on silent clear:** plan should decide whether deleting suggested task counts as implicit rejection (optional analytics) or silent clear without mutation.

## Historical Context (from prior changes)

| Archive | Relevance |
| --- | --- |
| `context/archive/2026-06-07-adaptive-task-suggestion/` | Introduced `pendingSuggestion`, lifecycle clears, break-only Focus unlock; delete stays locked during break |
| `context/archive/2026-06-08-session-kickoff-suggestion/` | Parallel `pendingKickoffSuggestion`; clear on `start()` |
| `context/archive/2026-06-08-suggestion-override-acknowledgement/` | Override clears highlight + ack; ack cleared in `clearSuggestion` |
| `context/archive/2026-06-07-optimistic-task-mutations/` | Delete optimistic on list only; cycle paths unchanged |
| `context/archive/2026-06-09-task-manual-priority-order/` | Reorder may desync highlight briefly; no suggestion invalidation |
| `context/archive/2026-06-17-fix-closure-kickoff-mutex/` | `kickoffFetchGenRef` stale-async abort — same family as S-06 gen ref |

## Related Research

- `context/changes/fix-stale-suggestion-after-delete/change.md` — original bug report and checklist
- `context/archive/2026-06-07-adaptive-task-suggestion/research.md` — S-06 suggestion architecture
- `context/archive/2026-06-08-session-kickoff-suggestion/plan.md` — kickoff suggestion lifecycle

## Test coverage gap

| Layer | Existing | Missing |
| --- | --- | --- |
| Hook | Fetch, accept, override, lifecycle clear (`use-pomodoro-cycle.test.tsx:1638–2680`) | Delete / tasks-list drift |
| Mutations | Optimistic delete (`use-task-mutations.test.tsx:308–330`) | Cycle integration |
| Component | Card states; dashboard gate visibility | `tasks` omit suggested id while mock `ready` |
| E2E | Accept + override (`e2e/task-suggestion.spec.ts`, `e2e/session-kickoff.spec.ts`) | Delete during kickoff suggestion |

**Proposed tests for plan:**

1. **Vitest (hook):** render hook with `ready` kickoff suggestion; simulate tasks list without suggested id → expect `clearKickoffSuggestion` outcome (idle or refetch).
2. **Vitest (dashboard smoke):** mock pomodoro `ready` + tasks without id → no ready card (if fix lives in dashboard).
3. **E2E (belt candidate):** kickoff suggestion visible → delete suggested row → card hidden or empty state.

## Open Questions

1. **Post-check-in break:** keep delete locked and document Path A as non-repro, or relax delete-on-break for suggested task only (would expand scope beyond bug fix)?
2. **`recordDecision`:** record implicit rejection when user deletes suggested task, or clear silently?
3. **Refetch vs empty:** if other active tasks remain, should fix refetch `suggestion.next` or only clear to idle/empty?
4. **Pre-focus cleanup:** when deleted id matches `preFocusedTask`, also clear focus staging and kickoff duration chips?
