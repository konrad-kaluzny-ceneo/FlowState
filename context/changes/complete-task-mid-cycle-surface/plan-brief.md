# One Session = One Task — Plan Brief

> Full plan: `context/changes/complete-task-mid-cycle-surface/plan.md`
> Frame brief: `context/changes/complete-task-mid-cycle-surface/frame.md`

## What & Why

Mid-cycle task completion currently lets a session change context (continue the
same cycle with a different task) and never forces a break, which breaks the
intended "one session = one task → short break" rhythm. This change makes
finishing the **focused** task (from `/tasks` or `/focus`) end the cycle into a
**mandatory, user-chosen break**; finishing a **non-focused** task just marks it
done with no session effect.

## Starting Point

Today `onMidCycleMarkComplete` fires for every task row and opens a prompt to
"continue with another task" or "end & break" — mounted only on `/focus`, so
completing from `/tasks` shows nothing. Break kind is auto-decided by a `%4`
cadence with no user choice. `cycles.rebindTask` exists solely to power the
continue-with-another-task branch.

## Desired End State

Finishing the focused task marks it done and transitions into a break — preceded
(authenticated) by the existing energy check-in, then a **short/long break
chooser** with the cadence suggestion starred (★). Finishing a non-focused task
leaves the running session untouched. The continue-with-another-task branch and
`rebindTask` are gone. The session-end "did you finish the task?" prompt is
unchanged.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Completion model | Focused → mandatory break; non-focused → plain complete | Enforces "one session = one task" | Frame |
| Break chooser scope | Every WORK→break transition | One consistent gate, avoids "sometimes you choose" confusion | Plan |
| Check-in on mid-cycle completion | Keep the check-in beat | Preserves energy signal; reuses existing flow | Plan |
| Chooser UX | Blocking gate, ★ suggestion pre-selected | Explicit choice, routes cleanly through the conductor | Plan |
| Override vs cadence | Override resets the rhythm | Suggestion adapts to actual break-taking | Plan |
| `/focus` trigger | Completion circle beside the task title | Consistent affordance with `/tasks` | Plan |
| `/tasks` hand-off | Redirect to `/focus` for the transition | Reuses the single overlay host; "as if done from /focus" | Plan |
| Remove `rebindTask` | Full removal (interface, repos, router, tests) | No dead code left behind | Plan |
| Focus time on early completion | Completed cycle (not interrupted) records partial minutes | Fixes today's gap where finishing early left time uncounted | User |
| Rule 8 (finished-task prompt) | No new work | Existing cycle-complete overlay already covers it | Frame/User |

## Scope

**In scope:** break-kind chooser gate; focused/non-focused completion split;
mandatory break on focused completion; `/focus` completion circle; `/tasks`→
`/focus` redirect; removal of `MidCycleCompletionPrompt` + `rebindTask`.

**Out of scope:** session-end task prompt (already exists); `resumeNote`
behavior; break durations/cadence length; rendering the overlay stack on
`/tasks`; timer-expiry completion semantics.

## Architecture / Approach

The transition conductor (`resolveWedgeBeat`) gains a `break_choice` gate ordered
after `check_in` and above `cycle_complete`. Both break-start sites
(`continueAfterCheckIn` and the guest path) defer to this gate instead of
starting the break directly; the chooser's confirm calls
`startBreakAfterWorkComplete(markTaskDone, chosenKind)`. Focused completion reuses
the existing check-in→break routing; non-focused completion uses the normal task
mutation. `/tasks` focused completion redirects to `/focus` so gates render on
the single overlay host.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Break chooser gate | Chooser on every WORK→break transition; break-kind override + cadence reset | Sequencing: gate must intercept before the break cycle is created |
| 2. Completion semantics | Focused → mandatory break; non-focused → plain; remove prompt/branch | Timer-hub blast radius; retiring tested behavior |
| 3. Remove `rebindTask` | Delete across interface/repos/router/tests | Broad but mechanical; both data modes |
| 4. Completion triggers | `/focus` circle + `/tasks`→`/focus` redirect | Redirect must fire only for the focused task, after dispatch |

**Prerequisites:** none beyond a working dev/test setup. Run
`pnpm change-impact src/hooks/use-pomodoro-cycle.ts` before editing the hub.
**Estimated effort:** ~3–4 sessions across 4 phases.

## Open Risks & Assumptions

- Redirecting `/tasks`→`/focus` mid-action must feel intentional; if jarring,
  reconsider inline gates (deferred option).
- The break gate joins a conductor that already warns (in lessons) about
  gates that "appear but do nothing" — every gate needs a dismiss-oracle test.
- Removing `rebindTask` assumes Phase 2 deletes its only caller; verify with
  `grep` before the server-side removal.

## Success Criteria (Summary)

- Finishing the focused task (either surface) ends the cycle into a chosen break;
  no next-task selection appears.
- Finishing a non-focused task never disturbs the running session.
- Every WORK→break transition offers Short/Long with the ★ suggestion; choosing
  Long resets the cadence.
- Finishing a task early records the partial focus time in the day recap and the
  day-plan budget (no longer zero).
