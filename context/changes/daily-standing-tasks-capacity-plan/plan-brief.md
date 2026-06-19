# S-27 Daily Standing Tasks & Focus-Hours Capacity — Plan Brief

> Full plan: `context/changes/daily-standing-tasks-capacity-plan/plan.md`  
> Research: `context/changes/daily-standing-tasks-capacity-plan/research.md`

## What & Why

Logged-in users mark tasks as daily standing work, set today's available focus hours once per local calendar day, and see capacity-aware next-task suggestions ("fits ~25 min left today"). This delivers PRD v3 US-03 daily planning without building a recurring/habit product — boolean flag + local-day reset only.

## Starting Point

F-05 ships `effortMinutes` and Eisenhower attributes. S-06/S-15 suggestion + S-25 kickoff readiness are live. No daily-standing, day plan, or capacity scoring exists in code yet.

## Desired End State

User toggles "Daily standing" on tasks, sets focus-hours budget on first open each local day, marks standing items "Done for today" without archiving them, and receives kickoff/post-check-in suggestions that prefer tasks fitting remaining capacity with rationale citing minutes left. Local midnight rollover is lazy on app open.

## Key Decisions Made

| Decision | Choice | Why | Source |
|----------|--------|-----|--------|
| Per-task estimate field | Reuse `effortMinutes` | F-05 already ships 5–240 min | Research |
| Done-for-today semantics | `TaskDayCompletion` per local date | Avoids `status: completed` churn | Plan |
| Day budget storage | `DayPlan` table (`userId`, `localDateKey`) | Once per calendar day, not per session | Plan |
| Capacity tracking | `usedFocusMinutes` on `DayPlan`, increment on WORK cycle complete | Fast suggestion path | Plan |
| Guest scope | Auth-only budget UI; guest snapshot gets `isDailyStanding` only | US-03 logged-in | PRD |
| Reset trigger | Lazy compare `localDateKey` on read | PRD + S-27 risk guard | Plan |
| Scoring integration | Extend `ScoringContext.remainingFocusMinutes` + new rationale key | Matches `localHour` precedent | Research |

## Scope

**In scope:** Prisma models + migration; task flag CRUD + UI; day plan set/read; done-for-today action; lazy rollover; suggestion pool filter + capacity score + rationale; unit tests; belt e2e for standing + capacity path.

**Out of scope:** RRULE/recurrence; habit dashboard; guest focus budget; auto-spawn at midnight without app open; S-30 recap enrichment (follow-on).

## Architecture / Approach

New domain tables sit beside `Task`. Client sends `localDateKey` (browser TZ) with day-plan and suggestion calls. `suggestion.ts` builds an expanded pool (active tasks + standing-not-done-today), computes `remainingFocusMinutes` from `DayPlan`, and passes into `scoreTask`. Task list adds daily badge, budget prompt, and "Done for today" on standing rows.

## Phases at a Glance

| Phase | What it delivers | Key risk |
|-------|------------------|----------|
| 1. Schema & domain | Models, migration, types, routers | Guest snapshot version bump |
| 2. Task UI & day plan | Toggle, budget setter, done-for-today | UX clutter on task list |
| 3. Day rollover & consumption | Lazy reset, cycle-complete decrement | TZ edge cases at midnight |
| 4. Suggestion integration | Pool, score, rationale | Dominant factor tuning |
| 5. E2E belt | Playwright standing + capacity smoke | Auth-only path in belt |

**Prerequisites:** F-05, S-06, S-15 done (met).  
**Estimated effort:** ~4 implementation phases + e2e, 2–3 sessions.

## Open Risks & Assumptions

- Null `effortMinutes` tasks excluded from capacity-fit boost (fallback to Eisenhower only).
- Belt e2e uses authenticated worker pool only for budget UI.
- Capacity decrement uses completed WORK cycle actual duration (seconds → minutes, rounded up).

## Success Criteria (Summary)

- Standing task not done today appears in suggestion pool even if user has other active work.
- Suggestion rationale can cite remaining focus minutes when capacity-fit dominates.
- Local-day rollover clears today-done state and resets used minutes without server cron.
