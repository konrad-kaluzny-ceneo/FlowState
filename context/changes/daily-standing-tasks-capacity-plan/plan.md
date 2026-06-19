# S-27 Daily Standing Tasks & Focus-Hours Capacity Implementation Plan

## Overview

Implement PRD v3 US-03 daily planning: users mark tasks as daily standing work, set a once-per-local-day focus-hours budget, mark standing items done for today without completing them globally, and receive capacity-aware task suggestions at kickoff and post-check-in with rationale citing remaining minutes.

## Current State Analysis

- **Task model** (`prisma/schema.prisma`) has F-05 fields including `effortMinutes`; no daily-standing or day-plan entities.
- **Suggestion pipeline** (`suggestion.ts`, `score-task.ts`) scores only `status: "active"` tasks; context includes energy, cycles, `localHour` — no capacity.
- **Task UI** (`task-list.tsx`) supports Eisenhower edit/create and global mark-complete.
- **Data mode** splits guest/auth repositories; scoped localStorage patterns exist but no calendar-day keys.
- **US-03** requires logged-in user; lazy local-midnight reset in browser TZ.

### Key Discoveries

- Reuse `effortMinutes` — do not add `estimatedMinutes` ([research.md](./research.md)).
- S-25 readiness applies to kickoff only; post-check-in uses check-in energy directly.
- Mark-complete at `task-list.tsx:451-461` is the fork for standing vs global complete semantics.

## Desired End State

A logged-in user can:

1. Toggle **Daily standing** on create/edit task.
2. On first home visit each local day, set **Today's focus hours** (minutes budget).
3. Tap **Done for today** on a standing task (excluded from suggestion pool until next local day).
4. At kickoff/post-check-in, see suggestions preferring tasks with `effortMinutes <= remainingFocusMinutes`, with rationale like "Fits ~25 min left today" when capacity-fit dominates.
5. After local midnight (on next app open), standing tasks re-enter the pool and budget resets.

### Verification

- Automated: `pnpm check`, `pnpm typecheck`, `pnpm test`, targeted vitest for scorer/suggestion/day-plan, belt e2e.
- Manual: set 2h budget, complete 25m cycle, confirm remaining minutes and suggestion rationale update.

## What We're NOT Doing

- RRULE, weekly/monthly schedules, habit dashboards
- Guest focus-hours budget UI (guest snapshot may store `isDailyStanding` for import parity only)
- Midnight cron or server-side TZ storage
- S-30 daily recap / footprint (separate slice)
- Auto-spawn standing tasks at midnight without user opening app

## Implementation Approach

Add `DayPlan` and `TaskDayCompletion` Prisma models; extend `Task.isDailyStanding`; new `dayPlan` tRPC router; extend `task` router for flag + mark-done-today; client hook `use-day-plan` with lazy rollover; extend suggestion pool builder and scorer with `remainingFocusMinutes` and `capacity_fit` rationale key.

## Critical Implementation Details

**Standing complete vs global complete:** When `isDailyStanding`, the primary row action for "done" should write `TaskDayCompletion` for today's `localDateKey`, not `status: "completed"`. Global complete remains available in edit menu if needed, or standing tasks hide global complete — prefer dedicated "Done for today" only on standing rows.

**Pool semantics:** Suggestion pool = `{ status: active }` UNION `{ isDailyStanding && !doneToday(localDateKey) }` minus tasks done today via completion records.

## Phase 1: Schema, Domain Types & Routers

### Overview

Database models, migration, domain types, guest snapshot field, tRPC routers for task flag and day plan.

### Changes Required

#### 1. Prisma schema

**File**: `prisma/schema.prisma`

**Intent**: Add persistent daily-standing and per-day plan/completion entities.

**Contract**:
- `Task.isDailyStanding Boolean @default(false) @map("is_daily_standing")`
- `DayPlan`: `userId`, `localDateKey String @db.VarChar(10)`, `focusBudgetMinutes Int`, `usedFocusMinutes Int @default(0)`, `@@unique([userId, localDateKey])`, `@@map("flow_state_day_plan")`
- `TaskDayCompletion`: `userId`, `taskId`, `localDateKey`, `completedAt DateTime @default(now())`, `@@unique([userId, taskId, localDateKey])`, `@@map("flow_state_task_day_completion")`
- Run `pnpm prisma migrate dev` — never hand-write SQL.

#### 2. Domain & guest parity

**Files**: `src/lib/data-mode/types.ts`, `src/lib/guest/schema.ts`, `src/lib/repositories/guest-repositories.ts`, `src/lib/repositories/server-repositories.ts`, `src/lib/data-mode/use-domain-tasks.ts`, `src/server/api/lib/import-guest-snapshot.ts`

**Intent**: Propagate `isDailyStanding` through guest/auth task shape and import.

**Contract**: `DomainTask.isDailyStanding: boolean`; guest Zod schema v2 bump or additive optional field with backward-compatible parse.

#### 3. Task router extensions

**File**: `src/server/api/routers/task.ts`

**Intent**: Accept `isDailyStanding` on create/update; add `markDoneForToday` mutation.

**Contract**: `markDoneForToday` input `{ taskId, localDateKey }` → upsert `TaskDayCompletion`; validate task belongs to user and `isDailyStanding`.

#### 4. Day plan router

**File**: `src/server/api/routers/day-plan.ts` (new), register in `src/server/api/root.ts`

**Intent**: Get-or-create and set budget for a local date; return `remainingFocusMinutes`.

**Contract**:
- `getOrCreate({ localDateKey })` → `{ focusBudgetMinutes, usedFocusMinutes, remainingFocusMinutes }`
- `setBudget({ localDateKey, focusBudgetMinutes })` → upsert DayPlan (validate 15–720 min range)
- `incrementUsed({ localDateKey, minutes })` — internal or called from cycle router on WORK complete

#### 5. Cycle router hook

**File**: `src/server/api/routers/cycle.ts`

**Intent**: After WORK cycle completes, increment day plan used minutes for client's local date.

**Contract**: Accept optional `localDateKey` on complete mutation; add `Math.ceil(durationSec / 60)` to `usedFocusMinutes` (cap at budget).

### Success Criteria

#### Automated Verification

- Migration applies: `pnpm prisma migrate dev`
- `pnpm check` and `pnpm typecheck` pass
- `pnpm exec vitest run src/server/api/routers/task-mutation.test.ts` (extend for standing flag)
- New `src/server/api/routers/day-plan.test.ts` — getOrCreate, setBudget, incrementUsed

#### Manual Verification

- Prisma Studio shows new tables after migrate

---

## Phase 2: Task UI, Day Plan Prompt & Done-for-Today

### Overview

User-facing controls for daily flag, focus budget, and standing completion.

### Changes Required

#### 1. Local date utility

**File**: `src/lib/time/local-date-key.ts` (new)

**Intent**: Shared browser-TZ `YYYY-MM-DD` formatter for client and tests.

**Contract**: `formatLocalDateKey(date?: Date): string`

#### 2. Day plan hook

**File**: `src/hooks/use-day-plan.ts` (new)

**Intent**: Auth-only hook wrapping `dayPlan.getOrCreate` / `setBudget`; lazy rollover when `localDateKey` changes.

**Contract**: Returns `{ budgetMinutes, remainingMinutes, setBudget, isLoading, localDateKey }`.

#### 3. Focus budget prompt

**File**: `src/app/_components/focus-budget-prompt.tsx` (new), wire in `pomodoro-dashboard.tsx` or home shell

**Intent**: Collapsible/dismissible prompt when no budget set for today (auth only).

**Contract**: Preset chips (e.g. 2h, 4h, 6h) + custom input; calls `setBudget`; dismissible without blocking wedge.

#### 4. Task list standing UX

**File**: `src/app/_components/task-list.tsx`

**Intent**: Daily standing toggle in create/edit; badge on standing rows; "Done for today" action; hide or de-emphasize global complete on standing rows.

**Contract**: Extend edit/create state with `isDailyStanding`; optimistic updates via `use-task-mutations.ts`.

#### 5. Mutations hook

**File**: `src/hooks/use-task-mutations.ts`

**Intent**: Wire `markDoneForToday` and `isDailyStanding` on create/update.

**Contract**: Guest path updates snapshot; auth uses tRPC for `markDoneForToday` and `isDailyStanding`.

**Contract (UI)**: Standing rows stay in list with dimmed/strike styling when done for today; excluded only from suggestion pool.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/task-list.test.tsx` — extend smoke for daily toggle render
- `pnpm test` full suite green

#### Manual Verification

- Toggle daily standing on task; badge visible
- Set budget; persists on refresh same day
- Done for today dims/strikes row but keeps it visible until local-day rollover

---

## Phase 3: Lazy Day Rollover & Capacity Consumption

### Overview

Ensure day boundary semantics and cycle-complete decrement work end-to-end.

### Changes Required

#### 1. Rollover on app load

**File**: `src/hooks/use-day-plan.ts`, `src/app/_components/home-shell.tsx`

**Intent**: On mount, if stored date !== `formatLocalDateKey(now)`, fetch fresh day plan (implicit new day).

**Contract**: No background timer; optional `useEffect` on visibility change to re-check date.

#### 2. Client cycle complete

**File**: `src/hooks/use-pomodoro-cycle.ts` (or cycle mutation caller)

**Intent**: Pass `localDateKey` when completing WORK cycle so server increments used minutes.

**Contract**: Only authenticated mode; guest no-op for budget.

#### 3. Standing pool visibility

**File**: `src/hooks/use-pomodoro-cycle.ts` — `hasActiveTasks` helper

**Intent**: Kickoff eligible when active tasks OR standing-not-done-today exist.

**Contract**: Query includes standing tasks via extended task list or dedicated flag from API.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/hooks/use-day-plan.test.ts` (new) — rollover + remaining calc
- `pnpm exec vitest run src/server/api/routers/cycle.test.ts` if exists, or day-plan integration test

#### Manual Verification

- Complete WORK cycle; remaining minutes decrease
- Change system date / mock localDateKey in dev; standing tasks reappear

---

## Phase 4: Suggestion Pool, Scoring & Rationale

### Overview

Capacity-aware suggestions at kickoff and post-check-in.

### Changes Required

#### 1. Scoring context

**File**: `src/lib/scoring/score-task.ts`

**Intent**: Add `remainingFocusMinutes: number | null` to `ScoringContext`; boost tasks where `effortMinutes <= remaining`; penalize over-budget when effort set.

**Contract**: Multiplier ~1.15 fit / ~0.85 over when `remainingFocusMinutes` defined and `effortMinutes` non-null.

#### 2. Rationale

**Files**: `src/lib/scoring/rationale.ts`, `dominant-factor.ts`, `rationale-breakdown.ts`

**Intent**: New key `capacity_fit` — "Fits ~{n} min left today".

**Contract**: Include in dominant factor contributions; chip label in breakdown.

#### 3. Suggestion router

**File**: `src/server/api/routers/suggestion.ts`

**Intent**: Shared `buildSuggestionPool(userId, localDateKey)`; load DayPlan; compute remaining; pass to scorer.

**Contract**: Extend `nextInputSchema` with `localDateKey` for kickoff and post_check_in; both branches use shared pool builder.

#### 4. Client fetch

**File**: `src/hooks/use-pomodoro-cycle.ts`

**Intent**: Pass `localDateKey: formatLocalDateKey()` alongside `localHour` in suggestion mutations.

**Contract**: Auth-only; guest unchanged.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/lib/scoring/score-task.test.ts`
- `pnpm exec vitest run src/lib/scoring/dominant-factor.test.ts`
- `pnpm exec vitest run src/server/api/routers/suggestion.test.ts`

#### Manual Verification

- With 30m remaining and 20m-effort standing task, suggestion prefers it with capacity rationale
- Standing task done today excluded from pool

---

## Phase 5: E2E Belt Coverage

### Overview

Browser-level proof for US-03 standing + capacity path (auth worker).

### Changes Required

#### 1. E2E spec

**File**: `e2e/daily-standing-capacity.spec.ts` (new)

**Intent**: Seed standing task + budget; trigger kickoff suggestion; assert rationale contains capacity copy.

**Contract**: Tag `@skip-belt` if flaky timing; otherwise include in belt if stable under 4 workers. Follow `e2e/seed.spec.ts` patterns.

#### 2. Helper

**File**: `e2e/helpers/daily-plan.ts` (new)

**Intent**: API/UI helpers to set budget and create standing task in test setup.

### Success Criteria

#### Automated Verification

- `set CI=true && pnpm test:e2e:belt` passes (or new spec tagged appropriately per stability)

#### Manual Verification

- Playwright html report shows standing capacity flow green locally

---

## Testing Strategy

### Unit Tests

- Day plan router: budget bounds, getOrCreate idempotency, incrementUsed cap
- Scorer: capacity fit boost/penalty, null effort fallback
- Suggestion pool: standing inclusion/exclusion by completion date
- `formatLocalDateKey` edge cases (month boundary)

### Integration Tests

- Cycle complete → usedFocusMinutes increment
- markDoneForToday → excluded from suggestion pool same day

### Manual Testing Steps

1. Create standing task with 25m effort; set 120m budget; verify kickoff suggestion rationale.
2. Mark standing done for today; confirm no suggestion picks it.
3. Next calendar day (or mocked key): task returns to pool, budget fresh.

## Performance Considerations

- Day plan + completion lookups: index on `(userId, localDateKey)`; single query join for pool build.
- No extra suggestion latency target beyond existing ≤200ms NFR for wedge surfaces (capacity is server-side only).

## Migration Notes

- Backfill: all existing tasks `isDailyStanding = false`.
- Guest snapshot: optional field defaults false; unsupported versions ignore.

## References

- Research: `context/changes/daily-standing-tasks-capacity-plan/research.md`
- PRD US-03: `context/foundation/prd.md`
- Slice detail: `context/foundation/roadmap-references/items/S-27.md`
- Scorer: `src/lib/scoring/score-task.ts`
- Suggestion: `src/server/api/routers/suggestion.ts`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Schema, Domain Types & Routers

#### Automated

- [x] 1.1 Migration applies: `pnpm prisma migrate dev` — 7667c6e
- [x] 1.2 `pnpm check` and `pnpm typecheck` pass — 7667c6e
- [x] 1.3 Task mutation tests pass (standing flag) — 7667c6e
- [x] 1.4 Day plan router tests pass — 7667c6e

#### Manual

- [x] 1.5 Prisma Studio shows new tables after migrate — 7667c6e

### Phase 2: Task UI, Day Plan Prompt & Done-for-Today

#### Automated

- [ ] 2.1 Task list component smoke tests pass (daily toggle)
- [ ] 2.2 Full `pnpm test` suite green

#### Manual

- [ ] 2.3 Toggle, badge, budget, done-for-today verified in UI

### Phase 3: Lazy Day Rollover & Capacity Consumption

#### Automated

- [ ] 3.1 Day plan hook tests pass (rollover + remaining)
- [ ] 3.2 Cycle/day-plan integration tests pass

#### Manual

- [ ] 3.3 WORK cycle decrements remaining; day rollover clears state

### Phase 4: Suggestion Pool, Scoring & Rationale

#### Automated

- [ ] 4.1 Scorer unit tests pass (capacity fit)
- [ ] 4.2 Dominant factor / rationale tests pass
- [ ] 4.3 Suggestion router tests pass (standing pool)

#### Manual

- [ ] 4.4 Capacity rationale visible on kickoff and post-check-in

### Phase 5: E2E Belt Coverage

#### Automated

- [ ] 5.1 Belt e2e passes with daily standing spec

#### Manual

- [ ] 5.2 Playwright report reviewed locally
