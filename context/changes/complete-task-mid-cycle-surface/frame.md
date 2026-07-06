# Frame Brief: Completing a task mid-cycle is invisible where it's triggered

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.

## Reported Observation

When I complete a task during a running cycle, I only see the option to switch
to the next task **after I navigate to the `/focus` view**. On the task list
(`/tasks`) itself, clicking the task's complete-circle produces **nothing
visible** (user-confirmed). Two things should be possible:

- From the task list, properly close a task (pick the next task, or end the session).
- From the Focus view, finish the current task.

## Initial Framing (preserved)

- **User's stated cause or approach**: Either (a) the problem is *allowing*
  task completion mid-cycle without ending the cycle, or (b) the problem is a
  *lack of functions* to select the next task.
- **User's proposed direction**: Deliver both — (1) close a task from the task
  list with a next/end-session choice; (2) finish the current task from Focus.
- **Pre-dispatch narrowing**: On `/tasks`, "nothing visible happens" when the
  complete-circle is clicked mid-cycle. Both deliverables are equally in scope
  and should be treated as one coherent change.

## Dimension Map

The observation could originate at any of these dimensions:

1. **Completion is disallowed mid-cycle (candidate a)** — the app forbids
   closing a task while a cycle runs, so the click is a no-op by design.
2. **Missing next-task selection logic (candidate b)** — no functions exist to
   pick the next task or end the session after completion.
3. **Overlay mount location** — the completion trigger and the overlay that
   renders its state live on different pages, so the trigger sets state with no
   local surface to display it.
4. **Missing trigger on Focus** — `/focus` renders the overlay but exposes no
   control to complete the *current* focused task.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 1. Completion disallowed mid-cycle | `task-list.tsx:609` `canMidCycleMarkComplete` is intentionally enabled during a running/paused WORK cycle; `TaskCompleteButton` routes to `onMidCycleMarkComplete` (`task-list.tsx:143`). The mid-cycle flow is a designed feature, not a block. | NONE |
| 2. Missing next-task / end-session logic | `MidCycleCompletionPrompt` (`mid-cycle-completion-prompt.tsx`) already renders a selectable list of other active tasks + resume note, plus an "end cycle and break" button. Hook exposes `onMidCycleContinueWithTask` and `onMidCycleEndCycleAndBreak` (`use-pomodoro-cycle.ts:3034,3357`). All logic exists. | NONE |
| 3. Overlay mount location | Trigger on `/tasks` sets shared context: `onMidCycleMarkComplete` → `setMidCyclePendingTask` (`use-pomodoro-cycle.ts:3023-3029`). Overlay is rendered **only** in `pomodoro-dashboard.tsx:1211` (the `/focus` page via `HomeShell`). `grep` for `TaskList`/`MidCycleCompletionPrompt` in `tasks/page.tsx` shows the trigger but no overlay; `grep` for `TaskList` in `pomodoro-dashboard.tsx` returns nothing. State is shared via `pomodoro-cycle-provider`, so it persists and appears only after navigating to `/focus`. User confirms "nothing visible happens" on `/tasks`. | STRONG |
| 4. Missing trigger on Focus | `grep` for `onMidCycleMarkComplete` / `task-complete` in the Focus dashboard components returns no matches. `/focus` shows the focused task **title** only; TaskList was moved off `/focus` in the UI refactor (lessons L-06). No control exists to complete the focused task from Focus. | STRONG |

## Narrowing Signals

- User-confirmed: on `/tasks`, clicking complete mid-cycle shows **nothing** —
  rules in Dimension 3 (state set, no local surface) and rules out Dimension 1
  (a disallowed action would be disabled/greyed, not silently swallowed).
- The `MidCycleCompletionPrompt` component and its hook callbacks exist and are
  fully wired — rules out Dimension 2.
- `/focus` exposes the focused task title but no completion control — confirms
  Dimension 4 independently of the `/tasks` issue.
- User: both deliverables equally in scope → this is one change spanning both
  surfaces, not two competing framings.

## Cross-System Convention

In this codebase, transition/completion decisions are surfaced through overlay
gates (`CycleCompleteOverlay`, `end-session-confirm-overlay`,
`session-closure-overlay`) that must be **mounted on the page where the action
originates** and must open→accept→dismiss on that same surface. Lessons: "Test
every wedge transition before shipping" warns specifically about gates that
"appear but do nothing" / trap the user. The current state — a trigger on
`/tasks` whose gate only renders on `/focus` — is exactly the dead-end shape
that convention exists to prevent. The leading hypothesis matches the
convention: the overlay must live wherever its trigger lives.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: the mid-cycle task-completion flow
> exists and works, but its **surfaces are split across pages** — the trigger
> lives on `/tasks` while the choice overlay is mounted only on `/focus`, and
> `/focus` has the overlay but no trigger. So the completion decision never
> appears on the page where the user acts.

Both of the user's candidate causes are wrong: completion mid-cycle is an
intended feature (not a bug to remove), and the next-task/end-session functions
already exist (not missing). Addressing the real problem means making the
`MidCycleCompletionPrompt` render wherever `midCyclePendingTask` is set (so
`/tasks` shows it in place), and giving `/focus` a way to complete the current
focused task so it can trigger the same flow. Nothing about the cycle-lifecycle
or the selection logic needs to change.

## Confidence

- **HIGH** — strong, file-referenced evidence for Dimensions 3 and 4; none for
  the two initial candidates; matches the codebase's overlay-gate convention;
  and the decisive narrowing signal ("nothing visible on `/tasks`") is
  user-confirmed.

## What Changes for /10x-plan

The plan should be about **co-locating the completion surface with its trigger**
on both pages, not about cycle rules or new selection logic: (1) render
`MidCycleCompletionPrompt` (bound to shared `midCyclePendingTask`) on `/tasks`
so completing there shows the next/end-session choice in place; (2) add a
"complete current task" affordance to the `/focus` dashboard that calls the
existing `onMidCycleMarkComplete`. Reuse the existing hook callbacks and
overlay; watch the lessons' dismiss-oracle rule for every gate on every surface.

## References

- Source files:
  - `src/app/_components/mid-cycle-completion-prompt.tsx` (overlay UI)
  - `src/app/_components/pomodoro-dashboard.tsx:1211` (overlay mounted, /focus only)
  - `src/app/tasks/page.tsx:56` (trigger wired, no overlay)
  - `src/app/_components/task-list.tsx:143,609` (complete-circle → onMidCycleMarkComplete)
  - `src/hooks/use-pomodoro-cycle.ts:3023,3034,3357` (hook callbacks + state)
  - `src/app/_components/pomodoro-cycle-provider.tsx` (shared context)
- Related lessons: `context/foundation/lessons.md` — "Test every wedge
  transition before shipping"; L-06 (task-list moved from /focus to /tasks)
- Investigation: direct source trace (no sub-agents dispatched; surface small)
