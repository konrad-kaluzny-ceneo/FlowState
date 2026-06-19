<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-27 Daily Standing Tasks & Focus-Hours Capacity

- **Plan**: context/changes/daily-standing-tasks-capacity-plan/plan.md
- **Scope**: Full plan (Phases 1–5)
- **Date**: 2026-06-19
- **Verdict**: APPROVED
- **Findings**: 0 critical, 5 warnings (all fixed), 3 observations (accepted)

## Verdicts

| Dimension | Verdict |
|-----------|---------|
| Plan Adherence | PASS |
| Scope Discipline | PASS |
| Safety & Quality | PASS |
| Architecture | PASS |
| Pattern Consistency | PASS |
| Success Criteria | PASS |

## Findings

### F1 — Public incrementUsed tRPC endpoint abusable

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/server/api/routers/day-plan.ts
- **Detail**: Client-callable `incrementUsed` could inflate used minutes without completing cycles.
- **Fix**: Extract `incrementUsedFocusMinutes` lib; remove public endpoint; cycle.complete uses lib only.
- **Decision**: FIXED

### F2 — Non-atomic day-plan minute updates

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Reliability
- **Location**: src/server/api/routers/cycle.ts
- **Detail**: Read-modify-write could lose minutes under concurrent completions.
- **Fix**: Use Prisma `{ increment }` then cap in follow-up update.
- **Decision**: FIXED

### F3 — Suggestion pool loaded all tasks

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Performance
- **Location**: src/lib/suggestion/build-suggestion-pool.ts
- **Detail**: Full user task scan on every suggestion request.
- **Fix**: DB filter `OR: [{ status: active }, { isDailyStanding: true }]`.
- **Decision**: FIXED

### F4 — Optimistic task cache key mismatch

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM
- **Dimension**: Pattern Consistency
- **Location**: src/hooks/use-task-mutations.ts
- **Detail**: Mutations used unkeyed `task.list` while dashboard queries `{ localDateKey }`.
- **Fix**: Pass `formatLocalDateKey()` input to all optimistic cache ops.
- **Decision**: FIXED

### F5 — Focus budget dismiss stale after midnight

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW
- **Dimension**: Reliability
- **Location**: src/app/_components/focus-budget-prompt.tsx
- **Detail**: `dismissed` state not re-synced when `localDateKey` changes.
- **Fix**: `useEffect` to re-read sessionStorage on date change.
- **Decision**: FIXED

### F6 — setBudget does not clamp used minutes

- **Severity**: OBSERVATION
- **Dimension**: Data safety
- **Location**: src/server/api/routers/day-plan.ts
- **Detail**: Lowering budget could leave used > budget in DB.
- **Fix**: Clamp after upsert when budget decreases.
- **Decision**: FIXED

### F7 — markDoneForToday on completed standing tasks

- **Severity**: OBSERVATION
- **Dimension**: Reliability
- **Location**: src/server/api/routers/task.ts
- **Detail**: No `status: active` guard on standing completion.
- **Fix**: Require active status in findFirst.
- **Decision**: FIXED

### F8 — formatLocalDateKey unit tests missing

- **Severity**: OBSERVATION
- **Dimension**: Success Criteria
- **Location**: src/lib/time/local-date-key.ts
- **Detail**: Plan testing strategy cited month-boundary cases.
- **Fix**: Add `local-date-key.test.ts`.
- **Decision**: FIXED

## Plan drift notes (non-blocking)

- Cycle minute source uses elapsed wall time (capped by configured duration) — acceptable; documented in review.
- E2E asserts capacity rationale on post-check-in path; kickoff exclusion covered separately.
- Rollover lives in `use-day-plan` hook rather than `home-shell.tsx` — intent preserved.
