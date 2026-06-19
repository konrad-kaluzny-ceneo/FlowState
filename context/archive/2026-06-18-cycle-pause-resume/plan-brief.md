# Cycle Pause and Resume (S-24) — Plan Brief

> Full plan: `context/changes/cycle-pause-resume/plan.md`
> Research: `context/changes/cycle-pause-resume/research.md`

## What & Why

Users need to step away mid-cycle without losing remaining time or being scored as interrupted. PRD v3 US-04 contracts pause/resume as a first-class mid-cycle intent — distinct from Interrupt — with wedge gates suppressed while paused and a ~30 min cap that calmly ends the session.

## Starting Point

Only Interrupt exists today (terminal `INTERRUPTED`, time lost). `CycleState` has no `PAUSED`; the hook and conductor have no pause dimension. F-07 conductor is shipped and ready for a `cyclePaused` suppressor.

## Desired End State

Pause freezes the timer and persists remaining time (auth + guest). Resume continues the cycle. Refresh while paused restores the same remaining. Wedge overlays stay hidden while paused. After 30 minutes paused, the session ends with a calm closure line — no interruption increment.

## Key Decisions Made

| Decision | Choice | Why (1 sentence) | Source |
| -------- | ------ | ---------------- | ------ |
| Persistence model | Server-side `PAUSED` + `remainingDurationSec` | Refresh/tab-close recovery requires persisted state on auth and guest paths | Research |
| Pause cap duration | `30 * 60 * 1000` ms constant | PRD v3 default; not user-facing in v1 | Research / Plan |
| Cap closure copy | New `endedBy: "pause_cap"` | Distinct calm copy from session timeout | Plan |
| Session idle vs pause | Orthogonal policies | Pause does not extend 4h inactivity clock | Research |
| Guest idle timeout | Document auth-only for v1 | Guest has no 4h timeout today; no new policy | Plan |
| B-08 full variant | Deferred | Ships after S-24 per roadmap | Research |
| Stale RUNNING after 4h | Out of scope | Pre-existing gap; cap path ends session cleanly | Plan |

## Scope

**In scope:** Prisma + guest `PAUSED` state; pause/resume repos and hook; conductor + dashboard pol-12; timer UI; pause cap pol-8; belt e2e smoke.

**Out of scope:** B-08 full, guest 4h idle parity, stale-RUNNING cleanup, hook decomposition, user-configurable cap.

## Architecture / Approach

Hybrid model: `CycleState.PAUSED` + `pausedAt` + `remainingDurationSec` in DB and guest blob. Hook extends end-time pattern (stop worker → persist remaining → resume with new anchor). Conductor gets `cyclePaused` global suppressor; dashboard guards non-conductor suggestion/catch-up cards. Cap timer in hook fires `endSession` with `pause_cap` closure.

## Phases at a Glance

| Phase | What it delivers | Key risk |
| ----- | ---------------- | -------- |
| 1. Schema + types | PAUSED enum and fields | Migration ordering vs deploy |
| 2. Repos + router | pause/resume/getActive parity | Mutex bugs (PAUSED vs RUNNING) |
| 3. Hook | State machine + recovery | Optimistic rollback edge cases |
| 4. pol-12 suppression | Conductor + dashboard guards | Missed non-conductor surface |
| 5. Timer UI | Pause/Resume buttons | L-04: per-surface 200ms oracle |
| 6. pol-8 cap | Calm session end after 30 min | Fake-timer test fidelity |
| 7. E2E belt | Browser pause/resume smoke | Belt stability with timer assertions |

**Prerequisites:** S-01, S-02, F-07 done; branch `features/cycle-pause-resume`  
**Estimated effort:** ~3–4 sessions across 7 phases

## Open Risks & Assumptions

- Half-implemented PAUSED (schema without hook recovery) is worse than today's Interrupt-only UX — phases are ordered to avoid partial ship.
- Cap e2e may need `@skip-belt` if wall-clock wait is unavoidable; hook tests carry primary signal per test-plan #10.
- Guest merge with long-paused cycles may need cap check on import (handled in Phase 2).

## Success Criteria (Summary)

- Pause/resume preserves remaining time on auth and guest, including after refresh.
- No wedge overlays and no `interruptionCount` increment while paused or on cap end.
- Belt green with pause/resume smoke spec.
