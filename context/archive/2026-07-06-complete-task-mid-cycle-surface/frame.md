# Frame Brief: One session = one task → mandatory break on completing the focused task

> Framing step before /10x-plan. This document captures what is *actually*
> at issue, separated from what was initially assumed.
>
> **Revised 2026-07-09.** The user changed the framing after the first pass (see
> "Framing history" below). Both the observation and the desired product model
> are now different from the original brief — this version is authoritative.

## Reported Observation

When I complete a task during a running cycle, I only see the option to switch
to the next task **after I navigate to the `/focus` view**. On the task list
(`/tasks`), clicking the task's complete-circle produces **nothing visible**.

## Framing history

- **Original framing (2026-07-06):** user offered two candidate causes —
  (a) completion mid-cycle shouldn't be allowed without ending the cycle, or
  (b) next-task functions are missing. First-pass investigation ruled both out
  and reframed the issue as a *split surface* (trigger on `/tasks`, overlay only
  on `/focus`), recommending the overlay simply be co-located.
- **Revised framing (2026-07-09, authoritative):** user deliberately adopts a
  variant of candidate (a). The problem is **not** where the overlay renders —
  it is that the app *allows finishing a task mid-cycle and continuing the same
  cycle with a different task at all*. That context-switch-within-a-session is
  the thing to remove. The product model should be **"one session = one task,
  then a short break to clear the mind."**

## Desired Behavior Model (user, authoritative)

1. Finishing a task before the session ends must lead into a **short break**
   (mind reset) — no "continue this cycle with another task" branch.
2. The focused task can be completed **from the Focus view**.
3. Completing the **focused** task (the one the session is about) from `/tasks`
   **auto-ends the session into a break**, exactly as if done from `/focus`.
4. Completing a **non-focused** task must **not** affect the running session —
   `/focus` stays on the active task, cycle keeps running.
5. Completing the focused task → **auto-transition to break**, with **no
   next-task selection** for the current session.
6. The user chooses **short vs long break**; the system-suggested option is
   marked with a **star** (★) alongside.
7. Effect: "one session = one task without changing context, then a short break."
8. On ending the **session**, the user still gets the **"did you finish the
   task?"** choice.

## Current Behavior vs Desired (grounded in code)

| # | Desired | Current code | Gap |
| --- | --- | --- | --- |
| 1/5 | Focused-task completion → mandatory break, no next-task pick | `onMidCycleMarkComplete` (`use-pomodoro-cycle.ts:2700`) opens `MidCycleCompletionPrompt`, which offers **"continue with another task"** OR "end cycle & break" (`mid-cycle-completion-prompt.tsx`) | The continue-with-another-task branch must be **removed** for the focused task; completion should route straight to break |
| 2 | Complete focused task from `/focus` | No trigger anywhere in `pomodoro-dashboard.tsx`; `/focus` shows the task title only (TaskList moved to `/tasks`, lessons L-06) | New affordance needed on `/focus` |
| 3 | Focused completion on `/tasks` behaves like `/focus` (auto break) | Trigger sets shared `midCyclePendingTask` but the overlay is mounted **only** on `/focus` (`pomodoro-dashboard.tsx:1058`); `/tasks` renders nothing → "nothing visible" | `/tasks` must drive the same auto-break path, not silently set state |
| 4 | Non-focused completion doesn't touch the session | `onMidCycleMarkComplete` fires for **every** row (`task-list.tsx:609` `canMidCycleMarkComplete`) and sets the prompt regardless of whether the task is focused (no focused/other distinction at line 2700) | Must branch: non-focused → plain complete, no session effect |
| 6 | User picks short/long break, star on suggestion | Break kind is **auto-computed** by cadence: `computeBreakAfterWork` / `startBreakAfterWorkComplete` use `newCount % 4 === 0 ? LONG : SHORT` (`use-pomodoro-cycle.ts:223,2156`); no chooser, no star | New break-kind chooser UI + keep the cadence result as the ★-marked suggestion |
| 8 | Session-end keeps "finished the task?" prompt | `CycleCompleteOverlay` WORK variant already offers mark-complete / continue-later (`cycle-complete-overlay.tsx:152-170`); `endSession` exists (`use-pomodoro-cycle.ts`) | Preserve this prompt on the session-end path |

## Dimension Map

The observation could originate at any of these dimensions:

1. **Mid-cycle completion *semantics*** — what finishing a task during a WORK
   cycle should do (continue vs break; focused vs other). ← revised framing lands here
2. **Missing next-task / end-session logic** — whether the functions exist.
3. **Overlay mount location** — trigger and overlay on different pages.
4. **Missing trigger on Focus** — no control to complete the current task.
5. **Break-kind selection** — whether the user can choose short vs long.

## Hypothesis Investigation

| Hypothesis | Evidence | Verdict |
| --- | --- | --- |
| 2. Missing next-task/end-session logic | `MidCycleCompletionPrompt` + `onMidCycleContinueWithTask`/`onMidCycleEndCycleAndBreak` (`use-pomodoro-cycle.ts:2711,2999`) all exist | NONE (logic exists) |
| 3. Overlay mount location | Overlay only in `pomodoro-dashboard.tsx:1058`; `/tasks` wires the trigger but renders no overlay; state shared via provider → appears only after navigating to `/focus`. User-confirmed "nothing visible" on `/tasks` | STRONG (real, but a *symptom*, not the product problem) |
| 4. Missing trigger on Focus | No `onMidCycleMarkComplete`/complete control in the Focus dashboard | STRONG |
| 1/5. Completion semantics wrong for the model | Current flow lets a session context-switch to another task and treats every completion identically (no focused/other split); break is never mandatory. Contradicts the desired "one session = one task → break" | STRONG (this is the product problem per the revised framing) |
| 6. No break-kind choice | Break kind auto-decided by `%4` cadence, no user control (`use-pomodoro-cycle.ts:223,2156`) | STRONG |

## Narrowing Signals

- User-confirmed: `/tasks` completion shows **nothing** (state set, no local surface).
- User decision (2026-07-09): keep the cycle→break coupling **mandatory** and
  drop the "continue with another task" branch for the focused task.
- Code shows completion is currently **task-agnostic** (focused vs other not
  distinguished) — directly at odds with rules 3–5.
- Break kind is currently **not** user-selectable — rule 6 is net-new UI.

## Cross-System Convention

Break sequencing is owned by the transition conductor / wedge overlays
(`transition-conductor.ts`, `CycleCompleteOverlay`, `startBreakAfterWorkComplete`),
and gates must open→accept→dismiss on the surface where the action originates
(lessons: "Test every wedge transition before shipping" — guard against gates
that "appear but do nothing"). The new mandatory-break-on-completion path and the
break-kind chooser should route through the conductor, not stack ad-hoc overlays.

## Reframed (or Confirmed) Problem Statement

> **The actual problem to plan around is**: mid-cycle task completion currently
> lets a session change context (continue the same cycle with a different task)
> and never forces a break, which breaks the intended "one session = one task →
> short break" rhythm. Completing the **focused** task should end the cycle into
> a **mandatory, user-chosen (short/long, ★-suggested) break** from either
> `/tasks` or `/focus`; completing a **non-focused** task should do nothing to
> the session; and the session-end "did you finish the task?" prompt stays.

This supersedes the original "just co-locate the overlay" direction. The overlay
split (Dimension 3) and the missing `/focus` trigger (Dimension 4) are still
real and must be fixed, but as *part of* delivering the new completion semantics
— not as the whole change. Note this **removes** an existing, tested feature
(the "continue with another task" mid-cycle branch), so its tests/e2e
(`e2e/mid-cycle-last-task.spec.ts`, `mid-cycle-completion-prompt.test.tsx`) need
updating/retiring.

## Confidence

- **HIGH** — the desired model is a direct user product decision, and every
  current-vs-desired gap is grounded with file:line evidence. The one open
  design question (short/long break chooser UX + star) is a UI detail for
  /10x-plan, not a framing risk.

## What Changes for /10x-plan

Plan the **new mid-cycle completion semantics**, not an overlay relocation:
(1) branch `onMidCycleMarkComplete` on focused vs non-focused — non-focused
completes plainly with no session effect; (2) focused completion routes to a
**mandatory break** via the existing break-start path, dropping the
continue-with-another-task branch; (3) add a complete-focused-task affordance on
`/focus`, and make `/tasks` focused-completion drive the same path (so it works
from both surfaces); (4) add a **short/long break chooser** with the
cadence-based suggestion marked by a ★, replacing the silent `%4` auto-decision;
(5) preserve the "did you finish the task?" prompt on session end; (6) update or
retire the mid-cycle "continue with another task" tests. Treat all break/gate
transitions as critical paths with dismiss-oracles (lessons).

## References

- Source files:
  - `src/hooks/use-pomodoro-cycle.ts:2700` (`onMidCycleMarkComplete`, no focused/other split)
  - `src/hooks/use-pomodoro-cycle.ts:2711` (`onMidCycleContinueWithTask` — branch to drop)
  - `src/hooks/use-pomodoro-cycle.ts:2999` (`onMidCycleEndCycleAndBreak`)
  - `src/hooks/use-pomodoro-cycle.ts:223,2156` (`computeBreakAfterWork` / `startBreakAfterWorkComplete` — %4 cadence)
  - `src/app/_components/mid-cycle-completion-prompt.tsx` (continue-with-another-task UI)
  - `src/app/_components/cycle-complete-overlay.tsx:152` ("finished the task?" prompt)
  - `src/app/_components/pomodoro-dashboard.tsx:1058` (overlay mounted, /focus only)
  - `src/app/tasks/page.tsx:56` (trigger wired, no overlay)
  - `src/app/_components/task-list.tsx:609` (`canMidCycleMarkComplete`, every row)
- Related lessons: `context/foundation/lessons.md` — "Test every wedge
  transition before shipping"; L-06 (task-list moved from /focus to /tasks)
- Tests to update/retire: `e2e/mid-cycle-last-task.spec.ts`,
  `src/app/_components/mid-cycle-completion-prompt.test.tsx`
- Investigation: direct source trace (no sub-agents; surface small)
