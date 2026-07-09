# Ad-hoc break + break-overtime-until-accept — Plan Brief

> Full plan: `context/changes/adhoc-rest-time/plan.md`
> Frame brief: `context/changes/adhoc-rest-time/frame.md`
> Research: `context/changes/adhoc-rest-time/research.md`

## What & Why

Two coupled changes: (A) FlowState gets a persistent idle "Start break" affordance so a user who ends up outside the work→break rhythm can rest and slide back in; and (B) **all** breaks keep counting into overtime past their configured duration and end only on an explicit accept — a break must never punish the user (no interruption penalty, no cadence corruption). Most of A's machinery already exists; B is a global break-end behavior change.

## Starting Point

Breaks today start only right after a work cycle completes, and freeze at `0:00` waiting for a "Continue" click. The break run/complete/session/kickoff machinery already tolerates a break with no preceding work cycle, and `cycles.create` touches no penalty counter — so A is thin. B is the real work: three parallel `remaining <= 0` expiry sites stop the timer, and `state === "completed"` is overloaded.

## Desired End State

A "Start break" action sits in the calm rail in any idle state; tapping opens a short/long + duration picker; the break runs, counts up `+MM:SS` past its configured end with an inline "End break" button, and on accept lands in the normal next-task kickoff — with no penalty. Every break (ad-hoc and cadence) behaves this way; pausing freezes overtime; a hidden-tab return resumes it; recap/stats are unchanged.

## Key Decisions Made

| Decision | Choice | Why | Source |
| --- | --- | --- | --- |
| Scope split | A + B in one change; B first, then A | Both define "what a break is" | Frame |
| "Continue the cycle" | Normal post-break kickoff beat | Not resuming a specific work cycle | Frame |
| Non-punishing | No cadence increment, no interruption count | Break is a better-than-pause affordance | Frame |
| Overtime surface | Inline count-up, no auto-overlay | Calmest; matches "quiet room" ethos | Plan |
| Overtime cap | Rely on existing 4h session timeout | Zero new logic; consistent backstop | Plan |
| Hidden-tab return | Retire `BREAK_CONFIRM` for breaks | Breaks no longer "end" at configured time | Plan |
| Paused overtime | Freezes while paused | Intuitive pause semantics | Plan |
| Trigger interaction | Tap opens short/long + duration picker | Honors "user picks"; reuses DurationPicker | Plan |
| Duration validation | Fold in kind-aware server bound | Closes a real gap cheaply | Plan |

## Scope

**In scope:** persistent idle "Start break" + picker; `startAdHocBreak` hook action (both data modes, non-punishing); overtime-until-accept for all breaks (timer worker + fallback + hook state machine + inline UI); retire `BREAK_CONFIRM` for breaks; kind-aware server duration bound; i18n (en/pl); test regression.

**Out of scope:** overtime for WORK cycles; `pause` vs `break` conceptual split; mid-cycle break start; new overtime cap timer; recap/focus-minute accounting changes; fixing the accidental "cycle switched off" root cause.

## Architecture / Approach

Phase 1 makes the timer/state machine *capable* of overtime (worker + main-thread fallback + `use-pomodoro-cycle`, counting up past `endTime` for breaks, WORK unchanged). Phase 2 makes overtime *visible and endable* (sign-aware formatter, `timer-panel` display + inline End break, retire break auto-overlay + `BREAK_CONFIRM`, copy). Phase 3 adds the idle `QuickActions` entry + picker calling `startAdHocBreak`. Phase 4 hardens server validation and sweeps the break test cluster + e2e belt.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| --- | --- | --- |
| 1. Overtime timer core | Breaks count up past `endTime`; pause/tab-return handled | Three expiry sites must change in lockstep or overtime freezes in one path |
| 2. Overtime UI + accept | `+MM:SS` display, inline End break, `BREAK_CONFIRM` retired | Overlay/gate dead-ends (lessons: dismiss oracle per gate) |
| 3. Ad-hoc break entry | Idle "Start break" + picker + non-punishing action | Accidentally touching a penalty counter; guest/auth asymmetry |
| 4. Validation + regression | Kind-aware server bound; full break test sweep | Stale oracles across ~20 break tests; e2e flake (L-06) |

**Prerequisites:** none beyond the frame + research (both complete). High-blast-radius files (`use-pomodoro-cycle`, `pomodoro-dashboard`) — run `pnpm change-impact` before editing.
**Estimated effort:** ~4 sessions, one per phase.

## Open Risks & Assumptions

- **Triple expiry-guard parity** is the sharpest risk — worker, main-thread fallback, and `recalculateFromEndTime` must all switch break expiry to overtime, or hidden-tab / worker-fallback swaps freeze in one path. `NEXT_PUBLIC_E2E_MAIN_THREAD_TIMER` must keep working.
- Assumes overtime is derived from a non-null `endTimeRef` + a signed remaining value; if a dedicated `overtimeMs` state is cleaner, that's an implementer call.
- Retiring `BREAK_CONFIRM` assumes no other consumer depends on it for breaks (verified in `derive-gate` + dashboard).

## Success Criteria (Summary)

- A user can start a break from any idle state and, on ending it, return to the normal next-task suggestion — with no interruption penalty or cadence change.
- Every break counts into overtime and ends only on explicit accept; pausing freezes it; recap/stats are unchanged.
- `pnpm test` and `pnpm test:e2e:belt` green; server rejects oversized breaks.
