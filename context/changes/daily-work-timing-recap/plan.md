# S-30 Daily Work Timing Recap Implementation Plan

## Overview

Implement PRD v3 US-03 light daily recap on home: collapsible **Last 24 hours** (per-task timing from COMPLETED WORK cycles), **Today** (active plan via S-27 `buildSuggestionPool`), and **focus footprint** on focused/expanded task rows. List-only, dismissible per local day, dual-mode guest/auth parity. No charts, no analytics dashboard.

## Current State Analysis

- **Cycle timing** exists in Prisma (`Cycle.startedAt`, `endedAt`, `taskId`) and guest `flowstate:guest-v1` blobs; focused minutes are derived on `cycle.complete`, not stored per task ([research.md](./research.md)).
- **S-27 shipped** standing tasks, `DayPlan`, `buildSuggestionPool`, `FocusBudgetPrompt` — reuse for Today section membership and budget context.
- **No recap router or UI** — `pomodoro-dashboard.tsx` mounts `FocusBudgetPrompt` then `TaskList` with no timing panel.
- **S-17 narrative** (`session-inflow-summary`) is session-scoped prose — recap must stay list/stats (P-202).

### Key Discoveries

- `DayPlan.usedFocusMinutes` is day-level user total — wrong source for per-task recap rows.
- Today list must use `buildSuggestionPool`, not `task-list` Active filter (standing edge case).
- Mount slot: between `FocusBudgetPrompt` and `TaskList` (`pomodoro-dashboard.tsx:483-511`).
- Footprint v1: Focus button row in `SortableActiveTaskRow` only (`task-list.tsx:654-666`).
- Dismiss pattern: `FocusBudgetPrompt` sessionStorage keyed by `localDateKey`.

## Desired End State

A user on home can:

1. Expand a calm **Daily recap** panel showing **Last 24 hours** — tasks worked with first cycle start, last cycle end, total focused minutes (COMPLETED WORK only).
2. Expand **Today** — tasks on today's plan (active + standing-not-done-today) with standing badges.
3. Dismiss recap for the local day ("Not now") without blocking the next session.
4. On focused/expanded task rows, see a one-line **footprint**: last focused (relative) + cumulative focused minutes.
5. Guest mode sees the same recap/footprint derived from local snapshot.

### Verification

- Automated: `pnpm check`, `pnpm typecheck`, `pnpm test`, vitest for recap lib + router, belt e2e for panel + dismiss.
- Manual: complete 2 WORK cycles on 2 tasks, confirm Last 24h rows; dismiss recap; confirm footprint on focused row.

## What We're NOT Doing

- Charts, trends, weekly reports, analytics dashboard
- P-104 context-switch trail (phase 2)
- P-111 type-mix line (phase 2)
- INTERRUPTED cycles in minute totals (v1)
- Footprint on every task row (v1 — focused/expanded only)
- Guest focus-hours budget UI
- New Prisma tables or migrations (read-only aggregation over existing `Cycle`)

## Implementation Approach

Extract shared `computeCycleFocusedMinutes` from `cycle.complete` elapsed logic. Add `recap` tRPC router with `getDaily({ localDateKey })` returning `{ last24Hours, todayPlan, footprints }`. Mirror aggregation in `src/lib/guest/recap.ts` for guest mode. Wire `useDailyRecap` dual-mode hook. Add `DailyRecapPanel` component with `aria-expanded` sections and dismiss storage. Extend `TaskList` row footer for footprint when row is focused.

## Critical Implementation Details

**Elapsed minutes:** Reuse the same formula as `cycle.complete` (`cycle.ts:218-227`) — `min(configuredDurationSec, endedAt - startedAt)` after pause-adjusted `startedAt`. Do not use `configuredDurationSec` alone.

**Mark-done without cycle:** Include tasks with `status: completed` and `updatedAt` within last 24h but no COMPLETED WORK cycle in window — label distinctly (e.g. "Marked done") with `focusedMinutes: 0`.

**Today vs Last 24h:** Last 24h = rolling `now - 24h` on cycle timestamps. Today = `buildSuggestionPool` output for `localDateKey` — calendar-day semantics for standing done-today.

## Phase 1: Recap Aggregation Lib & tRPC Router

### Overview

Shared minute computation and server-side recap query; register router in `root.ts`.

### Changes Required

#### 1. Focused minutes helper

**File**: `src/lib/recap/compute-cycle-focused-minutes.ts` (new)

**Intent**: Single source for elapsed WORK minutes from a cycle record (auth Prisma shape or guest cycle).

**Contract**: `computeCycleFocusedMinutes(cycle: { startedAt: Date; endedAt: Date | null; configuredDurationSec: number; state: string; kind: string }): number` — returns 0 unless `kind === WORK`, `state === COMPLETED`, `endedAt` set; else ceil seconds/60 min 1.

#### 2. Server rollup

**File**: `src/lib/recap/build-daily-recap.ts` (new)

**Intent**: Aggregate cycles in rolling 24h window by `taskId`; join task titles; build today plan via existing `buildSuggestionPool`.

**Contract**:
- Input: `db`, `userId`, `localDateKey`, `now`
- `last24Hours`: `{ taskId, title, firstStartedAt, lastEndedAt, focusedMinutes, completedWithoutCycle?: boolean }[]`
- `todayPlan`: `{ taskId, title, isDailyStanding, doneForToday, effortMinutes? }[]`
- `footprints`: `Record<taskId, { lastFocusedAt: Date; cumulativeMinutes: number }>` for task IDs in the union of last24h rows + todayPlan only (scoped query — avoid unbounded user history scan)

#### 3. Recap router

**File**: `src/server/api/routers/recap.ts` (new), register in `src/server/api/root.ts`

**Intent**: Authenticated recap endpoint.

**Contract**: `recap.getDaily({ localDateKey: string })` → output of `buildDailyRecap`; protected procedure; query cycles with `startedAt >= now - 24h` OR `endedAt >= now - 24h`, `kind: WORK`, `state: COMPLETED`.

#### 4. Repository `localDateKey` forwarding (required)

**File**: `src/lib/repositories/server-repositories.ts`, `src/lib/data-mode/types.ts`

**Intent**: `server-repositories` `complete` currently omits `localDateKey` — day-plan increment never fires through repository path. Forward it to `cycle.complete`.

**Contract**: `CompleteCycleArgs.localDateKey?: string` passed through in `complete` mutate call alongside `markTaskDone` / `incrementInterruption`.

### Success Criteria

#### Automated Verification

- `pnpm check` and `pnpm typecheck` pass
- `pnpm exec vitest run src/lib/recap/compute-cycle-focused-minutes.test.ts`
- `pnpm exec vitest run src/lib/recap/build-daily-recap.test.ts`
- `pnpm exec vitest run src/server/api/routers/recap.test.ts`

#### Manual Verification

- tRPC caller returns sensible rows after seeding cycles in dev DB

---

## Phase 2: Guest Aggregator & Dual-Mode Hook

### Overview

Client-side guest recap from snapshot; unified hook for dashboard consumption.

### Changes Required

#### 1. Guest recap builder

**File**: `src/lib/guest/recap.ts` (new)

**Intent**: Mirror `buildDailyRecap` over `loadSnapshot()` cycles + tasks.

**Contract**: `buildGuestDailyRecap(snapshot, localDateKey, now)` — same output shape as server recap (shared TypeScript types in `src/lib/recap/types.ts`).

#### 2. Shared types

**File**: `src/lib/recap/types.ts` (new)

**Intent**: `DailyRecap`, `RecapTaskRow`, `TaskFootprint` exported for hook + UI.

#### 3. Client hook

**File**: `src/hooks/use-daily-recap.ts` (new)

**Intent**: Auth uses `api.recap.getDaily`; guest uses `buildGuestDailyRecap` on snapshot change.

**Contract**: Returns `{ recap, isLoading, localDateKey }`; `enabled` per data-mode; invalidate on cycle complete / task mutations.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/lib/guest/recap.test.ts`
- `pnpm exec vitest run src/hooks/use-daily-recap.test.ts`

#### Manual Verification

- Guest trial: complete cycle, recap panel data updates without refresh

---

## Phase 3: Daily Recap Panel UI

### Overview

Collapsible dismissible panel mounted on home between focus budget and task list.

### Changes Required

#### 1. DailyRecapPanel component

**File**: `src/app/_components/daily-recap-panel.tsx` (new)

**Intent**: Calm collapsible card with Last 24h and Today sections; dismiss per `localDateKey`.

**Contract**:
- `data-testid="daily-recap-panel"`
- Sections use `aria-expanded` toggle pattern from `task-suggestion-card.tsx`
- Dismiss key: `flowstate:daily-recap-dismiss:{localDateKey}` (sessionStorage)
- List rows: `text-sm text-text-secondary`; headings `font-semibold text-text-section`
- Copy-friendly standup format: `{title} · {focusedMinutes}m · {time range}`

#### 2. Dashboard mount + prefetch

**Files**: `src/app/_components/pomodoro-dashboard.tsx`, `src/app/page.tsx`

**Intent**: Render `DailyRecapPanel` between `FocusBudgetPrompt` and `TaskList` when not dismissed; prefetch recap for auth to avoid panel waterfall.

**Contract**: Pass `recap` from `useDailyRecap()`; show for both guest and auth. Add `api.recap.getDaily.prefetch({ localDateKey })` beside existing task/cycle prefetches in `page.tsx` (use `formatLocalDateKey` server-side or pass from shared helper).

#### 3. Component smoke test

**File**: `src/app/_components/daily-recap-panel.test.tsx` (new)

**Intent**: Collapse toggle, dismiss, empty states.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/daily-recap-panel.test.tsx`
- `pnpm check` passes

#### Manual Verification

- Panel appears below focus budget; dismiss hides until next local day key
- Last 24h and Today sections expand/collapse independently

---

## Phase 4: Focus Footprint on Task Rows

### Overview

One-line footprint on focused/expanded active task row.

### Changes Required

#### 1. TaskList footprint row

**File**: `src/app/_components/task-list.tsx`

**Intent**: Show footprint below Focus button when row is focused or keyboard-expanded.

**Contract**:
- `data-testid="task-footprint-{taskId}"`
- Copy: `Last focused {relative} · {n}m total` via `formatEndedAgo` + recap footprints map
- Props: `footprints: Record<string, TaskFootprint>` from parent

#### 2. Wire footprints from dashboard

**File**: `src/app/_components/pomodoro-dashboard.tsx`

**Intent**: Pass `recap.footprints` into `TaskList`.

### Success Criteria

#### Automated Verification

- `pnpm exec vitest run src/app/_components/task-list.test.tsx` (extend for footprint)
- `pnpm test` full suite passes

#### Manual Verification

- Focus a task with prior cycles — footprint appears; unfocused rows stay clean

---

## Phase 5: E2E Belt & Test-Plan Cookbook

### Overview

Belt e2e covering recap visibility and dismiss; update test-plan §6 cookbook entry.

### Changes Required

#### 1. E2E spec

**File**: `e2e/daily-work-timing-recap.spec.ts` (new)

**Intent**: Auth user completes WORK cycle, sees Last 24h row; dismisses recap; footprint on focused task.

**Contract**: Belt-safe (no `@skip-belt`); reuse patterns from `e2e/daily-standing-capacity.spec.ts` and `e2e/seed.spec.ts`.

#### 2. Test-plan cookbook

**File**: `context/foundation/test-plan.md`

**Intent**: Fill §6 entry for daily recap pattern (location, run command, reference spec).

### Success Criteria

#### Automated Verification

- `set CI=true && pnpm test:e2e:belt --grep daily-work-timing-recap` passes
- `pnpm test` passes

#### Manual Verification

- Belt grep count unchanged for unrelated specs

---

## Testing Strategy

### Unit Tests

- `computeCycleFocusedMinutes`: COMPLETED vs INTERRUPTED, pause-adjusted startedAt, null endedAt
- `buildDailyRecap`: multi-task rollup, empty window, mark-done-without-cycle
- Guest recap: snapshot fixture parity with server shape

### Integration Tests

- `recap.getDaily` with seeded Prisma cycles + standing completions

### E2E

- Recap panel visible after cycle; dismiss persists for day; footprint on focus

## Performance Considerations

- Single query for cycles in 24h window per user; limit to COMPLETED WORK; no N+1 on tasks (batch `findMany` by ids).
- Guest aggregation is in-memory over snapshot — acceptable for guest scale.

## Migration Notes

No schema migration. Read-only feature over existing data.

## References

- [research.md](./research.md)
- [S-30 roadmap item](../../foundation/roadmap-references/items/S-30.md)
- `src/lib/suggestion/build-suggestion-pool.ts:46-54`
- `src/app/_components/focus-budget-prompt.tsx:21-30`
- `context/archive/2026-06-19-daily-standing-tasks-capacity-plan/plan.md`

## Progress

> Convention: `- [ ]` pending, `- [x]` done. Append ` — <commit sha>` when a step lands. Do not rename step titles.

### Phase 1: Recap Aggregation Lib & tRPC Router

#### Automated

- [x] 1.1 `pnpm check` and `pnpm typecheck` pass after Phase 1
- [x] 1.2 Vitest: `compute-cycle-focused-minutes.test.ts`
- [x] 1.3 Vitest: `build-daily-recap.test.ts`
- [x] 1.4 Vitest: `recap.test.ts` router

#### Manual

- [ ] 1.5 tRPC caller returns recap rows in dev after seeded cycles

### Phase 2: Guest Aggregator & Dual-Mode Hook

#### Automated

- [ ] 2.1 Vitest: `guest/recap.test.ts`
- [ ] 2.2 Vitest: `use-daily-recap.test.ts`

#### Manual

- [ ] 2.3 Guest trial recap updates after cycle complete

### Phase 3: Daily Recap Panel UI

#### Automated

- [ ] 3.1 Vitest: `daily-recap-panel.test.tsx`
- [ ] 3.2 `pnpm check` passes after panel mount

#### Manual

- [ ] 3.3 Panel collapse and dismiss behave correctly in browser

### Phase 4: Focus Footprint on Task Rows

#### Automated

- [ ] 4.1 Vitest: extended `task-list.test.tsx` footprint cases
- [ ] 4.2 Full `pnpm test` passes

#### Manual

- [ ] 4.3 Footprint visible only on focused row in browser

### Phase 5: E2E Belt & Test-Plan Cookbook

#### Automated

- [ ] 5.1 Belt e2e `daily-work-timing-recap.spec.ts` passes
- [ ] 5.2 Full `pnpm test` passes after e2e

#### Manual

- [ ] 5.3 Test-plan §6 cookbook entry reviewed
