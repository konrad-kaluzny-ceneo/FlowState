# Blocked Task Status — Plan Brief

> Full plan: `context/changes/blocked-task-status/plan.md`

## What & Why

Add **blocked** as a fourth task lifecycle state (distinct from active, planned,
completed, and the stale archive) so a user who started a task but is waiting on
someone or something can park it without pretending it's active or faking
completion — and can step out of a running cycle for that reason without losing the
break hand-off. Blocking mid-cycle hands the session off to a break exactly as
finishing the task does (US-06, roadmap S-51). Blocked tasks stay out of the wedge
suggestion pool until unblocked.

## Starting Point

Today a task waiting on an external dependency is indistinguishable from an active
task or has to be marked done to get it out of the way. S-50
(`complete-task-mid-cycle-surface`) recently built the *completion* exit and its
mandatory-break rhythm; this slice adds a parallel *block* exit onto the same
timer-hub machinery. Task status is already a free-form `String` column, so the new
value needs no migration.

## Desired End State

Blocked is a real state on both guest and authenticated sides: a dedicated
"Zablokowane" tab in the task list with inline block/unblock controls, a block
affordance beside the focused-task complete circle on `/focus` (and via the
`/tasks`→`/focus` redirect), and a third "mark blocked" choice at cycle close.
Blocking the focused task mid-cycle ends the cycle (counting the partial focus
minutes) and flows into the S-50 check-in → break-choice → break sequence. Blocked
tasks never surface as suggestions and are never swept into the stale archive.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| --- | --- | --- | --- |
| Storage / migration | Reuse free-form `status` String column | `VARCHAR(20)` already accepts `"blocked"` — no Prisma enum, no migration | Plan |
| Mid-cycle break | Reuse S-50 short/long chooser (★) | One rhythm; the item calls the block and complete exits symmetric | Plan |
| Waiting-on note | Bare state (no note) | Smallest surface; resumeNote reuse deferred to a follow-up | Plan |
| Block mutation | Extend `cycles.complete` with an atomic outcome param | Single transaction sets cycle COMPLETED + task blocked; no partial-failure window | Plan |
| List display | Dedicated "Zablokowane" tab | Matches existing tab pattern; keeps blocked unmistakably separate | Plan |
| Block/unblock controls | Inline icon buttons on rows | Consistent with existing complete/revert circles; no new menu | Plan |
| Unblock ordering | blocked→active with fresh sortOrder bump | Mirrors completed→active; lands at active list's end | Plan |
| Stale archive | Exempt blocked | A task waiting on a dependency shouldn't be punished for waiting | Plan |
| Recap reporting | Out of scope | Keeps the slice focused; natural S-48 analytics follow-up | Plan |
| Paused cycle | RUNNING+WORK only | Matches S-50's guard exactly; avoids untested paused→break edge | Plan |
| Confirmation | Immediate, no dialog | Fully reversible via unblock; fewer gates (L-05) | Plan |
| Testing | Hook/component/router + one belt e2e | Honors L-06 (hook-first) with one real-DOM proof | Plan |

## Scope

**In scope:** blocked status across both data modes; suggestion-pool exclusion;
stale-archive exemption; task-list Zablokowane tab + block/unblock; atomic
block-on-complete param; mid-cycle block→break; session-end blocked fate; unblock →
active.

**Out of scope:** waiting-on note; DB migration / Prisma enum; blocking from a paused
cycle; confirmation dialog; recap/Podsumowanie reporting; new conductor gate; break
duration/cadence changes.

## Architecture / Approach

Foundation-first. Phase 1 adds `"blocked"` to the six type/Zod/mapper/schema seams
(the three silent-failure traps: mapper allow-list, guest Zod, the update input
unions) and exempts blocked from stale-archive on both modes. Phase 2 builds the
task-list tab and controls (no timer-hub touch). Phase 3 generalizes
`cycles.complete` to carry a block outcome atomically — the shared contract for the
two cycle-driven surfaces. Phases 4–5 wire the timer hub: mid-cycle block mirrors
S-50's `onCompleteFocusedTask` (threading a block outcome through the same
check-in → break-choice → break chain), and the session-end blocked fate widens the
cycle-complete overlay's boolean into a three-way `done | keep | blocked`.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Status foundation | `blocked` known + writable on both modes; archive-exempt | Silent failures if mapper/guest-Zod omit the value |
| 2. Zablokowane tab | List tab + inline block/unblock + detail pill | Blocked must read as separate, not folded into active |
| 3. Complete block param | Atomic block-on-complete on `cycles.complete` | Preserving partial-focus-minute accounting |
| 4. Mid-cycle block→break | `onBlockFocusedTask` + `/focus` & `/tasks` triggers | Timer-hub blast radius; wedge-gate dead-ends (L-05) |
| 5. Session-end fate | Third "mark blocked" choice at cycle close | Widening the fate without breaking done/keep |

**Prerequisites:** S-51 prereqs (F-07, S-45, S-50) all done. Open the Linear/GitHub
issue pair before implementation (`update-status`). Run `pnpm change-impact` before
Phase 4.
**Estimated effort:** ~4–5 sessions across 5 phases.

## Open Risks & Assumptions

- Both data modes must move together at each seam — a guest-only or server-only
  change compiles but fails silently (the repository interface hides the gap).
- `use-pomodoro-cycle.ts` / `pomodoro-dashboard.tsx` / `timer-panel.tsx` are
  high-blast-radius; wedge-gate changes risk dead-end overlays (L-05) — every gate
  needs a dismiss-oracle test.
- Assumes the stale-archive query already targets `active` (Phase 1 confirms and adds
  an explicit blocked exclusion if not).

## Success Criteria (Summary)

- A blocked task is visibly a fourth state, never suggested, never auto-archived, and
  returnable to active.
- Blocking the focused task mid-cycle ends the cycle into a break (partial focus
  minutes counted) — the same rhythm as completing it.
- Blocking is reachable from the task list, mid-cycle, and session end — on both guest
  and authenticated modes.
