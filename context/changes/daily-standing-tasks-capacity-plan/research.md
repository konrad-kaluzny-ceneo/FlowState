---
date: 2026-06-19T12:00:00+02:00
researcher: ship-slice-orchestrator
git_commit: 372b9dbfdd458ce136f6fa458016d4de1157acc4
branch: features/daily-standing-tasks-capacity-plan
repository: FlowState
topic: "S-27 daily standing tasks, focus-hours budget, capacity-aware suggestions"
tags: [research, codebase, scoring, task, day-plan, S-27, US-03]
status: complete
last_updated: 2026-06-19
last_updated_by: ship-slice-orchestrator
---

# Research: S-27 Daily Standing Tasks & Focus-Hours Capacity Plan

**Date**: 2026-06-19  
**Researcher**: ship-slice-orchestrator  
**Git Commit**: `372b9dbfdd458ce136f6fa458016d4de1157acc4`  
**Branch**: `features/daily-standing-tasks-capacity-plan`  
**Repository**: FlowState

## Research Question

How should S-27 implement daily standing tasks, once-per-local-day focus-hours budget, local-midnight reset, and capacity-fit suggestion scoring/rationale — across Prisma, guest/auth data mode, task UI, and the existing S-06/S-15 suggestion pipeline?

## Summary

S-27 is **not implemented in `src/`** — only product docs and an empty change folder existed. F-05 (`effortMinutes`, Eisenhower axes) and the full suggestion stack (S-06 kickoff/post-check-in, S-25 kickoff readiness) are shipped and are the primary extension surfaces.

Recommended shape: add `isDailyStanding` on `Task`; store per-user per-local-date `DayPlan` (budget + used minutes); track `TaskDayCompletion` rows for "done today" (not `status: completed`); lazy local-midnight reset on app read; extend `ScoringContext` + suggestion pool + rationale for capacity fit. Auth-only for day plan (US-03); propagate `isDailyStanding` through guest snapshot for field parity.

## Detailed Findings

### Task model & F-05 substrate

- `Task` in `prisma/schema.prisma` has `effortMinutes` (5–240), Eisenhower fields, `sortOrder`, `resumeNote` — no daily fields.
- Task CRUD: `src/server/api/routers/task.ts` — list/create/update/reorder/delete.
- UI: `src/app/_components/task-list.tsx` — Eisenhower editors, create form, mark-complete sets `status: "completed"`.
- Guest parity path: `src/lib/guest/schema.ts`, `src/lib/data-mode/types.ts`, `use-task-mutations.ts`.

### Suggestion pipeline

- Scoring: `src/lib/scoring/score-task.ts`, `dominant-factor.ts`, `rationale.ts`, `rationale-breakdown.ts`.
- Server: `src/server/api/routers/suggestion.ts` — loads `status: "active"` tasks for both kickoff and post-check-in; builds `ScoringContext` via `buildScoringContextForSession`.
- Client: `use-pomodoro-cycle.ts` passes `localHour`; kickoff uses S-25 readiness overlay.
- S-25 gate applies to **kickoff only**; post-check-in uses check-in energy directly.

### Data mode & local-day patterns

- Guest/auth split via `DataModeProvider` + repository pattern (`src/lib/data-mode/`).
- Scoped localStorage precedent: `work-type-duration-storage.ts`, `cycle-audio-preference/storage.ts`.
- **No** local-midnight or `YYYY-MM-DD` key logic exists today.
- `UserPreference` holds only `cycleEndAudioMode` — natural sibling for day-scoped data is a new `DayPlan` table, not Session.
- Closest local-time pattern: `localHour` passed to suggestion API from client.

### PRD constraints

- US-03: logged-in user with standing tasks + focus-hours budget; suggestions cite capacity fit.
- Local midnight reset in browser TZ; lazy reset (no cron); boolean flag only — no RRULE.
- Scope guard: suggestion pool only — no habit dashboard.

## Code References

| Area | Path |
|------|------|
| Task schema | `prisma/schema.prisma:63-90` |
| Task router | `src/server/api/routers/task.ts` |
| Task list UI | `src/app/_components/task-list.tsx` |
| Scorer | `src/lib/scoring/score-task.ts` |
| Suggestion router | `src/server/api/routers/suggestion.ts` |
| Pomodoro hook | `src/hooks/use-pomodoro-cycle.ts` |
| Data mode | `src/lib/data-mode/data-mode-context.tsx` |
| Guest schema | `src/lib/guest/schema.ts` |
| Preference router | `src/server/api/routers/preference.ts` |

## Architecture Insights

1. **Reuse `effortMinutes`** for per-task estimates — do not add `estimatedMinutes`.
2. **Separate "done for today" from task completion** — standing tasks must remain active across days.
3. **Extend suggestion pool query** in one shared helper used by kickoff and post-check-in branches.
4. **Mirror `localHour` pattern** with `localDateKey` (`YYYY-MM-DD` from browser) on day-plan and suggestion inputs.
5. **Lazy day rollover** on read — compare stored `localDateKey` to current; no background midnight timer.

## Open Questions — Resolved for Planning (Decision Proxy)

| Unknown (roadmap) | Decision | Rationale |
|-------------------|----------|-----------|
| Day plan on Session vs per-date record | `DayPlan` table keyed by `userId` + `localDateKey` | Budget is once per calendar day across sessions |
| todayDone vs archive until midnight | `TaskDayCompletion` rows per local date | Keeps standing tasks visible; avoids reactivation churn |
| Capacity decrement model | Increment `DayPlan.usedFocusMinutes` on WORK cycle complete | Simple hot path for suggestion; actual elapsed from cycle |
| Guest parity for budget | Auth-only v1 | US-03 specifies logged-in user; guest gets `isDailyStanding` field only |

## Related Work

- F-05 (done): Eisenhower + effort substrate
- S-06/S-15/S-25 (done): suggestion + kickoff + readiness
- S-30 (ready): timing recap will consume standing task enrichment later
