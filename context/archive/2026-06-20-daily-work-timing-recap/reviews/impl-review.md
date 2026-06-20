<!-- IMPL-REVIEW-REPORT -->
# Implementation Review: S-30 Daily Work Timing Recap

- **Plan**: context/changes/daily-work-timing-recap/plan.md
- **Scope**: Phases 1–5 (full plan)
- **Date**: 2026-06-20
- **Verdict**: APPROVED
- **Findings**: 0 critical · 3 warnings (all fixed) · 4 observations

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

### F1 — Duplicated focused-minute formula in cycle.complete

- **Severity**: ⚠️ WARNING
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Plan Adherence
- **Location**: src/server/api/routers/cycle.ts:218-227
- **Detail**: Plan required extracting `computeCycleFocusedMinutes` from `cycle.complete`. Helper was created for recap paths but `cycle.complete` still inlined the same elapsed-seconds formula, creating drift risk on future changes.
- **Fix**: Import and call `computeCycleFocusedMinutes` with `state: "COMPLETED"` and the resolved `endedAt`.
- **Decision**: FIXED — applied in review auto-fix

### F2 — Auth recap stale after task mutations

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/hooks/use-task-mutations.ts:165-167
- **Detail**: `handleSettled` invalidated `task.list` only. After `markDoneForToday` (or create/delete/reorder), auth `DailyRecapPanel` Today section could stay stale until cycle complete or tab visibility change. Guest path was OK via store subscription.
- **Fix**: Extend `handleSettled` to also call `utils.recap.getDaily.invalidate({ localDateKey })`.
- **Decision**: FIXED — applied in review auto-fix; test mock updated in `use-task-mutations.test.tsx`

### F3 — Duplicate taskDayCompletion query in buildDailyRecap

- **Severity**: ⚠️ WARNING
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Safety & Quality
- **Location**: src/lib/recap/build-daily-recap.ts:71-76
- **Detail**: `buildSuggestionPool` and `buildDailyRecap` each fetched `taskDayCompletion` for the same `localDateKey` on every recap request.
- **Fix**: Extract `getDoneTodayTaskIds` in `build-suggestion-pool.ts`; pass preloaded set into `buildSuggestionPool` from `buildDailyRecap`.
- **Decision**: FIXED — applied in review auto-fix

### F4 — Footprint cumulative query has no time bound per task

- **Severity**: 👁 OBSERVATION
- **Impact**: 🔎 MEDIUM — real tradeoff; pause to reason through it
- **Dimension**: Safety & Quality
- **Location**: src/lib/recap/build-daily-recap.ts:160-176
- **Detail**: `buildFootprints` scopes by task-ID union (plan-compliant) but loads all COMPLETED WORK cycles for those IDs. Long-lived standing tasks could pull large history.
- **Fix**: Accept for v1 — union is bounded to last24h + todayPlan tasks; monitor before adding rollup storage.
- **Decision**: ACCEPTED — v1 scope per plan performance notes

### F5 — Panel hidden while auth query loading

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Pattern Consistency
- **Location**: src/app/_components/daily-recap-panel.tsx:80-82
- **Detail**: Panel returns null during `isLoading`; not specified in plan but matches `FocusBudgetPrompt` loading pattern.
- **Fix**: No change — consistent with existing dismissible panel UX.
- **Decision**: SKIPPED — benign UX choice

### F6 — Guest builder signature differs from plan contract

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Plan Adherence
- **Location**: src/lib/guest/recap.ts:18
- **Detail**: `buildGuestDailyRecap` accepts `doneTodayIds` and ignores `_localDateKey`; behavior correct for guest model.
- **Fix**: Document-only; no functional gap.
- **Decision**: SKIPPED — intentional guest parity

### F7 — Test gaps (pause-adjusted minutes, editingId footprint)

- **Severity**: 👁 OBSERVATION
- **Impact**: 🏃 LOW — quick decision; fix is obvious and narrowly scoped
- **Dimension**: Success Criteria
- **Location**: src/lib/recap/compute-cycle-focused-minutes.test.ts; src/app/_components/task-list.test.tsx
- **Detail**: Plan testing strategy mentions pause-adjusted `startedAt`; no unit test yet. Footprint on keyboard-expanded (`editingId`) row implemented but not component-tested.
- **Fix**: Optional follow-up tests; core paths covered by existing suite + belt e2e.
- **Decision**: SKIPPED — non-blocking for ship

## Success Criteria Verification

| Check | Result |
|-------|--------|
| `pnpm check` | PASS |
| `pnpm test` (770 tests) | PASS after review fixes |
| Phase 1–5 automated vitest targets | PASS (per plan progress shas) |
| Belt e2e `daily-work-timing-recap.spec.ts` | PASS (12eb16d) |
| Guardrails (no charts, no migrations, COMPLETED WORK only, focused footprint) | PASS |

## Scope Notes

**Benign extras (not flagged as drift):**
- `recap.integration.test.ts` — positive integration coverage
- `pomodoro-dashboard.test.tsx` mock for `useDailyRecap`
- `use-pomodoro-cycle.test.tsx` recap invalidation wiring

**Review auto-fix commit:** pending — `fix(daily-work-timing-recap): address impl-review warnings`
